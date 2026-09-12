/**
 * Official IDM command line only. Source:
 * https://www.internetdownloadmanager.com/support/command_line.html
 *
 * idman /s
 * or idman /d URL [/p local_path] [/f local_file_name] [/q] [/h] [/n] [/a]
 *
 * Store extensions are forbidden. A user-run local Windows tool is not a store
 * extension; we still only use documented flags.
 */
export type IdmCliRequest = {
  url: string;
  localPath?: string;
  fileName?: string;
  silent?: boolean;
  queueOnly?: boolean;
  quitAfter?: boolean;
};

export const IDM_CLI_DOC = "https://www.internetdownloadmanager.com/support/command_line.html";

export function buildIdmArgs(request: IdmCliRequest): string[] {
  if (!request.url) throw new Error("IDM /d requires a URL");
  if (!/^https?:\/\//i.test(request.url) && !request.url.startsWith("ftp://")) {
    throw new Error("IDM official CLI only accepts HTTP/FTP/HTTPS/MMS URLs");
  }
  const args: string[] = [];
  if (request.silent !== false) args.push("/n");
  args.push("/d", request.url);
  if (request.localPath) args.push("/p", request.localPath);
  if (request.fileName) args.push("/f", request.fileName);
  if (request.queueOnly) args.push("/a");
  if (request.quitAfter) args.push("/q");
  return args;
}

export function formatIdmCommand(exe: string, request: IdmCliRequest): string {
  const args = buildIdmArgs(request).map((part) => (/\s/.test(part) ? `"${part}"` : part));
  return [exe.includes(" ") ? `"${exe}"` : exe, ...args].join(" ");
}
