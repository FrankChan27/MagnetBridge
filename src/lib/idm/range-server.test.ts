import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sha1Hex } from "../magnet/sha1.ts";
import { DemandPieceStore } from "../magnet/piece-store.ts";
import type { ParsedMetadata } from "../magnet/types.ts";
import { startRangeServer } from "./range-server.ts";

async function liveServer() {
  const p0 = new Uint8Array(100).fill(7);
  const p1 = new Uint8Array(20).fill(8);
  const meta: ParsedMetadata = {
    infoHash: "aa".repeat(20),
    name: "probe.bin",
    announce: [],
    urlList: [],
    pieceLength: 100,
    lastPieceLength: 20,
    pieces: [await sha1Hex(p0), await sha1Hex(p1)],
    length: 120,
    torrentFile: null,
    files: [{ index: 0, path: "probe.bin", name: "probe.bin", length: 120, offset: 0, selected: true }],
  };
  const pieces = [p0, p1];
  const store = new DemandPieceStore(meta, async (index, signal) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 8);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    return pieces[index]!;
  });
  const server = await startRangeServer({ store, files: [0] });
  return { server, store, p0, p1 };
}

describe("localhost Range server", () => {
  it("answers HEAD, GET Range 206, and refuses a bad token", async () => {
    const { server, store } = await liveServer();
    try {
      const url = server.urlFor(0);
      const head = await fetch(url, { method: "HEAD" });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get("accept-ranges"), "bytes");
      assert.equal(head.headers.get("content-length"), "120");
      assert.equal(store.verified.size, 0);

      const part = await fetch(url, { headers: { Range: "bytes=100-119" } });
      assert.equal(part.status, 206);
      assert.equal(part.headers.get("content-range"), "bytes 100-119/120");
      const bytes = new Uint8Array(await part.arrayBuffer());
      assert.equal(bytes.byteLength, 20);
      assert.equal(bytes[0], 8);
      assert.deepEqual(store.stats.fetchedOrder, [1]);
      assert.equal(store.prefetchAllBeforeServe(), false);

      const bad = await fetch(url.replace(server.token, "nope"));
      assert.equal(bad.status, 404);

      const miss = await fetch(url, { headers: { Range: "bytes=500-600" } });
      assert.equal(miss.status, 416);
    } finally {
      await server.close();
    }
  });

  it("handles concurrent ranges and client abort without serving garbage", async () => {
    const { server } = await liveServer();
    try {
      const url = server.urlFor(0);
      const a = fetch(url, { headers: { Range: "bytes=0-49" } });
      const b = fetch(url, { headers: { Range: "bytes=50-119" } });
      const controller = new AbortController();
      const c = fetch(url, { headers: { Range: "bytes=0-119" }, signal: controller.signal }).then(
        () => undefined,
        () => undefined,
      );
      controller.abort();
      const [ra, rb] = await Promise.all([a, b]);
      await c;
      assert.equal(ra.status, 206);
      assert.equal(rb.status, 206);
      const left = new Uint8Array(await ra.arrayBuffer());
      const right = new Uint8Array(await rb.arrayBuffer());
      assert.equal(left.every((n) => n === 7), true);
      assert.equal(right[0], 7);
      assert.equal(right.at(-1), 8);
    } finally {
      await server.close();
    }
  });
});
