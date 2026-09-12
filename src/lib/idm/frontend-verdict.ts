export const IDM_ACCELERATOR_VERDICT = {
  question: "Q1: Can IDM make BitTorrent downloads faster?",
  architecture: "B",
  status: "REJECTED" as const,
  note: "Unchanged from ADR-001. Official CLI has no torrent support; a finished torrent served over localhost is a second copy.",
};

export const IDM_FRONTEND_VERDICT = {
  question: "Q2: Can IDM be MagnetBridge's unified Windows download frontend?",
  architecture: "D",
  status: "PARTIAL" as const,
  qualifier: "WINDOWS_IDM_E2E_REQUIRED",
  headline: "Sandbox 验证了 demand-driven Range 桥；真实 IDMan.exe 必须在 Windows 上跑一次。",
  reasons: [
    "Architecture D 不把整个 torrent 先下完再交给 IDM 复制。Range 请求才触发对应 piece 的获取与 SHA-1 校验。",
    "官方 CLI 可以把 HTTP URL 交给已安装的 IDM（/d /p /f /n），这是用户已经购买并长期使用的前端。",
    "本环境是 Linux，没有 IDMan.exe。模拟客户端通过 ≠ 真实 IDM 通过。",
    "IDM 多连接 Range 会打乱 BT piece 优先级；sandbox 测得到代价，真机才能判断是否可接受。",
    "IDM 没有进度 API；暂停/完成只能观察落盘文件，状态机在 MagnetBridge 一侧是近似的。",
  ],
  officialCli: 'idman /d URL [/p path] [/f name] [/q] [/h] [/n] [/a]',
  officialCliDoc: "https://www.internetdownloadmanager.com/support/command_line.html",
  fallback: "A",
  windowsTest: "native/windows/test-idm-bridge.cmd",
} as const;
