import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import type { DemandPieceStore } from "../magnet/piece-store.ts";
import { parseRangeHeader } from "../magnet/range-map.ts";
import { sanitizeRelativePath } from "../magnet/sanitize.ts";

export type BridgeFile = {
  index: number;
  name: string;
  length: number;
};

export type RangeServerStats = {
  headCount: number;
  getCount: number;
  rangeCount: number;
  concurrentPeak: number;
  statusCounts: Record<number, number>;
  reconnects: number;
  aborted: number;
};

export type RangeServerHandle = {
  port: number;
  token: string;
  origin: string;
  urlFor: (fileIndex: number) => string;
  files: BridgeFile[];
  stats: RangeServerStats;
  close: () => Promise<void>;
};

function mimeFor(name: string): string {
  if (name.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (name.endsWith(".srt")) return "application/x-subrip";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function send(res: ServerResponse, status: number, stats: RangeServerStats, extra?: Record<string, string>, body?: string) {
  stats.statusCounts[status] = (stats.statusCounts[status] ?? 0) + 1;
  res.writeHead(status, extra);
  res.end(body);
}

async function writeChunk(res: ServerResponse, chunk: Uint8Array): Promise<void> {
  if (res.writableEnded) throw new Error("response ended");
  await new Promise<void>((resolve, reject) => {
    const ok = res.write(Buffer.from(chunk));
    if (ok) resolve();
    else res.once("drain", resolve);
    res.once("error", reject);
  });
}

export async function startRangeServer(options: {
  store: DemandPieceStore;
  files?: number[];
  host?: string;
}): Promise<RangeServerHandle> {
  const host = options.host ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Architecture D Range server must bind localhost only");
  }
  const token = randomBytes(18).toString("base64url");
  const selected = options.files ?? options.store.meta.files.map((file) => file.index);
  const files: BridgeFile[] = selected.map((index) => {
    const file = options.store.meta.files[index];
    if (!file) throw new Error(`unknown file ${index}`);
    return { index, name: sanitizeRelativePath(file.name), length: file.length };
  });
  const stats: RangeServerStats = {
    headCount: 0,
    getCount: 0,
    rangeCount: 0,
    concurrentPeak: 0,
    statusCounts: {},
    reconnects: 0,
    aborted: 0,
  };
  const seen = new Set<string>();
  let inflight = 0;

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    inflight += 1;
    stats.concurrentPeak = Math.max(stats.concurrentPeak, inflight);
    const abort = new AbortController();
    req.on("aborted", () => abort.abort());
    req.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });
    try {
      await handle(req, res, abort.signal);
    } catch (error) {
      if (abort.signal.aborted) {
        stats.aborted += 1;
        if (!res.writableEnded) res.destroy();
        return;
      }
      if (!res.headersSent) send(res, 500, stats, { "Content-Type": "text/plain" }, String(error));
      else res.destroy();
    } finally {
      inflight -= 1;
    }
  });

  async function handle(req: IncomingMessage, res: ServerResponse, signal: AbortSignal) {
    const hostHeader = req.headers.host ?? "";
    if (hostHeader && !hostHeader.startsWith("127.0.0.1") && !hostHeader.startsWith("localhost")) {
      send(res, 403, stats, { "Content-Type": "text/plain" }, "localhost only");
      return;
    }
    const url = new URL(req.url ?? "/", `http://${host}`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== token || parts.length < 2) {
      send(res, 404, stats, { "Content-Type": "text/plain" }, "unknown token");
      return;
    }
    const fileIndex = Number(parts[1]);
    const file = files.find((item) => item.index === fileIndex);
    if (!file) {
      send(res, 404, stats, { "Content-Type": "text/plain" }, "unknown file");
      return;
    }
    const method = (req.method ?? "GET").toUpperCase();
    const common = {
      "Accept-Ranges": "bytes",
      "Content-Type": mimeFor(file.name),
      "Content-Disposition": `attachment; filename="${file.name.replaceAll('"', "")}"`,
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    };
    if (method === "HEAD") {
      stats.headCount += 1;
      send(res, 200, stats, { ...common, "Content-Length": String(file.length) });
      return;
    }
    if (method !== "GET") {
      send(res, 405, stats, { Allow: "GET, HEAD" }, "method not allowed");
      return;
    }
    stats.getCount += 1;
    const range = parseRangeHeader(req.headers.range, file.length);
    if (range === "unsatisfiable") {
      send(res, 416, stats, {
        ...common,
        "Content-Range": `bytes */${file.length}`,
      });
      return;
    }
    const start = range === "full" ? 0 : range.start;
    const end = range === "full" ? file.length : range.end;
    if (req.headers.range) stats.rangeCount += 1;
    const connKey = `${fileIndex}:${start}-${end}`;
    if (seen.has(connKey)) stats.reconnects += 1;
    seen.add(connKey);

    const status = range === "full" ? 200 : 206;
    stats.statusCounts[status] = (stats.statusCounts[status] ?? 0) + 1;
    const headers: Record<string, string> = {
      ...common,
      "Content-Length": String(end - start),
    };
    if (status === 206) headers["Content-Range"] = `bytes ${start}-${end - 1}/${file.length}`;
    res.writeHead(status, headers);

    for await (const chunk of options.store.streamFileRange(fileIndex, start, end, signal)) {
      await writeChunk(res, chunk);
    }
    res.end();
  }

  server.listen(0, host);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind localhost range server");
  const port = address.port;
  const origin = `http://${host}:${port}`;

  return {
    port,
    token,
    origin,
    files,
    stats,
    urlFor(fileIndex: number) {
      const file = files.find((item) => item.index === fileIndex);
      if (!file) throw new Error("unknown file");
      return `${origin}/${token}/${file.index}/${encodeURIComponent(file.name)}`;
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
