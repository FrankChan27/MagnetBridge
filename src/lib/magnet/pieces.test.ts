import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { piecesForFiles, slicesForPiece } from "./pieces.ts";
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

describe("piece mapping", () => {
  it("maps a piece across two files", () => {
    const first = slicesForPiece(meta, 0);
    assert.equal(first.length, 2);
    assert.equal(first[0]?.fileIndex, 0);
    assert.equal(first[0]?.length, 80);
    assert.equal(first[1]?.fileIndex, 1);
    assert.equal(first[1]?.length, 20);
  });

  it("selects only pieces overlapping chosen files", () => {
    assert.deepEqual(piecesForFiles(meta, [0]), [0]);
    assert.deepEqual(piecesForFiles(meta, [1]), [0, 1, 2]);
  });
});
