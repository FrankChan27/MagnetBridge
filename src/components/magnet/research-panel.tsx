import { useEffect, useState } from "react";
import { IDM_VERDICT } from "@/lib/idm/verdict";
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
        <h2 className="text-2xl font-medium tracking-tight text-balance">IDM 桥被否决，正式路径是 magnet 进 BT 引擎、文件出本地盘</h2>
        <p className="max-w-2xl text-pretty text-muted">
          研究结论按可靠性、复杂度、速度、恢复能力和维护成本裁决。方案 B 不能提高最终下载性能，正式版取消 IDM。
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <VerdictCard
          code="A"
          title="magnet → WebTorrent / libtorrent → 本地文件"
          status="SUPPORTED"
          body="选定架构。元数据、分片、校验、暂停恢复都在同一条链路完成。"
        />
        <VerdictCard
          code="B"
          title="BT → localhost HTTP Range → IDM"
          status={IDM_VERDICT.status}
          body="官方不支持 torrent；命令行只吃 HTTP URL。本地再拉一次只是拷贝。"
        />
        <VerdictCard
          code="C"
          title="WebSeed HTTP Range + piece SHA-1"
          status="SUPPORTED"
          body="当种子自带官方镜像时，直接 Range 下载并按 BT 分片哈希校验。仍不是 IDM。"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <h3 className="text-lg font-medium">否决证据</h3>
        <p className="mt-1 font-mono text-xs text-subtle">{IDM_VERDICT.officialCli}</p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {IDM_VERDICT.reasons.map((reason) => (
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
  const tone =
    status === "SUPPORTED"
      ? "text-ok"
      : status === "REJECTED"
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
