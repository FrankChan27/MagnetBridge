import { extractSelectedFiles, type FileBuffer } from "./assemble.ts";
import {
  canUseDirectoryPicker,
  createFileWriter,
  estimateSpace,
  triggerBrowserDownload,
  writeAt,
  type DirectoryHandle,
} from "./filesystem.ts";
import { metadataCandidates, metadataFromTorrentFile, fetchTorrentBuffer } from "./metadata.ts";
import { parseMagnetInput } from "./parse.ts";
import { selectedLength, slicesForPiece } from "./pieces.ts";
import type { ParsedMagnet, ParsedMetadata, ProgressEvent } from "./types.ts";
import { downloadViaWebSeed } from "./webseed.ts";

export type EngineHooks = {
  onStatus: (status: string, extra?: Record<string, unknown>) => void;
  onProgress: (event: ProgressEvent) => void;
  onMetadata: (meta: ParsedMetadata) => void;
  onError: (message: string) => void;
};

export type StartDownloadOptions = {
  magnet: string;
  origin: string;
  selected?: number[];
  selectNames?: string[];
  directory?: DirectoryHandle | null;
  autoDownload?: boolean;
  havePieces?: Set<number>;
  onPiece?: (piece: { index: number; bytes: Uint8Array }) => Promise<void> | void;
  signal?: AbortSignal;
  fetchMetadataProxy?: (url: string) => Promise<Uint8Array>;
  hooks: EngineHooks;
};

export type DownloadResult = {
  meta: ParsedMetadata;
  files: FileBuffer[];
  verifiedPieces: number;
  engine: "webseed" | "webtorrent";
};

async function loadMetadata(
  parsed: ParsedMagnet,
  origin: string,
  signal: AbortSignal | undefined,
  proxy?: (url: string) => Promise<Uint8Array>,
): Promise<ParsedMetadata> {
  const candidates = metadataCandidates(parsed, origin);
  let lastError: Error | null = null;
  for (const url of candidates) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      let buffer: Uint8Array;
      try {
        buffer = await fetchTorrentBuffer(url, origin);
      } catch (error) {
        if (!proxy) throw error;
        buffer = await proxy(url);
      }
      const meta = await metadataFromTorrentFile(buffer, {
        urlList: parsed.urlList.map((ws) => (ws.startsWith("/") ? `${origin}${ws}` : ws)),
        announce: parsed.announce,
      });
      if (meta.infoHash !== parsed.infoHash) {
        throw new Error("种子 info-hash 与 magnet 不一致");
      }
      return meta;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (candidates.length === 0) {
    const webtorrentMeta = await metadataViaWebTorrent(parsed, origin, signal);
    if (webtorrentMeta) return webtorrentMeta;
  }
  throw lastError ?? new Error("无法获取元数据：没有可用的种子文件或 WebRTC 节点");
}

async function metadataViaWebTorrent(
  parsed: ParsedMagnet,
  origin: string,
  signal?: AbortSignal,
): Promise<ParsedMetadata | null> {
  try {
    const { addMagnetForMetadata } = await import("./webtorrent-bridge.ts");
    return await addMagnetForMetadata(parsed, origin, signal);
  } catch {
    return null;
  }
}

async function downloadViaWebTorrent(
  meta: ParsedMetadata,
  magnet: string,
  selected: number[],
  origin: string,
  signal: AbortSignal | undefined,
  onProgress: (event: ProgressEvent) => void,
): Promise<Map<number, Uint8Array>> {
  const { downloadPiecesViaWebTorrent } = await import("./webtorrent-bridge.ts");
  return downloadPiecesViaWebTorrent({ meta, magnet, selected, origin, signal, onProgress });
}

