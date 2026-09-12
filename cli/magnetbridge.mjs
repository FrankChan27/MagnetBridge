#!/usr/bin/env node
/**
 * Windows / Linux local entry.
 * Default: Architecture A — magnet → WebTorrent → folder.
 * Opt-in:  --idm starts Architecture D (localhost Range → IDM or simulated client).
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const IDM_PATHS = [
  "C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe",
  "C:\\Program Files\\Internet Download Manager\\IDMan.exe",
];

function detectIdm() {
  if (process.platform !== "win32") return { found: false, path: null };
  for (const candidate of IDM_PATHS) {
    if (existsSync(candidate)) return { found: true, path: candidate };
  }
  return { found: false, path: null };
}

function printHelp() {
  console.log(`MagnetBridge CLI
Usage:
  node cli/magnetbridge.mjs [--out DIR] MAGNET
  node cli/magnetbridge.mjs --idm [--out DIR] [MAGNET]
  node cli/magnetbridge.mjs --simulate-idm [--fixture probe]

Default path is Architecture A (WebTorrent → local files).
--idm is opt-in Architecture D: demand-driven localhost Range → IDM.
Without a real IDMan.exe, --idm falls back to SIMULATED_IDM_CLIENT (not a real IDM PASS).
`);
}

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  printHelp();
  process.exit(0);
}

if (args.includes("--idm") || args.includes("--simulate-idm")) {
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", join(ROOT, "scripts/idm-frontend-bridge.ts"), ...args],
    { stdio: "inherit", cwd: ROOT },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  if (args.length === 0) {
    printHelp();
    process.exit(1);
  }

  const outIndex = args.indexOf("--out");
  const outDir = resolve(outIndex >= 0 ? args[outIndex + 1] : join(homedir(), "Downloads", "MagnetBridge"));
  const magnet = args.filter((a, i) => a !== "--out" && i !== outIndex + 1).join(" ").trim();

  if (!magnet.startsWith("magnet:") && !/^[a-f0-9]{40}$/i.test(magnet)) {
    console.error("Only magnet:? or a 40-char info-hash is accepted. No search.");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const idm = detectIdm();
  console.log(`[idm] found=${idm.found} path=${idm.path ?? "n/a"} q1=REJECTED q2=PARTIAL action=ignored (pass --idm to opt in)`);
  console.log(`[out] ${outDir}`);

  const WebTorrent = (await import("webtorrent")).default;
  const client = new WebTorrent();
  const t0 = Date.now();

  const torrent = client.add(magnet, { path: outDir });
  torrent.on("metadata", () => {
    console.log(`[meta] ${torrent.name} ${torrent.infoHash} files=${torrent.files.length}`);
  });
  const timer = setInterval(() => {
    const pct = torrent.length ? ((torrent.downloaded / torrent.length) * 100).toFixed(1) : "0.0";
    const mbps = (torrent.downloadSpeed / (1024 * 1024)).toFixed(2);
    process.stdout.write(`\r[dl] ${pct}% ${mbps} MB/s peers=${torrent.numPeers}   `);
  }, 500);

  torrent.on("done", () => {
    clearInterval(timer);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n[ok] verified by WebTorrent piece hashes in ${sec}s`);
    for (const file of torrent.files) console.log(`  ${file.path}`);
    client.destroy(() => process.exit(0));
  });

  torrent.on("error", (err) => {
    clearInterval(timer);
    console.error("\n[fail]", err.message || err);
    client.destroy(() => process.exit(1));
  });

  process.on("SIGINT", () => {
    console.log("\n[pause] destroying client; rerun the same magnet to resume in the same --out folder");
    client.destroy(() => process.exit(130));
  });
}
