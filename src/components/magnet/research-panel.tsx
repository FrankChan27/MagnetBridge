import { useEffect, useState } from "react";
import { IDM_VERDICT } from "@/lib/idm/verdict";
import { IDM_FRONTEND_VERDICT } from "@/lib/idm/frontend-verdict";
import { detectIdmInBrowser, type IdmDetection } from "@/lib/idm/detect";
import { Separator } from "@/components/ui/separator";

export function ResearchPanel() {
  const [detection, setDetection] = useState<IdmDetection | null>(null);
  useEffect(() => {
    setDetection(detectIdmInBrowser());
  }, []);
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-[0.18em] text-subtle uppercase">Architecture</p>
        <h2 className="text-2xl font-medium tracking-tight text-balance">
          默认仍是 magnet 进 BT 引擎、文件出本地盘。IDM 只作为可选前端，不是加速器。
        </h2>
        <p className="max-w-2xl text-pretty text-muted">
          Q1「IDM 能不能让 BT 更快」维持否决。Q2「已经买了 IDM，能不能继续用它当下载窗口」在 sandbox 里做到了按需 Range 桥，真实 IDMan.exe 还要在 Windows 上跑一次。
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <VerdictCard
          code="A"
          title="magnet → WebTorrent / WebSeed → 本地文件"
          status="SUPPORTED"
          body="默认路径。元数据、分片、校验、暂停恢复都在同一条链路。未勾选 IDM 时不会走桥。"
        />
        <VerdictCard
          code="B"
          title="先下完整 torrent，再 localhost 复制给 IDM"
          status={IDM_VERDICT.status}
          body="Q1 加速器。官方不支持 torrent；下完再拉一次只是拷贝。本轮不再用这条路径。"
        />
        <VerdictCard
          code="C"
          title="WebSeed HTTP Range + piece SHA-1"
          status="SUPPORTED"
          body="种子自带官方镜像时的 Architecture A 子集。仍然不是 IDM。"
        />
        <VerdictCard
          code="D"
          title="BT piece 按需校验 → localhost Range → IDM 落盘"
          status={`${IDM_FRONTEND_VERDICT.status} — ${IDM_FRONTEND_VERDICT.qualifier}`}
          body="Q2 前端。Range 驱动 piece 获取。Sandbox 用模拟客户端。真实 IDM 请运行 native/windows/test-idm-bridge.cmd。"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <h3 className="text-lg font-medium">Q1 否决证据（加速器）</h3>
        <p className="mt-1 font-mono text-xs text-subtle">{IDM_VERDICT.officialCli}</p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {IDM_VERDICT.reasons.map((reason) => (
            <li key={reason} className="border-l-2 border-border pl-3">
              {reason}
            </li>
          ))}
        </ul>
        <Separator className="my-5" />
        <h3 className="text-lg font-medium">Q2 当前裁决（统一前端）</h3>
        <p className="mt-2 text-sm text-muted">{IDM_FRONTEND_VERDICT.headline}</p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {IDM_FRONTEND_VERDICT.reasons.map((reason) => (
            <li key={reason} className="border-l-2 border-border pl-3">
              {reason}
            </li>
          ))}
        </ul>
        <Separator className="my-5" />
        <p className="text-sm text-muted">
          IDM 探测：{detection?.note || "打开页面后检测当前浏览器环境。"}
        </p>
        <p className="mt-3 text-sm">
          <a className="underline decoration-border underline-offset-4 hover:text-fg" href={IDM_VERDICT.officialFaq}>
            IDM 官方 torrent FAQ
          </a>
          <span className="text-subtle"> · </span>
          <a className="underline decoration-border underline-offset-4 hover:text-fg" href={IDM_VERDICT.officialCliDoc}>
            官方命令行
          </a>
        </p>
      </div>
    </section>
  );
}

function VerdictCard({
  code,
  title,
  status,
  body,
}: {
  code: string;
  title: string;
  status: string;
  body: string;
}) {
  const tone = status.startsWith("SUPPORTED")
    ? "text-ok"
    : status.startsWith("REJECTED")
      ? "text-danger"
      : "text-warn";
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <p className="font-mono text-xs text-subtle">方案 {code}</p>
      <h3 className="mt-2 text-base font-medium tracking-tight">{title}</h3>
      <p className={`mt-2 font-mono text-xs ${tone}`}>{status}</p>
      <p className="mt-3 text-sm text-muted">{body}</p>
    </article>
  );
}
