import { sanitizeRelativePath, uniqueName } from "./sanitize.ts";

export type DirectoryHandle = FileSystemDirectoryHandle;
export type WritableHandle = FileSystemWritableFileStream;

export function canUseDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function pickSaveDirectory(): Promise<DirectoryHandle | null> {
  if (!canUseDirectoryPicker() || !window.showDirectoryPicker) return null;
  try {
    return await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

async function ensureDir(root: DirectoryHandle, segments: string[]): Promise<DirectoryHandle> {
  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

export async function createFileWriter(
  root: DirectoryHandle,
  relativePath: string,
  size: number,
  usedNames: Set<string>,
): Promise<{ writable: WritableHandle; path: string }> {
  const safe = uniqueName(sanitizeRelativePath(relativePath), usedNames);
  const parts = safe.split("/");
  const fileName = parts.pop() ?? "download";
  const dir = await ensureDir(root, parts);
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable({ keepExistingData: false });
  await writable.truncate(size);
  return { writable, path: safe };
}

export async function writeAt(
  writable: WritableHandle,
  offset: number,
  data: Uint8Array,
): Promise<void> {
  await writable.seek(offset);
  await writable.write(data as unknown as Blob);
}

export function triggerBrowserDownload(name: string, data: Blob | Uint8Array): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.split("/").pop() ?? name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

export async function estimateSpace(): Promise<{ quota: number; usage: number } | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.quota) return null;
    return { quota: estimate.quota, usage: estimate.usage ?? 0 };
  } catch {
    return null;
  }
}
