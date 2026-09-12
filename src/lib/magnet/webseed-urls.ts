import type { ParsedMetadata } from "./types.ts";
import { isMultiFile } from "./pieces.ts";
import { joinUrl, unique } from "./url.ts";

export function webSeedCandidates(
  meta: ParsedMetadata,
  fileIndex: number,
  origin: string,
): string[] {
  const file = meta.files[fileIndex];
  if (!file) return [];
  const bases = meta.urlList.map((base) => {
    if (base.startsWith("/")) return `${origin}${base}`;
    return base;
  });
  const multi = isMultiFile(meta);
  const out: string[] = [];
  for (const base of bases) {
    if (!multi) {
      out.push(base);
      if (base.endsWith("/")) out.push(joinUrl(base, file.name));
      else {
        out.push(joinUrl(`${base}/`, file.name));
        const parent = base.slice(0, base.lastIndexOf("/") + 1);
        if (parent) out.push(joinUrl(parent, file.name));
      }
    } else {
      const dir = base.endsWith("/") ? base : `${base}/`;
      out.push(joinUrl(dir, file.path));
      const withoutRoot = file.path.split("/").slice(1).join("/");
      if (withoutRoot) out.push(joinUrl(dir, withoutRoot));
      out.push(joinUrl(dir, file.name));
      out.push(joinUrl(dir, `${meta.name}/${file.name}`));
    }
  }
  return unique(out);
}
