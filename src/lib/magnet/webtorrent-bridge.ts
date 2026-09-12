import type { ParsedMagnet, ParsedMetadata, ProgressEvent } from "./types.ts";
import { metadataFromTorrentFile } from "./metadata.ts";
import { piecesForFiles } from "./pieces.ts";

type WebTorrentFile = {
  name: string;
  path: string;
  length: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type WebTorrentTorrent = {
  name: string;
  infoHash: string;
  files: WebTorrentFile[];
  torrentFile: Uint8Array;
  downloaded: number;
  length: number;
  downloadSpeed: number;
  numPeers: number;
  timeRemaining: number;
  pieces: { length: number }[] | null;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  destroy: (opts?: { destroyStore?: boolean }, cb?: () => void) => void;
  select: (start: number, end: number, priority?: number) => void;
  deselect: (start: number, end: number) => void;
};

type WebTorrentClient = {
  add: (
    id: string | Uint8Array,
    opts: Record<string, unknown>,
    cb?: (torrent: WebTorrentTorrent) => void,
  ) => WebTorrentTorrent;
  destroy: (cb?: () => void) => void;
};

let clientPromise: Promise<WebTorrentClient> | null = null;

async function getClient(): Promise<WebTorrentClient> {
  if (!clientPromise) {
    clientPromise = import("webtorrent/dist/webtorrent.min.js").then((mod) => {
      const WebTorrent = (mod as { default?: new () => WebTorrentClient }).default
        ?? (mod as unknown as new () => WebTorrentClient);
      return new WebTorrent();
    });
  }
  return clientPromise;
}

function waitForMetadata(torrent: WebTorrentTorrent, signal?: AbortSignal): Promise<void> {
  if (torrent.files?.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待元数据超时"));
    }, 25_000);
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    torrent.on("metadata", () => {
      cleanup();
      resolve();
    });
    torrent.on("error", (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

export async function addMagnetForMetadata(
  parsed: ParsedMagnet,
  origin: string,
  signal?: AbortSignal,
): Promise<ParsedMetadata> {
  const client = await getClient();
  const magnet = parsed.magnet.includes("ws=")
    ? parsed.magnet
    : parsed.urlList.reduce((uri, ws) => {
        const abs = ws.startsWith("/") ? `${origin}${ws}` : ws;
        return `${uri}&ws=${encodeURIComponent(abs)}`;
      }, parsed.magnet);

  const torrent = client.add(magnet, { announce: parsed.announce });
  try {
    await waitForMetadata(torrent, signal);
    return metadataFromTorrentFile(Uint8Array.from(torrent.torrentFile), {
      urlList: parsed.urlList,
      announce: parsed.announce,
    });
  } finally {
    torrent.destroy({ destroyStore: true });
  }
}

export async function downloadPiecesViaWebTorrent(opts: {
  meta: ParsedMetadata;
  magnet: string;
  selected: number[];
  origin: string;
  signal?: AbortSignal;
  onProgress: (event: ProgressEvent) => void;
}): Promise<Map<number, Uint8Array>> {
  const client = await getClient();
  const torrent = client.add(opts.meta.torrentFile ?? opts.magnet, {
    announce: opts.meta.announce,
  });
  const needed = new Set(piecesForFiles(opts.meta, opts.selected));
  const collected = new Map<number, Uint8Array>();

  await waitForMetadata(torrent, opts.signal);

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      torrent.destroy({ destroyStore: true });
      reject(new DOMException("Aborted", "AbortError"));
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setInterval(() => {
      opts.onProgress({
        downloaded: torrent.downloaded,
        length: torrent.length,
        downloadSpeed: torrent.downloadSpeed,
        peers: torrent.numPeers,
        webSeeds: opts.meta.urlList.length,
        etaSeconds: Number.isFinite(torrent.timeRemaining) ? torrent.timeRemaining / 1000 : null,
      });
    }, 400);

    const cleanup = () => {
      clearInterval(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    };

    torrent.on("download", () => {
      opts.onProgress({
        downloaded: torrent.downloaded,
        length: torrent.length,
        downloadSpeed: torrent.downloadSpeed,
        peers: torrent.numPeers,
        webSeeds: opts.meta.urlList.length,
        etaSeconds: Number.isFinite(torrent.timeRemaining) ? torrent.timeRemaining / 1000 : null,
      });
    });

    torrent.on("done", async () => {
      try {
        for (const index of opts.selected) {
          const file = torrent.files[index];
          if (!file) continue;
          await file.arrayBuffer();
        }
        const parsed = await metadataFromTorrentFile(Uint8Array.from(torrent.torrentFile));
        const { extractSelectedFiles } = await import("./assemble.ts");
        const files = extractSelectedFiles(
          parsed,
          opts.selected,
          await piecesFromTorrentFiles(parsed, opts.selected, torrent),
        );
        void files;
        for (const pieceIndex of needed) {
          const bytes = await pieceBytesFromFiles(parsed, pieceIndex, torrent);
          collected.set(pieceIndex, bytes);
        }
        cleanup();
        torrent.destroy({ destroyStore: true });
        resolve(collected);
      } catch (error) {
        cleanup();
        torrent.destroy({ destroyStore: true });
        reject(error);
      }
    });

    torrent.on("error", (error) => {
      cleanup();
      torrent.destroy({ destroyStore: true });
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

async function piecesFromTorrentFiles(
  meta: ParsedMetadata,
  selected: number[],
  torrent: WebTorrentTorrent,
): Promise<Map<number, Uint8Array>> {
  const map = new Map<number, Uint8Array>();
  for (const index of piecesForFiles(meta, selected)) {
    map.set(index, await pieceBytesFromFiles(meta, index, torrent));
  }
  return map;
}

async function pieceBytesFromFiles(
  meta: ParsedMetadata,
  pieceIndex: number,
  torrent: WebTorrentTorrent,
): Promise<Uint8Array> {
  const { pieceLengthAt, slicesForPiece } = await import("./pieces.ts");
  const { sha1Hex } = await import("./sha1.ts");
  const size = pieceLengthAt(meta, pieceIndex);
  const piece = new Uint8Array(size);
  const slices = slicesForPiece(meta, pieceIndex);
  const fileCache = new Map<number, Uint8Array>();
  for (const slice of slices) {
    let fileBytes = fileCache.get(slice.fileIndex);
    if (!fileBytes) {
      const file = torrent.files[slice.fileIndex];
      if (!file) throw new Error(`缺少文件 ${slice.fileIndex}`);
      fileBytes = new Uint8Array(await file.arrayBuffer());
      fileCache.set(slice.fileIndex, fileBytes);
    }
    piece.set(
      fileBytes.subarray(slice.fileOffset, slice.fileOffset + slice.length),
      slice.pieceOffset,
    );
  }
  const digest = await sha1Hex(piece);
  if (digest !== meta.pieces[pieceIndex]) {
    throw new Error(`WebTorrent piece ${pieceIndex} 校验失败`);
  }
  return piece;
}
