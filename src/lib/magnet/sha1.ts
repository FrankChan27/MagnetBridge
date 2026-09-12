function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function toArrayBuffer(data: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

export async function sha1Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", toArrayBuffer(data));
  return toHex(new Uint8Array(digest));
}

export async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(data));
  return toHex(new Uint8Array(digest));
}
