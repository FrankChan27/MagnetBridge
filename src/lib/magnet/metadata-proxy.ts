import { createServerFn } from "@tanstack/react-start";
import { assertSafeHttpUrl } from "./url.ts";

const MAX_BYTES = 8 * 1024 * 1024;

export const fetchTorrentMetadata = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => {
    if (!data?.url || typeof data.url !== "string") throw new Error("缺少 url");
    return { url: data.url };
  })
  .handler(async ({ data }) => {
    const url = assertSafeHttpUrl(data.url);
    const response = await fetch(url.toString(), {
      headers: { accept: "application/x-bittorrent,*/*", "user-agent": "MagnetBridge/1.0" },
      signal: AbortSignal.timeout(25_000),
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`元数据 HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > MAX_BYTES) throw new Error("种子文件过大");
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) throw new Error("种子文件过大");
    let binary = "";
    for (const byte of buffer) binary += String.fromCharCode(byte);
    return { url: url.toString(), base64: btoa(binary), bytes: buffer.byteLength };
  });
