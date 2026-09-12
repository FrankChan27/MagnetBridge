import type { ParsedMetadata, TorrentFileInfo } from "./types.ts";

export type FileSlice = {
  fileIndex: number;
  fileOffset: number;
  length: number;
  pieceOffset: number;
};

export function pieceLengthAt(meta: ParsedMetadata, index: number): number {
  if (index < 0 || index >= meta.pieces.length) return 0;
  if (index === meta.pieces.length - 1) return meta.lastPieceLength;
  return meta.pieceLength;
}

export function slicesForPiece(meta: ParsedMetadata, pieceIndex: number): FileSlice[] {
  const start = pieceIndex * meta.pieceLength;
  const end = start + pieceLengthAt(meta, pieceIndex);
  const slices: FileSlice[] = [];
  for (const file of meta.files) {
    const fileStart = file.offset;
    const fileEnd = file.offset + file.length;
    const overlapStart = Math.max(start, fileStart);
    const overlapEnd = Math.min(end, fileEnd);
    if (overlapEnd <= overlapStart) continue;
    slices.push({
      fileIndex: file.index,
      fileOffset: overlapStart - fileStart,
      length: overlapEnd - overlapStart,
      pieceOffset: overlapStart - start,
    });
  }
  return slices;
}

export function piecesForFiles(meta: ParsedMetadata, fileIndices: number[]): number[] {
  const needed = new Set<number>();
  for (const index of fileIndices) {
    const file = meta.files[index];
    if (!file || file.length <= 0) continue;
    const first = Math.floor(file.offset / meta.pieceLength);
    const last = Math.floor((file.offset + file.length - 1) / meta.pieceLength);
    for (let i = first; i <= last; i += 1) needed.add(i);
  }
  return [...needed].sort((a, b) => a - b);
}

export function selectedLength(files: TorrentFileInfo[], selected: number[]): number {
  return selected.reduce((sum, index) => sum + (files[index]?.length ?? 0), 0);
}

export function isMultiFile(meta: ParsedMetadata): boolean {
  return meta.files.length > 1;
}
