import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { buildIdmArgs, type IdmCliRequest } from "./cli.ts";

export const IDM_COMMON_PATHS = [
  "C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe",
  "C:\\Program Files\\Internet Download Manager\\IDMan.exe",
];

export type IdmLaunch = {
  found: boolean;
  path: string | null;
  command: string | null;
  spawned: boolean;
  error: string | null;
};

export function detectIdmExe(extraPath?: string | null): { found: boolean; path: string | null } {
  if (extraPath && existsSync(extraPath)) return { found: true, path: extraPath };
  if (process.platform !== "win32") return { found: false, path: null };
  for (const candidate of IDM_COMMON_PATHS) {
    if (existsSync(candidate)) return { found: true, path: candidate };
  }
  return { found: false, path: null };
}

export function launchIdm(request: IdmCliRequest, exePath?: string | null): IdmLaunch {
  const detected = detectIdmExe(exePath);
  if (!detected.found || !detected.path) {
    return {
      found: false,
      path: null,
      command: null,
      spawned: false,
      error: "IDMan.exe not found. Architecture D needs a real Windows IDM install.",
    };
  }
  const args = buildIdmArgs(request);
  try {
    const child = spawn(detected.path, args, { detached: true, stdio: "ignore", windowsHide: false });
    child.unref();
    return {
      found: true,
      path: detected.path,
      command: [detected.path, ...args].join(" "),
      spawned: true,
      error: null,
    };
  } catch (error) {
    return {
      found: true,
      path: detected.path,
      command: [detected.path, ...args].join(" "),
      spawned: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
