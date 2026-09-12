export const IDM_VERDICT = {
  architecture: "B",
  status: "REJECTED" as const,
  headline: "IDM 不能作为 magnet 工作流的下载器",
  reasons: [
    "IDM 官方 FAQ 明确：当前版本因法律原因不支持 torrent。",
    "官方命令行只接受 HTTP/FTP/HTTPS/MMS 的 /d URL，没有 magnet 或 .torrent 参数。",
    "magnet 不能转换成 IDM 能用的“直链”；中间必须先有 BT 引擎把数据拿下来。",
    "若 BT 已下完再让 IDM 从 localhost HTTP 拉一次，只是本地拷贝，浪费磁盘和时间。",
    "若边下边用 Range 暴露未就绪 piece，IDM 的多连接会被空洞数据卡住，并引入超时、回压、完整性缺口。",
    "IDM 命令行没有进度/暂停 API，应用无法实现要求的状态机。",
    "官方禁止第三方扩展调用该命令行；浏览器里的桥接也不被许可。",
    "BT 引擎本身已经在做多 peer / 多 piece 并发，这才是 magnet 场景的加速手段。",
  ],
  officialCli: 'idman /d URL [/p path] [/f name] [/q] [/h] [/n] [/a]',
  officialFaq: "https://www.internetdownloadmanager.com/register/new_faq/functions4.html",
  officialCliDoc: "https://www.internetdownloadmanager.com/support/command_line.html",
  fallback: "A",
} as const;
