export const IDM_VERDICT = {
  architecture: "B",
  status: "REJECTED" as const,
  headline: "IDM 不能作为 magnet 工作流的下载器",
  officialCli: "idman /d URL [/p path] [/f name] [/q] [/h] [/n] [/a]",
  officialFaq: "https://www.internetdownloadmanager.com/register/new_faq/functions4.html",
  officialCliDoc: "https://www.internetdownloadmanager.com/support/command_line.html",
  fallback: "A",
} as const;
