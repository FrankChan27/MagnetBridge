import magnetUri from "magnet-uri";

const HEX40 = /^[a-f0-9]{40}$/i;

export function parseMagnetInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("请粘贴 magnet 链接");
  let uri = trimmed;
  if (HEX40.test(trimmed)) uri = `magnet:?xt=urn:btih:${trimmed}`;
  if (!uri.startsWith("magnet:")) throw new Error("只接受 magnet 链接或 info-hash，不提供内容搜索");
  const decoded = magnetUri(uri) as Record<string, unknown>;
  const infoHash = String(decoded.infoHash ?? "").toLowerCase();
  if (!HEX40.test(infoHash)) throw new Error("无法从 magnet 中解析 xt=urn:btih");
  return { magnet: uri, infoHash, name: (decoded.name as string) ?? null };
}
