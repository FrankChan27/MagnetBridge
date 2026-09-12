import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bencode from "bencode";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public", "fixtures");
mkdirSync(publicDir, { recursive: true });

const header = `MagnetBridge probe file
License: CC0-1.0
Purpose: verify magnet -> metadata -> piece hash -> local file.
`;
const pad = Buffer.alloc(48 * 1024, 0);
for (let i = 0; i < pad.length; i += 1) pad[i] = i % 251;
const content = Buffer.concat([Buffer.from(header, "utf8"), pad]);

const pieceLength = 16 * 1024;
const pieces = [];
for (let offset = 0; offset < content.length; offset += pieceLength) {
  const slice = content.subarray(offset, offset + pieceLength);
  pieces.push(createHash("sha1").update(slice).digest());
}

const info = {
  length: content.length,
  name: "magnetbridge-probe.txt",
  "piece length": pieceLength,
  pieces: Buffer.concat(pieces),
};
const infoEncoded = bencode.encode(info);
const infoHash = createHash("sha1").update(infoEncoded).digest("hex");
const torrent = bencode.encode({
  announce: "wss://tracker.openwebtorrent.com",
  comment: "MagnetBridge self-hosted CC0 probe",
  info,
  "url-list": ["/fixtures/magnetbridge-probe.txt"],
});

writeFileSync(join(publicDir, "magnetbridge-probe.txt"), content);
writeFileSync(join(publicDir, "magnetbridge-probe.torrent"), torrent);

const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=magnetbridge-probe.txt&ws=/fixtures/magnetbridge-probe.txt&xs=/fixtures/magnetbridge-probe.torrent`;

const meta = {
  name: "magnetbridge-probe.txt",
  infoHash,
  length: content.length,
  pieceLength,
  pieceCount: pieces.length,
  sha256: createHash("sha256").update(content).digest("hex"),
  magnet,
};
writeFileSync(join(publicDir, "magnetbridge-probe.json"), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
