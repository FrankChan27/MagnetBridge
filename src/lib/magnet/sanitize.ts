const WINDOWS_RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g;
const MAX_SEGMENT = 120;
const MAX_RELATIVE = 180;

export function sanitizeFileName(name: string): string {
  const trimmed = name.replace(ILLEGAL, "_").replace(/[.\s]+$/g, "").trim() || "download";
  const stem = trimmed.split(".");
  const base = stem[0] ?? "download";
  if (WINDOWS_RESERVED.has(base.toUpperCase())) {
    return `_${trimmed}`;
  }
  return trimmed.slice(0, MAX_SEGMENT);
}

export function sanitizeRelativePath(path: string): string {
  const parts = path
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map(sanitizeFileName);
  let joined = parts.join("/") || "download";
  if (joined.length > MAX_RELATIVE) {
    const extIndex = joined.lastIndexOf(".");
    const ext = extIndex > 0 ? joined.slice(extIndex, extIndex + 12) : "";
    joined = `${joined.slice(0, MAX_RELATIVE - ext.length)}${ext}`;
  }
  return joined;
}

export function uniqueName(desired: string, used: Set<string>): string {
  if (!used.has(desired.toLowerCase())) {
    used.add(desired.toLowerCase());
    return desired;
  }
  const dot = desired.lastIndexOf(".");
  const stem = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : "";
  let n = 2;
  while (used.has(`${stem} (${n})${ext}`.toLowerCase())) n += 1;
  const next = `${stem} (${n})${ext}`;
  used.add(next.toLowerCase());
  return next;
}
