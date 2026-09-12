import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sha1Hex } from "./sha1.ts";
import { DemandPieceStore } from "./piece-store.ts";
import type { ParsedMetadata } from "./types.ts";

async function fixture(): Promise<{ meta: ParsedMetadata; pieces: Uint8Array[] }> {
  const raw = [
    new Uint8Array(100).fill(1),
    new Uint8Array(100).fill(2),
    new Uint8Array(50).fill(3),
  ];
  const hashes = await Promise.all(raw.map((bytes) => sha1Hex(bytes)));
  const meta: ParsedMetadata = {
    infoHash: "ff".repeat(20),
    name: "pack",
    announce: [],
    urlList: [],
    pieceLength: 100,
    lastPieceLength: 50,
    pieces: hashes,
    length: 250,
    torrentFile: null,
    files: [
      { index: 0, path: "pack/a.txt", name: "a.txt", length: 80, offset: 0, selected: true },
      { index: 1, path: "pack/b.txt", name: "b.txt", length: 170, offset: 80, selected: true },
    ],
  };
  return { meta, pieces: raw };
}

describe("DemandPieceStore", () => {
  it("fetches only pieces demanded by the range, after hash verify", async () => {
    const { meta, pieces } = await fixture();
    const fetched: number[] = [];
    const store = new DemandPieceStore(meta, async (index) => {
      fetched.push(index);
      await new Promise((r) => setTimeout(r, 5));
      return pieces[index]!;
    });
    const tail = await store.readFileRange(1, 160, 170);
    assert.deepEqual([...tail], Array(10).fill(3));
    assert.deepEqual(fetched, [2]);
    assert.equal(store.prefetchAllBeforeServe(), false);
    assert.equal(store.verified.size, 1);
  });

  it("serves overlapping concurrent ranges from the same verified piece", async () => {
    const { meta, pieces } = await fixture();
    let calls = 0;
    const store = new DemandPieceStore(meta, async (index) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 15));
      return pieces[index]!;
    });
    const [a, b] = await Promise.all([
      store.readFileRange(0, 0, 40),
      store.readFileRange(0, 20, 80),
    ]);
    assert.equal(a.byteLength, 40);
    assert.equal(b.byteLength, 60);
    assert.equal(calls, 1);
    assert.equal(store.verified.size, 1);
  });

  it("never returns a piece that fails SHA-1", async () => {
    const { meta, pieces } = await fixture();
    const store = new DemandPieceStore(meta, async () => {
      const bad = new Uint8Array(pieces[0]!);
      bad[0] = 9;
      return bad;
    });
    await assert.rejects(() => store.readFileRange(0, 0, 10), /hash failed/);
    assert.equal(store.verified.size, 0);
  });
});
