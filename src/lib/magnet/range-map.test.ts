import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRangeHeader, piecesForFileRange, slicesForFileRange } from "./range-map.ts";
import type { ParsedMetadata } from "./types.ts";

const meta: ParsedMetadata = {
  infoHash: "00".repeat(20),
  name: "pack",
  announce: [],
  urlList: [],
  pieceLength: 100,
  lastPieceLength: 50,
  pieces: ["a", "b", "c"],
  length: 250,
  torrentFile: null,
  files: [
    { index: 0, path: "pack/a.txt", name: "a.txt", length: 80, offset: 0, selected: true },
    { index: 1, path: "pack/b.txt", name: "b.txt", length: 170, offset: 80, selected: true },
  ],
};

describe("parseRangeHeader", () => {
  it("treats missing header as full", () => {
    assert.equal(parseRangeHeader(undefined, 100), "full");
  });
  it("parses closed, open, and suffix ranges", () => {
    assert.deepEqual(parseRangeHeader("bytes=0-49", 100), { start: 0, end: 50 });
    assert.deepEqual(parseRangeHeader("bytes=50-", 100), { start: 50, end: 100 });
    assert.deepEqual(parseRangeHeader("bytes=-10", 100), { start: 90, end: 100 });
  });
  it("returns 416-class unsatisfiable for bad ranges", () => {
    assert.equal(parseRangeHeader("bytes=100-200", 100), "unsatisfiable");
    assert.equal(parseRangeHeader("bytes=5-1", 100), "unsatisfiable");
  });
});

describe("file range → pieces", () => {
  it("maps a range that stays inside one piece", () => {
    assert.deepEqual(piecesForFileRange(meta, 1, 0, 10), [0]);
  });
  it("maps a range that crosses a piece and a file boundary", () => {
    assert.deepEqual(piecesForFileRange(meta, 1, 0, 30), [0, 1]);
  });
  it("maps a tail jump to the last piece", () => {
    assert.deepEqual(piecesForFileRange(meta, 1, 160, 170), [2]);
  });
  it("emits slices that stay inside the requested file range", () => {
    const slices = slicesForFileRange(meta, 1, 15, 40);
    assert.equal(slices[0]?.pieceIndex, 0);
    assert.equal(slices[0]?.fileOffset, 15);
    assert.equal(slices.at(-1)?.pieceIndex, 1);
  });
});
