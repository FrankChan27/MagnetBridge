import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { decodeTorrentBuffer } from "./bencode-torrent.ts";
import { PROBE_INFO_HASH, SINTEL_INFO_HASH } from "./fixtures.ts";

describe("decodeTorrentBuffer", () => {
  it("reads the probe torrent", async () => {
    const buf = await readFile("public/fixtures/magnetbridge-probe.torrent");
    const meta = await decodeTorrentBuffer(buf);
    assert.equal(meta.infoHash, PROBE_INFO_HASH);
    assert.equal(meta.files[0]?.name, "magnetbridge-probe.txt");
    assert.equal(meta.pieces.length, 4);
  });

  it("reads the public Sintel torrent", async () => {
    const buf = new Uint8Array(await (await fetch("https://webtorrent.io/torrents/sintel.torrent")).arrayBuffer());
    const meta = await decodeTorrentBuffer(buf);
    assert.equal(meta.infoHash, SINTEL_INFO_HASH);
    assert.ok(meta.files.some((f) => f.name === "Sintel.en.srt"));
    assert.ok(meta.urlList.some((u) => u.includes("webtorrent.io")));
  });
});
