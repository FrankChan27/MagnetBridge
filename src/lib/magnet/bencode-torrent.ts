import bencode from "bencode";
import { sha1Hex } from "./sha1.ts";
import type { ParsedMetadata, TorrentFileInfo } from "./types.ts";
import { unique } from "./url.ts";

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (ArrayBuffer.isView(value)) return new TextDecoder().decode(value as Uint8Array);
  return "";
}

function asBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === "string") return new TextEncoder().encode(value);
  throw new Error("expected bytes");
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  throw new Error("expected number");
}

function splitPieces(pieces: Uint8Array): string[] {
  const out: string[] = [];
  for (let i = 0; i < pieces.length; i += 20) {
    const slice = pieces.subarray(i, i + 20);
    let hex = "";
    for (const b of slice) hex += b.toString(16).padStart(2, "0");
    out.push(hex);
  }
  return out;
}

function listify(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export async function decodeTorrentBuffer(
  buffer: Uint8Array,
  extra?: { urlList?: string[]; announce?: string[] },
): Promise<ParsedMetadata> {
  const torrent = bencode.decode(buffer) as Record<string, unknown>;
  const info = torrent.info as Record<string, unknown> | undefined;
  if (!info) throw new Error("种子缺少 info");
  const infoEncoded = bencode.encode(info) as Uint8Array;
  const infoHash = await sha1Hex(infoEncoded);
  const name = asText(info["name.utf-8"] ?? info.name) || "download";
  const pieceLength = asNumber(info["piece length"]);
  const pieces = splitPieces(asBytes(info.pieces));
  if (!pieceLength || pieces.length === 0) throw new Error("种子缺少 piece 信息");

  const rawFiles = info.files as unknown[] | undefined;
  let files: TorrentFileInfo[];
  if (Array.isArray(rawFiles) && rawFiles.length > 0) {
    let offset = 0;
    files = rawFiles.map((entry, index) => {
      const file = entry as Record<string, unknown>;
      const length = asNumber(file.length);
      const pathParts = listify(file["path.utf-8"] ?? file.path).map(asText).filter(Boolean);
      const rel = [name, ...pathParts].filter(Boolean).join("/");
      const item: TorrentFileInfo = {
        index,
        path: rel,
        name: pathParts[pathParts.length - 1] ?? name,
        length,
        offset,
        selected: true,
      };
      offset += length;
      return item;
    });
  } else {
    const length = asNumber(info.length);
    files = [{ index: 0, path: name, name, length, offset: 0, selected: true }];
  }

  const length = files.reduce((sum, file) => sum + file.length, 0);
  const lastPieceLength = length % pieceLength || pieceLength;

  const announce: string[] = [];
  const announceList = torrent["announce-list"];
  if (Array.isArray(announceList)) {
    for (const tier of announceList) {
      for (const url of listify(tier)) announce.push(asText(url));
    }
  } else if (torrent.announce) {
    announce.push(asText(torrent.announce));
  }

  const urlList = listify(torrent["url-list"]).map(asText).filter(Boolean);

  return {
    infoHash,
    name,
    announce: unique([...announce, ...(extra?.announce ?? [])]),
    urlList: unique([...urlList, ...(extra?.urlList ?? [])]),
    files,
    length,
    pieceLength,
    lastPieceLength,
    pieces,
    torrentFile: buffer,
  };
}
