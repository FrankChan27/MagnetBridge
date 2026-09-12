import magnetUri from "magnet-uri";
import type { ParsedMagnet } from "./types.ts";

const BTIH = /urn:btih:([a-zA-Z0-9]+)/i;
const BT32 = /^[a-z2-7]{32}$/i;
const HEX40 = /^[a-f0-9]{40}$/i;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToHex(input: string): string {
  const s = input.toUpperCase().replace(/=+$/g, "");
  let bits = "";
  for (const ch of s) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("磁力链接 info-hash 不是有效的 Base32");
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeHash(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (HEX40.test(value)) return value;
  if (BT32.test(value)) return base32ToHex(value).toLowerCase();
  throw new Error("磁力链接缺少 40 位 hex 或 32 位 Base32 的 BitTorrent info-hash");
}

function asList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)].filter(Boolean);
}

export function looksLikeMagnet(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith("magnet:") || HEX40.test(trimmed) || BT32.test(trimmed);
}

export function parseMagnetInput(input: string): ParsedMagnet {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("请粘贴 magnet 链接");

  let uri = trimmed;
  if (HEX40.test(trimmed) || BT32.test(trimmed)) {
    uri = `magnet:?xt=urn:btih:${trimmed}`;
  }
  if (!uri.startsWith("magnet:")) {
    throw new Error("只接受 magnet 链接或 info-hash，不提供内容搜索");
  }

  const decoded = magnetUri(uri) as Record<string, unknown>;
  const xt = String(decoded.xt ?? decoded.infoHash ?? "");
  const match = typeof decoded.infoHash === "string" && decoded.infoHash
    ? String(decoded.infoHash)
    : (BTIH.exec(xt)?.[1] ?? xt.replace(/^urn:btih:/i, ""));

  if (!match) throw new Error("无法从 magnet 中解析 xt=urn:btih");

  const infoHash = normalizeHash(match);
  const name = typeof decoded.name === "string" && decoded.name.trim()
    ? decoded.name.trim()
    : typeof decoded.dn === "string" && decoded.dn.trim()
      ? String(decoded.dn).trim()
      : null;

  return {
    magnet: uri,
    infoHash,
    name,
    announce: asList(decoded.announce ?? decoded.tr),
    urlList: asList(decoded.urlList ?? decoded.ws),
    exactSources: asList(decoded.xs),
  };
}

export function canonicalMagnet(parsed: ParsedMagnet): string {
  const params = [`xt=urn:btih:${parsed.infoHash}`];
  if (parsed.name) params.push(`dn=${encodeURIComponent(parsed.name)}`);
  for (const tr of parsed.announce) params.push(`tr=${encodeURIComponent(tr)}`);
  for (const ws of parsed.urlList) params.push(`ws=${encodeURIComponent(ws)}`);
  for (const xs of parsed.exactSources) params.push(`xs=${encodeURIComponent(xs)}`);
  return `magnet:?${params.join("&")}`;
}
