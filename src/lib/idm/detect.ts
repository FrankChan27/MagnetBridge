export type IdmDetection = {
  platform: string;
  possible: boolean;
  found: boolean;
  path: string | null;
  note: string;
};

const COMMON_PATHS = [
  "C:\\\\Program Files (x86)\\\\Internet Download Manager\\\\IDMan.exe",
  "C:\\\\Program Files\\\\Internet Download Manager\\\\IDMan.exe",
];

export function detectIdmInBrowser(): IdmDetection {
  const platform = typeof navigator === "undefined" ? "unknown" : navigator.platform;
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isWindows = /Win/i.test(platform) || /Windows/i.test(ua);
  return {
    platform,
    possible: isWindows,
    found: false,
    path: null,
    note: isWindows
      ? "浏览器无法读取本机 IDMan.exe。Windows 本地 CLI 会检查常见安装路径与注册表，但即使找到也不会调用——架构 B 已被否决。"
      : "当前环境不是 Windows，无法安装或调用 IDM。这不影响 magnet → 本地文件。",
  };
}

export { COMMON_PATHS as IDM_COMMON_PATHS };
