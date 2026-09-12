import type { ParsedMetadata, ProgressEvent } from "./types.ts";
import { pieceLengthAt, piecesForFiles, slicesForPiece } from "./pieces.ts";
import { sha1Hex } from "./sha1.ts";
import { webSeedCandidates } from "./webseed-urls.ts";

export type PieceResult = {
  index: number;
  bytes: Uint8Array;
};

export type WebSeedDownloadOptions = {
  meta: ParsedMetadata;
  selected: number[];
  origin: string;
  concurrency?: number;
  signal?: AbortSignal;
  havePieces?: Set<number>;
  onProgress?: (event: ProgressEvent) => void;
  onPiece?: (piece: PieceResult) => Promise<void> | void;
};

const RANGE_RETRIES = 3;

async function fetchRange(
  url: string,
  start: number,
  length: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const end = start + length - 1;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < RANGE_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal,
      });
      if (response.status !== 206 && response.status !== 200) {
        throw new Error(`WebSeed HTTP ${response.status}`);
      }
      const buf = new Uint8Array(await response.arrayBuffer());
      if (response.status === 200 && buf.byteLength > length) {
        return buf.subarray(start, start + length);
      }
      if (buf.byteLength < length) {
        throw new Error(`WebSeed 返回长度不足 ${buf.byteLength}<${length}`);
      }
      if (buf.byteLength > length) return buf.subarray(0, length);
      return buf;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (signal?.aborted) throw lastError;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("WebSeed 请求失败");
}

const urlCache = new Map<string, string>();

async function resolveFileUrl(
  meta: ParsedMetadata,
  fileIndex: number,
  origin: string,
  signal?: AbortSignal,
): Promise<string> {
  const key = `${meta.infoHash}:${fileIndex}:${origin}`;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const candidates = webSeedCandidates(meta, fileIndex, origin);
  let lastError: Error | null = null;
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal,
        headers: { Range: "bytes=0-0" },
      });
      if (response.ok || response.status === 206) {
        urlCache.set(key, url);
        return url;
      }
      lastError = new Error(`HEAD ${response.status} ${url}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (candidates[0]) {
    urlCache.set(key, candidates[0]);
    return candidates[0];
  }
  throw lastError ?? new Error("没有可用的 WebSeed 地址");
}

export async function fetchVerifiedPiece(
  meta: ParsedMetadata,
  pieceIndex: number,
  origin: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  return downloadPiece(meta, pieceIndex, origin, signal);
}

async function downloadPiece(
  meta: ParsedMetadata,
  pieceIndex: number,
  origin: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const size = pieceLengthAt(meta, pieceIndex);
  const piece = new Uint8Array(size);
  const slices = slicesForPiece(meta, pieceIndex);
  for (const slice of slices) {
    const url = await resolveFileUrl(meta, slice.fileIndex, origin, signal);
    const chunk = await fetchRange(url, slice.fileOffset, slice.length, signal);
    piece.set(chunk, slice.pieceOffset);
  }
  const digest = await sha1Hex(piece);
  const expected = meta.pieces[pieceIndex];
  if (digest !== expected) {
    throw new Error(`piece ${pieceIndex} 校验失败`);
  }
  return piece;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item, index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}

export async function downloadViaWebSeed(options: WebSeedDownloadOptions): Promise<{
  downloaded: number;
  verifiedPieces: number;
}> {
  const { meta, selected, origin, signal, onProgress, onPiece, havePieces } = options;
  if (!meta.urlList.length) throw new Error("这个种子没有 WebSeed");
  const pieces = piecesForFiles(meta, selected).filter((index) => !havePieces?.has(index));
  const alreadyBytes = [...(havePieces ?? [])].reduce((sum, index) => sum + pieceLengthAt(meta, index), 0);  if (pieces.length === 0) throw new Error("没有需要下载的分片");
  const concurrency = options.concurrency ?? 4;
  let downloaded = alreadyBytes;
  let verified = havePieces?.size ?? 0;
  const started = performance.now();
  const totalBytes = piecesForFiles(meta, selected).reduce(
    (sum, index) => sum + pieceLengthAt(meta, index),
    0,
  );
  if (pieces.length === 0) {
    onProgress?.({
      downloaded: totalBytes,
      length: totalBytes,
      downloadSpeed: 0,
      peers: 0,
      webSeeds: meta.urlList.length,
      etaSeconds: 0,
    });
    return { downloaded: totalBytes, verifiedPieces: verified };
  }

  await mapPool(
    pieces,
    concurrency,
    async (pieceIndex) => {
      const bytes = await downloadPiece(meta, pieceIndex, origin, signal);
      downloaded += bytes.byteLength;
      verified += 1;
      await onPiece?.({ index: pieceIndex, bytes });
      const elapsed = (performance.now() - started) / 1000;
      const speed = elapsed > 0 ? downloaded / elapsed : 0;
      const remain = Math.max(0, totalBytes - downloaded);
      onProgress?.({
        downloaded,
        length: totalBytes,
        downloadSpeed: speed,
        peers: 0,
        webSeeds: meta.urlList.length,
        etaSeconds: speed > 0 ? remain / speed : null,
      });
    },
    signal,
  );

  return { downloaded, verifiedPieces: verified };
}
