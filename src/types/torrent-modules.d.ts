declare module "parse-torrent" {
  export default function parseTorrent(id: unknown): Promise<Record<string, unknown>>;
}

declare module "magnet-uri" {
  export default function magnetUri(uri: string): Record<string, unknown>;
}

declare module "webtorrent/dist/webtorrent.min.js" {
  const WebTorrent: new () => unknown;
  export default WebTorrent;
}

declare module "bencode" {
  export function decode(data: Uint8Array | ArrayBuffer | Buffer): unknown;
  export function encode(data: unknown): Uint8Array;
}

interface Window {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
}
