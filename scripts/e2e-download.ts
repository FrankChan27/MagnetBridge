#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { metadataFromTorrentFile } from "../src/lib/magnet/metadata.ts";
import { downloadViaWebSeed } from "../src/lib/magnet/webseed.ts";
import { extractSelectedFiles } from "../src/lib/magnet/assemble.ts";
import { parseMagnetInput } from "../src/lib/magnet/parse.ts";
import { SINTEL_INFO_HASH } from "../src/lib/magnet/fixtures.ts";

type Recorded = {
  name: string;
  infoHash: string;
  selected: string[];
  bytes: number;
  ms: number;
  mbps: number;
  verifiedPieces: number;
  sha256: string[];
  engine: "webseed";
};

function serveDir(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const path = decodeURIComponent(req.url ?? "/").split("?")[0] ?? "/";
      const file = join(root, path);
      if (!file.startsWith(root)) {
        res.statusCode = 403;
        res.end();
        return;
      }
      const data = await readFile(file);
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        if (!m) {
          res.statusCode = 416;
          res.end();
          return;
        }
        const start = Number(m[1]);
        const end = m[2] ? Number(m[2]) : data.length - 1;
        res.writeHead(206, {
          "content-range": `bytes ${start}-${end}/${data.length}`,
          "content-length": end - start + 1,
          "accept-ranges": "bytes",
          "access-control-allow-origin": "*",
        });
        res.end(data.subarray(start, end + 1));
        return;
      }
      res.writeHead(200, {
        "content-length": data.length,
        "accept-ranges": "bytes",
        "access-control-allow-origin": "*",
      });
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end("missing");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

async function runCase(name: string, torrentUrl: string, selectNames: string[] | null, origin: string) {
  const t0 = performance.now();
  const buf = new Uint8Array(await (await fetch(torrentUrl)).arrayBuffer());
  const meta = await metadataFromTorrentFile(buf);
  const selected = selectNames
    ? meta.files.filter((f) => selectNames.includes(f.name)).map((f) => f.index)
    : meta.files.map((f) => f.index);
  const pieces = new Map<number, Uint8Array>();
  const result = await downloadViaWebSeed({
    meta,
    selected,
    origin,
    concurrency: 4,
    onPiece: ({ index, bytes }) => {
      pieces.set(index, bytes);
    },
  });
  const files = extractSelectedFiles(meta, selected, pieces);
  const ms = performance.now() - t0;
  const bytes = files.reduce((sum, f) => sum + f.data.byteLength, 0);
  const rec: Recorded = {
    name,
    infoHash: meta.infoHash,
    selected: files.map((f) => f.name),
    bytes,
    ms: Math.round(ms),
    mbps: Number((bytes / (1024 * 1024) / (ms / 1000)).toFixed(3)),
    verifiedPieces: result.verifiedPieces,
    sha256: files.map((f) => createHash("sha256").update(f.data).digest("hex")),
    engine: "webseed",
  };
  return rec;
}

const probeRoot = join(process.cwd(), "public");
const server = await serveDir(probeRoot);
const reports: Recorded[] = [];
try {
  reports.push(
    await runCase(
      "probe-self-host",
      `${server.url}/fixtures/magnetbridge-probe.torrent`,
      ["magnetbridge-probe.txt"],
      server.url,
    ),
  );
  const probeMagnet = parseMagnetInput(
    "magnet:?xt=urn:btih:f4beee6ffe97185e2753fc987ade8cb8a066f46c&dn=magnetbridge-probe.txt",
  );
  if (reports[0] && reports[0].infoHash !== probeMagnet.infoHash) {
    throw new Error("probe info-hash mismatch");
  }

  reports.push(
    await runCase(
      "sintel-en-srt-public",
      "https://webtorrent.io/torrents/sintel.torrent",
      ["Sintel.en.srt"],
      "https://webtorrent.io",
    ),
  );
  if (reports[1] && reports[1].infoHash !== SINTEL_INFO_HASH) {
    throw new Error("sintel info-hash mismatch");
  }
} finally {
  await server.close();
}

const { writeFile, mkdir } = await import("node:fs/promises");
await mkdir("/workspace/docs", { recursive: true });
await writeFile("/workspace/docs/e2e-results.json", JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports, null, 2));
