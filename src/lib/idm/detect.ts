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
      ? "浏览器读不到 IDMan.exe。Q1（用 IDM 加速 BT）已否决。Q2（用已购买的 IDM 当下载前端）是可选 Architecture D，只在 Windows 本机 CLI / test-idm-bridge.cmd 上运行。"
      : "当前不是 Windows。Architecture A 仍然可用。Architecture D 需要本机 IDMan.exe。",
  };
}

export { COMMON_PATHS as IDM_COMMON_PATHS };
