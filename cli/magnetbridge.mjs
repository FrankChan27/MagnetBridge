#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

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

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Usage: node cli/magnetbridge.mjs [--out DIR] MAGNET");
  process.exit(1);
}
const outIndex = args.indexOf("--out");
const outDir = resolve(outIndex >= 0 ? args[outIndex + 1] : join(homedir(), "Downloads", "MagnetBridge"));
const magnet = args.filter((a, i) => a !== "--out" && i !== outIndex + 1).join(" ").trim();
mkdirSync(outDir, { recursive: true });
const idm = detectIdm();
console.log(`[idm] found=${idm.found} path=${idm.path ?? "n/a"} action=ignored verdict=REJECTED`);
const WebTorrent = (await import("webtorrent")).default;
const client = new WebTorrent();
const torrent = client.add(magnet, { path: outDir });
torrent.on("done", () => {
  console.log("[ok]", torrent.name);
  client.destroy(() => process.exit(0));
});
torrent.on("error", (err) => {
  console.error(err);
  client.destroy(() => process.exit(1));
});
