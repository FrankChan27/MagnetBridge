import { sha1Hex } from "./sha1.ts";
import { pieceLengthAt } from "./pieces.ts";
import { copyFileRangeFromPieces, piecesForFileRange, slicesForFileRange } from "./range-map.ts";
import type { ParsedMetadata } from "./types.ts";

export type PieceFetcher = (index: number, signal?: AbortSignal) => Promise<Uint8Array>;

export type PieceStoreStats = {
  requestedOrder: number[];
  fetchedOrder: number[];
  cacheHits: number;
  cacheMisses: number;
  priorityChanges: number;
  blockedMs: number;
  bytesServed: number;
  inflightPeak: number;
};

export class DemandPieceStore {
  readonly meta: ParsedMetadata;
  readonly verified = new Map<number, Uint8Array>();
  private readonly inflight = new Map<number, Promise<Uint8Array>>();
  private readonly priority = new Map<number, number>();
  private readonly fetcher: PieceFetcher;
  readonly stats: PieceStoreStats = {
    requestedOrder: [],
    fetchedOrder: [],
    cacheHits: 0,
    cacheMisses: 0,
    priorityChanges: 0,
    blockedMs: 0,
    bytesServed: 0,
    inflightPeak: 0,
  };

  constructor(meta: ParsedMetadata, fetcher: PieceFetcher) {
    this.meta = meta;
    this.fetcher = fetcher;
  }

  has(index: number): boolean {
    return this.verified.has(index);
  }

  bumpPriority(indices: number[]): void {
    for (const index of indices) {
      const next = (this.priority.get(index) ?? 0) + 1;
      this.priority.set(index, next);
      this.stats.priorityChanges += 1;
    }
  }

  hottestMissing(limit = 8): number[] {
    return [...this.priority.entries()]
      .filter(([index]) => !this.verified.has(index))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([index]) => index);
  }

  async ensure(indices: number[], signal?: AbortSignal): Promise<void> {
    const unique = [...new Set(indices)].sort((a, b) => a - b);
    this.bumpPriority(unique);
    await Promise.all(unique.map((index) => this.ensureOne(index, signal)));
  }

  private async ensureOne(index: number, signal?: AbortSignal): Promise<Uint8Array> {
    const cached = this.verified.get(index);
    if (cached) {
      this.stats.cacheHits += 1;
      return cached;
    }
    this.stats.cacheMisses += 1;
    this.stats.requestedOrder.push(index);
    const pending = this.inflight.get(index);
    if (pending) return pending;
    const work = this.fetchAndVerify(index, signal);
    this.inflight.set(index, work);
    this.stats.inflightPeak = Math.max(this.stats.inflightPeak, this.inflight.size);
    try {
      return await work;
    } finally {
      this.inflight.delete(index);
    }
  }

  private async fetchAndVerify(index: number, signal?: AbortSignal): Promise<Uint8Array> {
    const t0 = performance.now();
    const bytes = await this.fetcher(index, signal);
    this.stats.blockedMs += performance.now() - t0;
    if (bytes.byteLength !== pieceLengthAt(this.meta, index)) {
      throw new Error(`piece ${index} length mismatch`);
    }
    const digest = await sha1Hex(bytes);
    if (digest !== this.meta.pieces[index]) {
      throw new Error(`piece ${index} hash failed`);
    }
    const copy = new Uint8Array(bytes);
    this.verified.set(index, copy);
    this.stats.fetchedOrder.push(index);
    return copy;
  }

  async readFileRange(
    fileIndex: number,
    start: number,
    end: number,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    const needed = piecesForFileRange(this.meta, fileIndex, start, end);
    await this.ensure(needed, signal);
    const bytes = copyFileRangeFromPieces(this.meta, fileIndex, start, end, this.verified);
    this.stats.bytesServed += bytes.byteLength;
    return bytes;
  }

  async *streamFileRange(
    fileIndex: number,
    start: number,
    end: number,
    signal?: AbortSignal,
  ): AsyncGenerator<Uint8Array> {
    this.bumpPriority(piecesForFileRange(this.meta, fileIndex, start, end));
    for (const slice of slicesForFileRange(this.meta, fileIndex, start, end)) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const piece = await this.ensureOne(slice.pieceIndex, signal);
      const chunk = piece.subarray(slice.pieceOffset, slice.pieceOffset + slice.length);
      this.stats.bytesServed += chunk.byteLength;
      yield chunk;
    }
  }

  prefetchAllBeforeServe(): boolean {
    return this.stats.fetchedOrder.length === this.meta.pieces.length && this.stats.bytesServed === 0;
  }
}
