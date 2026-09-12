import { KNOWN_TORRENT_URLS } from "./fixtures.ts";
import { decodeTorrentBuffer } from "./bencode-torrent.ts";
import { parseMagnetInput } from "./parse.ts";
import type { ParsedMagnet, ParsedMetadata } from "./types.ts";
import { assertSafeHttpUrl, resolveMaybeRelative, unique } from "./url.ts";

export async function metadataFromTorrentFile(
  buffer: Uint8Array,
  extra?: { urlList?: string[]; announce?: string[] },
): Promise<ParsedMetadata> {
  return decodeTorrentBuffer(buffer, extra);
}

export async function fetchTorrentBuffer(url: string, origin: string, timeoutMs = 20_000): Promise<Uint8Array> {
  const resolved = resolveMaybeRelative(url, origin);
  const parsed = new URL(resolved);
  const sameOrigin = origin && parsed.origin === new URL(origin).origin;
  if (!sameOrigin) assertSafeHttpUrl(resolved);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(resolved, {
      signal: controller.signal,
      headers: { accept: "application/x-bittorrent,*/*" },
    });
    if (!response.ok) throw new Error(`获取种子失败 HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > 8 * 1024 * 1024) throw new Error("种子文件过大");
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("种子文件过大");
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

export function metadataCandidates(magnet: ParsedMagnet, origin: string): string[] {
  const known = KNOWN_TORRENT_URLS[magnet.infoHash];
  const extras = [
    ...magnet.exactSources,
    ...(known ? [known] : []),
    `https://itorrents.org/torrent/${magnet.infoHash.toUpperCase()}.torrent`,
  ];
  return unique(extras.map((url) => resolveMaybeRelative(url, origin)).filter((url) => /^https?:/i.test(url)));
}

export { parseMagnetInput };
