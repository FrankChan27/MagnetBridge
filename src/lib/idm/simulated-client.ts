import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type SimulatedIdmMode = "sequential" | "multi" | "jump" | "retry";

export type SimulatedIdmResult = {
  client: "SIMULATED_IDM_CLIENT";
  mode: SimulatedIdmMode;
  bytes: number;
  connections: number;
  ms: number;
  path: string;
};

async function fetchRange(url: string, start: number, endInclusive: number, signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${endInclusive}` },
    signal,
  });
  if (response.status !== 206 && response.status !== 200) {
    throw new Error(`simulated IDM HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function headLength(url: string): Promise<number> {
  const response = await fetch(url, { method: "HEAD" });
  if (!response.ok) throw new Error(`HEAD ${response.status}`);
  const length = Number(response.headers.get("content-length"));
  if (!Number.isFinite(length) || length < 0) throw new Error("missing Content-Length");
  if (response.headers.get("accept-ranges")?.toLowerCase() !== "bytes") {
    throw new Error("server did not advertise Accept-Ranges: bytes");
  }
  return length;
}

export async function simulatedIdmDownload(options: {
  url: string;
  outPath: string;
  mode?: SimulatedIdmMode;
  connections?: number;
}): Promise<SimulatedIdmResult> {
  const mode = options.mode ?? "multi";
  const t0 = performance.now();
  const size = await headLength(options.url);
  await mkdir(dirname(options.outPath), { recursive: true });
  const file = new Uint8Array(size);
  let connections = 1;

  if (mode === "sequential") {
    const body = await fetch(options.url);
    file.set(new Uint8Array(await body.arrayBuffer()), 0);
  } else if (mode === "jump") {
    connections = 2;
    const mid = Math.floor(size / 2);
    const tail = await fetchRange(options.url, mid, size - 1);
    const head = await fetchRange(options.url, 0, mid - 1);
    file.set(head, 0);
    file.set(tail, mid);
  } else if (mode === "retry") {
    connections = 2;
    const controller = new AbortController();
    const first = fetchRange(options.url, 0, size - 1, controller.signal);
    setTimeout(() => controller.abort(), 5);
    await first.catch(() => undefined);
    const again = await fetchRange(options.url, 0, size - 1);
    file.set(again, 0);
  } else {
    connections = Math.max(2, options.connections ?? 8);
    const chunk = Math.ceil(size / connections);
    await Promise.all(
      Array.from({ length: connections }, async (_, i) => {
        const start = i * chunk;
        if (start >= size) return;
        const end = Math.min(size, start + chunk) - 1;
        const bytes = await fetchRange(options.url, start, end);
        file.set(bytes, start);
      }),
    );
  }

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(options.outPath);
    stream.on("error", reject);
    stream.on("finish", resolve);
    stream.end(Buffer.from(file));
  });

  return {
    client: "SIMULATED_IDM_CLIENT",
    mode,
    bytes: size,
    connections,
    ms: Math.round(performance.now() - t0),
    path: options.outPath,
  };
}
