const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1|\[::1\])/i;

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST.test(host)) return true;
  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n))) {
    if (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) return true;
    if (parts[0] === 100 && (parts[1] ?? 0) >= 64 && (parts[1] ?? 0) <= 127) return true;
  }
  return false;
}

export function resolveMaybeRelative(url: string, origin: string): string {
  if (!url) return url;
  if (url.startsWith("magnet:")) return url;
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
}

export function assertSafeHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("元数据地址不是合法 URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("只允许 http(s) 元数据源");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("拒绝访问内网地址");
  }
  return url;
}

export function unique(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}

export function joinUrl(base: string, path: string): string {
  if (/^https?:/i.test(path)) return path;
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return new URL(path.replace(/^\//, ""), normalized).toString();
}
