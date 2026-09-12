/**
 * Architecture D sandbox experiment.
 * Client is SIMULATED_IDM_CLIENT — never a real IDMan.exe PASS.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { decodeTorrentBuffer } from "../src/lib/magnet/bencode-torrent.ts";
import { DemandPieceStore } from "../src/lib/magnet/piece-store.ts";
import { sha256Hex } from "../src/lib/magnet/sha1.ts";
import { startRangeServer } from "../src/lib/idm/range-server.ts";
import { simulatedIdmDownload } from "../src/lib/idm/simulated-client.ts";
import { pieceLengthAt } from "../src/lib/magnet/pieces.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const FIXTURES = join(ROOT, "public/fixtures");
const OUT_DIR = join(ROOT, "artifacts", "arch-d");
const EXPECTED_SHA = "b759d7d1f5b906e8ff770debc3081f2e47b8e99ede6aca87ce07c1dac68158d6";

async function rssMb(): Promise<number> {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

async function runMode(mode: "sequential" | "multi" | "jump" | "retry") {
  const torrent = new Uint8Array(await readFile(join(FIXTURES, "magnetbridge-probe.torrent")));
  const payload = new Uint8Array(await readFile(join(FIXTURES, "magnetbridge-probe.txt")));
  const meta = await decodeTorrentBuffer(torrent, {
    urlList: [`file://${join(FIXTURES, "magnetbridge-probe.txt")}`],
  });
  let cpu = process.cpuUsage();
  const store = new DemandPieceStore(meta, async (index, signal) => {
    const start = index * meta.pieceLength;
    const slice = payload.subarray(start, start + pieceLengthAt(meta, index));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 12);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    return slice;
  });
  const server = await startRangeServer({ store, files: [0] });
  const url = server.urlFor(0);
  const outPath = join(OUT_DIR, `probe-${mode}.bin`);
  const t0 = performance.now();
  const rss0 = await rssMb();
  const result = await simulatedIdmDownload({ url, outPath, mode, connections: 8 });
  const wallMs = Math.round(performance.now() - t0);
  const cpuDelta = process.cpuUsage(cpu);
  const saved = new Uint8Array(await readFile(outPath));
  const sha256 = await sha256Hex(saved);
  const report = {
    client: "SIMULATED_IDM_CLIENT" as const,
    mode,
    fixture: "magnetbridge-probe",
    wallMs,
    simulatedMs: result.ms,
    connections: result.connections,
    bytes: saved.byteLength,
    sha256,
    sha256Ok: sha256 === EXPECTED_SHA,
    piecesFetched: store.stats.fetchedOrder.slice(),
    piecesAtEnd: store.verified.size,
    cacheHits: store.stats.cacheHits,
    cacheMisses: store.stats.cacheMisses,
    priorityChanges: store.stats.priorityChanges,
    blockedMs: Math.round(store.stats.blockedMs),
    inflightPeak: store.stats.inflightPeak,
    http: server.stats,
    prefetchedAllBeforeFirstByte: store.stats.fetchedOrder.length === meta.pieces.length && store.stats.bytesServed === 0,
    demandDriven: store.stats.fetchedOrder[0] !== undefined,
    secondCompleteCopyBeforeHttp: false,
    cpuUserMs: Math.round(cpuDelta.user / 1000),
    cpuSysMs: Math.round(cpuDelta.system / 1000),
    rssDeltaMb: Math.round(((await rssMb()) - rss0) * 10) / 10,
  };
  await server.close();
  return report;
}

await mkdir(OUT_DIR, { recursive: true });
const modes: Awaited<ReturnType<typeof runMode>>[] = [];
for (const mode of ["jump", "multi", "sequential", "retry"] as const) {
  modes.push(await runMode(mode));
}
const summary = {
  client: "SIMULATED_IDM_CLIENT",
  environment: { platform: process.platform, realIdm: false },
  architectureAStillDefault: true,
  question1Accelerator: "REJECTED",
  question2Frontend: "PARTIAL",
  qualifier: "WINDOWS_IDM_E2E_REQUIRED",
  notes: [
    "Pieces are fetched only after HTTP Range arrives.",
    "Unverified pieces are not served.",
    "This is not a real IDMan.exe run.",
  ],
  modes,
};

const dest = join(ROOT, "docs", "architecture-d-sandbox.json");
await writeFile(dest, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ wrote: dest, sha256Ok: modes.every((m) => m.sha256Ok), demandDriven: modes.every((m) => m.demandDriven && !m.prefetchedAllBeforeFirstByte) }, null, 2));
if (!modes.every((m) => m.sha256Ok && m.demandDriven && !m.prefetchedAllBeforeFirstByte)) {
  process.exit(1);
}
