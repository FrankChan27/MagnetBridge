import type { ParsedMetadata } from "./types.ts";
import { pieceLengthAt } from "./pieces.ts";

/** Inclusive-start, exclusive-end file-relative byte range. */
export type ByteRange = {
  start: number;
  end: number;
};

export type FileRangeSlice = {
  pieceIndex: number;
  pieceOffset: number;
  fileOffset: number;
  length: number;
};

export function parseRangeHeader(
  header: string | undefined,
  size: number,
): ByteRange | "full" | "unsatisfiable" {
  if (size <= 0) return "unsatisfiable";
  if (!header || !header.trim()) return "full";
  const raw = header.trim();
  const first = raw.split(",")[0]?.trim() ?? raw;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(first);
  if (!match) return "unsatisfiable";
  const startStr = match[1] ?? "";
  const endStr = match[2] ?? "";
  if (startStr === "" && endStr === "") return "unsatisfiable";
  if (startStr === "") {
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size };
  }
  const start = Number(startStr);
  if (!Number.isFinite(start) || start < 0 || start >= size) return "unsatisfiable";
  const endInclusive = endStr === "" ? size - 1 : Number(endStr);
  if (!Number.isFinite(endInclusive) || endInclusive < start) return "unsatisfiable";
  return { start, end: Math.min(size, endInclusive + 1) };
}

export function piecesForFileRange(
  meta: ParsedMetadata,
  fileIndex: number,
  start: number,
  end: number,
): number[] {
  const file = meta.files[fileIndex];
  if (!file || file.length <= 0 || end <= start) return [];
  const lo = Math.max(0, start);
  const hi = Math.min(file.length, end);
  if (hi <= lo) return [];
  const torrentStart = file.offset + lo;
  const torrentEnd = file.offset + hi;
  const first = Math.floor(torrentStart / meta.pieceLength);
  const last = Math.floor((torrentEnd - 1) / meta.pieceLength);
  const out: number[] = [];
  for (let i = first; i <= last; i += 1) {
    if (i >= 0 && i < meta.pieces.length) out.push(i);
  }
  return out;
}

export function slicesForFileRange(
  meta: ParsedMetadata,
  fileIndex: number,
  start: number,
  end: number,
): FileRangeSlice[] {
  const file = meta.files[fileIndex];
  if (!file) return [];
  const slices: FileRangeSlice[] = [];
  for (const pieceIndex of piecesForFileRange(meta, fileIndex, start, end)) {
    const pieceStart = pieceIndex * meta.pieceLength;
    const pieceEnd = pieceStart + pieceLengthAt(meta, pieceIndex);
    const fileStart = file.offset;
    const overlapStart = Math.max(pieceStart, fileStart + start);
    const overlapEnd = Math.min(pieceEnd, fileStart + end);
    if (overlapEnd <= overlapStart) continue;
    slices.push({
      pieceIndex,
      pieceOffset: overlapStart - pieceStart,
      fileOffset: overlapStart - fileStart,
      length: overlapEnd - overlapStart,
    });
  }
  return slices;
}

export function copyFileRangeFromPieces(
  meta: ParsedMetadata,
  fileIndex: number,
  start: number,
  end: number,
  pieces: Map<number, Uint8Array>,
): Uint8Array {
  const length = Math.max(0, end - start);
  const out = new Uint8Array(length);
  for (const slice of slicesForFileRange(meta, fileIndex, start, end)) {
    const piece = pieces.get(slice.pieceIndex);
    if (!piece) throw new Error(`missing verified piece ${slice.pieceIndex}`);
    out.set(
      piece.subarray(slice.pieceOffset, slice.pieceOffset + slice.length),
      slice.fileOffset - start,
    );
  }
  return out;
}
