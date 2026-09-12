/**
 * Architecture D entry: magnet metadata → demand-driven localhost Range → IDM or simulated client.
 * Default Architecture A CLI is cli/magnetbridge.mjs and is unchanged unless --idm is passed.
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { decodeTorrentBuffer } from "../src/lib/magnet/bencode-torrent.ts";
import { DemandPieceStore } from "../src/lib/magnet/piece-store.ts";
import { fetchVerifiedPiece } from "../src/lib/magnet/webseed.ts";
import { sha256Hex } from "../src/lib/magnet/sha1.ts";
import { startRangeServer } from "../src/lib/idm/range-server.ts";
import { launchIdm, detectIdmExe } from "../src/lib/idm/adapter.ts";
import { simulatedIdmDownload } from "../src/lib/idm/simulated-client.ts";
import { IDM_FRONTEND_VERDICT } from "../src/lib/idm/frontend-verdict.ts";
import { LEGAL_FIXTURES } from "../src/lib/magnet/fixtures.ts";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

function argValue(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return fallback;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function loadMeta(fixtureId: string, origin: string) {
  if (fixtureId === "probe") {
    const torrent = new Uint8Array(await readFile(join(ROOT, "public/fixtures/magnetbridge-probe.torrent")));
    return decodeTorrentBuffer(torrent, {
      urlList: [`${origin}/fixtures/magnetbridge-probe.txt`, `file://${join(ROOT, "public/fixtures/magnetbridge-probe.txt")}`],
    });
  }
  const fixture = LEGAL_FIXTURES.find((item) => item.id === fixtureId);
  if (!fixture?.torrentUrl) throw new Error("unknown fixture");
  const url = fixture.torrentUrl.startsWith("http") ? fixture.torrentUrl : `${origin}${fixture.torrentUrl}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`metadata HTTP ${response.status}`);
  return decodeTorrentBuffer(new Uint8Array(await response.arrayBuffer()), { urlList: fixture.magnet.includes("ws=") ? [] : [] });
}

async function waitForFile(path: string, expected: number, timeoutMs: number): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const info = await stat(path);
      if (info.size >= expected) return true;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const args = process.argv.slice(2);
if (hasFlag(args, "-h") || hasFlag(args, "--help")) {
  console.log(`MagnetBridge Architecture D
Usage:
  node --experimental-strip-types scripts/idm-frontend-bridge.ts [--idm|--simulate] [--fixture probe] [--out DIR] [--report FILE]

--simulate  SIMULATED_IDM_CLIENT (default on non-Windows)
--idm       try real IDMan.exe (Windows). Never claimed PASS from simulate.
`);
  process.exit(0);
}

const wantIdm = hasFlag(args, "--idm");
const forceSim = hasFlag(args, "--simulate") || !wantIdm;
const fixtureId = argValue(args, "--fixture", "probe") ?? "probe";
const outDir = resolve(argValue(args, "--out", join(homedir(), "Downloads", "MagnetBridge-idm"))!);
const reportPath = resolve(argValue(args, "--report", join(ROOT, "docs", "architecture-d-windows-result.json"))!);
await mkdir(outDir, { recursive: true });

const origin = "https://webtorrent.io";
const meta = await loadMeta(fixtureId, fixtureId === "probe" ? `file://${join(ROOT, "public")}` : origin);
const file = meta.files[0];
if (!file) throw new Error("no files");

const store = new DemandPieceStore(meta, async (index, signal) => {
  if (fixtureId === "probe") {
    const payload = new Uint8Array(await readFile(join(ROOT, "public/fixtures/magnetbridge-probe.txt")));
    const start = index * meta.pieceLength;
    const end = Math.min(payload.byteLength, start + meta.pieceLength);
    return payload.subarray(start, end);
  }
  return fetchVerifiedPiece(meta, index, origin, signal);
});

const server = await startRangeServer({ store, files: [0] });
const url = server.urlFor(0);
const dest = join(outDir, file.name);
const idm = detectIdmExe();

const report: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  architecture: "D",
  q1: "REJECTED",
  q2: IDM_FRONTEND_VERDICT.status,
  qualifier: IDM_FRONTEND_VERDICT.qualifier,
  fixture: fixtureId,
  infoHash: meta.infoHash,
  url,
  localhostOnly: true,
  tokenized: true,
  out: dest,
  idmDetected: idm,
  prefetchBeforeHttp: store.verified.size === 0,
};

console.log(`[d] metadata ${meta.name} hash=${meta.infoHash} pieces=${meta.pieces.length}`);
console.log(`[d] range ${url}`);
console.log(`[d] pieces in store before first HTTP: ${store.verified.size}`);

try {
  if (wantIdm && idm.found) {
    const launch = launchIdm({ url, localPath: outDir, fileName: file.name, silent: true });
    report.client = "REAL_IDM";
    report.launch = launch;
    console.log(`[d] launched IDM spawned=${launch.spawned}`);
    const ok = await waitForFile(dest, file.length, 120_000);
    report.idmFileAppeared = ok;
    if (ok) {
      const bytes = new Uint8Array(await readFile(dest));
      report.sha256 = await sha256Hex(bytes);
      report.bytes = bytes.byteLength;
    }
    report.verdict = ok ? "PARTIAL — real IDM wrote a file; inspect sha256 and IDM UI" : "BLOCKED — IDM did not finish in time";
  } else {
    report.client = "SIMULATED_IDM_CLIENT";
    if (wantIdm && !idm.found) {
      report.note = "IDMan.exe not found. Falling back to SIMULATED_IDM_CLIENT. This is not a real IDM PASS.";
    }
    const result = await simulatedIdmDownload({ url, outPath: dest, mode: "multi" });
    const bytes = new Uint8Array(await readFile(dest));
    report.simulated = result;
    report.sha256 = await sha256Hex(bytes);
    report.bytes = bytes.byteLength;
    report.verdict = "PARTIAL — WINDOWS_IDM_E2E_REQUIRED";
  }
  report.store = store.stats;
  report.http = server.stats;
  report.prefetchedAllBeforeServe = store.prefetchAllBeforeServe();
} finally {
  await server.close();
}

if (reportPath) {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[d] report ${reportPath}`);
}
console.log(`[d] verdict ${report.verdict} client=${report.client}`);
if (existsSync(dest)) console.log(`[d] file ${dest}`);
