import type { ParsedMetadata } from "./types.ts";
import { pieceLengthAt, slicesForPiece } from "./pieces.ts";
import { sanitizeRelativePath } from "./sanitize.ts";

export type FileBuffer = {
  path: string;
  name: string;
  data: Uint8Array;
};

export function extractSelectedFiles(
  meta: ParsedMetadata,
  selected: number[],
  pieces: Map<number, Uint8Array>,
): FileBuffer[] {
  const files: FileBuffer[] = [];
  for (const index of selected) {
    const file = meta.files[index];
    if (!file) continue;
    const data = new Uint8Array(file.length);
    const first = Math.floor(file.offset / meta.pieceLength);
    const last = Math.floor((file.offset + Math.max(file.length, 1) - 1) / meta.pieceLength);
    for (let pieceIndex = first; pieceIndex <= last; pieceIndex += 1) {
      const piece = pieces.get(pieceIndex);
      if (!piece) throw new Error(`缺少分片 ${pieceIndex}`);
      const slices = slicesForPiece(meta, pieceIndex).filter((s) => s.fileIndex === index);
      for (const slice of slices) {
        data.set(
          piece.subarray(slice.pieceOffset, slice.pieceOffset + slice.length),
          slice.fileOffset,
        );
      }
    }
    files.push({
      path: sanitizeRelativePath(file.path),
      name: file.name,
      data,
    });
  }
  return files;
}

export function pieceByteLength(meta: ParsedMetadata, index: number): number {
  return pieceLengthAt(meta, index);
}
