import { useState } from "react";
import { Clipboard, FolderOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { LEGAL_FIXTURES } from "@/lib/magnet/fixtures";
import { TaskCard } from "./task-card";
import { ResearchPanel } from "./research-panel";
import { useMagnetBridge } from "./use-bridge";

type Tab = "download" | "research" | "guide";

export function MagnetApp() {
  const bridge = useMagnetBridge();
  const [tab, setTab] = useState<Tab>("download");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleStart(magnet = bridge.input) {
    setLocalError(null);
    try {
      await bridge.startTask(magnet.trim());
      bridge.setInput("");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  async function pasteMagnet() {
    try {
      const text = await navigator.clipboard.readText();
      bridge.setInput(text.trim());
    } catch {
      setLocalError("无法读取剪贴板，请手动粘贴");
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="font-mono text-xs tracking-[0.22em] text-subtle uppercase">Local magnet intake</p>
            <h1 className="max-w-xl text-4xl font-medium tracking-tight text-balance md:text-5xl">
              MagnetBridge
            </h1>
            <p className="max-w-xl text-pretty text-muted">
              粘贴你有权下载的 magnet，开始后不再需要操作。文件写入你选择的目录，或在完成后交给浏览器保存。
            </p>
          </div>
          <nav className="flex gap-1 rounded-full border border-border bg-surface p-1">
            {(
              [
                ["download", "下载"],
                ["research", "裁决"],
                ["guide", "用法"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`h-10 rounded-full px-4 text-sm transition-colors duration-150 ${
                  tab === id ? "bg-accent text-accent-foreground" : "text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        {tab === "download" ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-4 md:p-6">
              <label className="text-sm font-medium" htmlFor="magnet">
                Magnet
              </label>
              <Textarea
                id="magnet"
                value={bridge.input}
                placeholder="magnet:?xt=urn:btih:..."
                className="mt-3"
                onChange={(event) => bridge.setInput(event.target.value)}
              />
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <label className="flex items-start gap-3 text-sm text-muted">
                  <Checkbox
                    checked={bridge.consent}
                    onCheckedChange={bridge.setConsent}
                    className="mt-0.5"
                  />
                  <span>我确认这些内容是合法获得、并且我有权下载的。本工具不提供搜索、索引或绕过权限。</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={pasteMagnet}>
                    <Clipboard />
                    粘贴
                  </Button>
                  <Button variant="secondary" onClick={bridge.chooseDirectory} disabled={!bridge.canPickDirectory}>
                    <FolderOpen />
                    {bridge.directoryEnabled ? bridge.saveLabel : "保存目录"}
                  </Button>
                  <Button onClick={() => void handleStart()} disabled={!bridge.input.trim()}>
                    开始
                  </Button>
                </div>
              </div>
              {localError ? <p className="mt-3 text-sm text-danger">{localError}</p> : null}
              <p className="mt-3 text-xs text-subtle">
                保存位置：{bridge.saveLabel}。未选择目录时，完成后会触发浏览器下载。
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">公开测试种子</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {LEGAL_FIXTURES.map((fixture) => (
                  <button
                    key={fixture.id}
                    type="button"
                    onClick={() => void handleStart(fixture.magnet)}
                    className="rounded-xl border border-border bg-surface p-4 text-left transition-colors duration-150 hover:bg-surface-2"
                  >
                    <p className="text-sm font-medium">{fixture.title}</p>
                    <p className="mt-1 text-xs text-muted">{fixture.blurb}</p>
                    <p className="mt-3 font-mono text-[0.6875rem] text-subtle">
                      {fixture.license} · {fixture.sizeLabel}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">任务</h2>
              {bridge.tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted">
                  还没有任务。粘贴 magnet，或用上面的公开测试种子跑一次闭环。
                </div>
              ) : (
                <div className="space-y-3">
                  {bridge.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onPause={() => bridge.pause(task.id)}
                      onResume={() => void bridge.resume(task.id)}
                      onCancel={() => bridge.cancel(task.id)}
                      onToggleFile={(index) => bridge.toggleFile(task.id, index)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {tab === "research" ? <ResearchPanel /> : null}

        {tab === "guide" ? (
          <section className="max-w-2xl space-y-5 text-pretty">
            <h2 className="text-2xl font-medium tracking-tight">以后拿到 magnet 怎么用</h2>
            <ol className="space-y-4 text-muted">
              <li>
                <span className="font-medium text-fg">1. 确认你有权下载。</span>
                不要把这个工具当成搜索器。没有检索、没有推荐、没有绕过登录或 DRM。
              </li>
              <li>
                <span className="font-medium text-fg">2. 粘贴链接，点开始。</span>
                程序会自己取元数据、拉分片、做 SHA-1 校验，再把文件放到保存目录。
              </li>
              <li>
                <span className="font-medium text-fg">3. 需要指定文件夹时点“保存目录”。</span>
                Windows 11 的 Edge / Chrome 可以直接写盘。否则完成后走浏览器下载。
              </li>
              <li>
                <span className="font-medium text-fg">4. 关掉页面再打开。</span>
                未完成任务会显示为已暂停，点继续即可恢复。
              </li>
            </ol>
            <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
              <ShieldCheck className="mr-2 inline size-4 text-ok" />
              IDM 即使装了也不会被调用。它对 magnet 没有合法、可靠的加速作用。
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