export async function runDownload(options: StartDownloadOptions): Promise<DownloadResult> {
  const parsed = parseMagnetInput(options.magnet);
  options.hooks.onStatus("FETCHING_METADATA", { infoHash: parsed.infoHash, name: parsed.name });
  const meta = await loadMetadata(parsed, options.origin, options.signal, options.fetchMetadataProxy);
  const selected =
    options.selected ??
    (options.selectNames?.length
      ? meta.files.filter((file) => options.selectNames?.includes(file.name)).map((file) => file.index)
      : meta.files.map((file) => file.index));
  const length = selectedLength(meta.files, selected);
  options.hooks.onMetadata(meta);
  options.hooks.onStatus("READY", { length, files: meta.files.length });

  const space = await estimateSpace();
  if (space && length > space.quota - space.usage && !options.directory) {
    throw new Error("浏览器存储空间可能不足，请改选本机文件夹或减少文件");
  }

  options.hooks.onStatus("DOWNLOADING", { engine: meta.urlList.length ? "webseed" : "webtorrent" });

  const pieces = new Map<number, Uint8Array>();
  let engine: "webseed" | "webtorrent" = "webseed";
  let verifiedPieces = 0;

  const onPiece = async (piece: { index: number; bytes: Uint8Array }) => {
    pieces.set(piece.index, piece.bytes);
    await options.onPiece?.(piece);
  };

  try {
    if (meta.urlList.length) {
      const result = await downloadViaWebSeed({
        meta,
        selected,
        origin: options.origin,
        signal: options.signal,
        havePieces: options.havePieces,
        onProgress: options.hooks.onProgress,
        onPiece,
      });
      verifiedPieces = result.verifiedPieces;
      engine = "webseed";
    } else {
      throw new Error("NO_WEBSEED");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.signal?.aborted) throw error;
    if (message !== "NO_WEBSEED" && meta.urlList.length) {
      options.hooks.onStatus("DOWNLOADING", { engine: "webtorrent", fallback: message });
    }
    engine = "webtorrent";
    const wtPieces = await downloadViaWebTorrent(
      meta,
      options.magnet,
      selected,
      options.origin,
      options.signal,
      options.hooks.onProgress,
    );
    for (const [index, bytes] of wtPieces) pieces.set(index, bytes);
    verifiedPieces = wtPieces.size;
  }

  options.hooks.onStatus("VERIFYING", { verifiedPieces });
  const files = extractSelectedFiles(meta, selected, pieces);

  if (options.directory) {
    const used = new Set<string>();
    for (const file of files) {
      const { writable } = await createFileWriter(options.directory, file.path, file.data.byteLength, used);
      await writeAt(writable, 0, file.data);
      await writable.close();
    }
  } else if (options.autoDownload !== false) {
    for (const file of files) {
      triggerBrowserDownload(file.path, file.data);
    }
  }

  options.hooks.onStatus("COMPLETED", {
    engine,
    verifiedPieces,
    files: files.map((f) => f.path),
  });

  return { meta, files, verifiedPieces, engine };
}

export async function writePiecesToDirectory(
  meta: ParsedMetadata,
  selected: number[],
  pieces: Map<number, Uint8Array>,
  directory: DirectoryHandle,
): Promise<void> {
  const used = new Set<string>();
  const writers = new Map<number, { writable: FileSystemWritableFileStream; path: string }>();
  for (const index of selected) {
    const file = meta.files[index];
    if (!file) continue;
    writers.set(index, await createFileWriter(directory, file.path, file.length, used));
  }
  try {
    for (const [pieceIndex, bytes] of pieces) {
      for (const slice of slicesForPiece(meta, pieceIndex)) {
        if (!selected.includes(slice.fileIndex)) continue;
        const writer = writers.get(slice.fileIndex);
        if (!writer) continue;
        await writeAt(writer.writable, slice.fileOffset, bytes.subarray(slice.pieceOffset, slice.pieceOffset + slice.length));
      }
    }
  } finally {
    await Promise.all([...writers.values()].map((w) => w.writable.close()));
  }
}

export { canUseDirectoryPicker };
