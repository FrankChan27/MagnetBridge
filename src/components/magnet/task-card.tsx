import {
  CirclePause,
  CirclePlay,
  FolderDown,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatEta, formatPercent, formatSpeed } from "@/lib/magnet/format";
import type { TaskSnapshot } from "@/lib/magnet/types";
import { STATUS_LABEL, STATUS_TONE } from "./status";

export function TaskCard({
  task,
  onPause,
  onResume,
  onCancel,
  onToggleFile,
}: {
  task: TaskSnapshot;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onToggleFile: (index: number) => void;
}) {
  const percent = formatPercent(task.downloaded, Math.max(task.length, task.downloaded, 1));
  const selectable = task.status === "READY" || task.status === "PAUSED" || task.status === "NEW";
  const running = task.status === "DOWNLOADING" || task.status === "FETCHING_METADATA" || task.status === "VERIFYING";

  return (
    <article className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-medium tracking-tight text-fg">{task.name}</h3>
            <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          </div>
          <p className="font-mono text-xs text-subtle break-all">
            {task.infoHash ?? "等待 info-hash"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button size="sm" variant="secondary" onClick={onPause}>
              <CirclePause />
              暂停
            </Button>
          ) : task.status === "PAUSED" || task.status === "FAILED" || task.status === "READY" ? (
            <Button size="sm" variant="secondary" onClick={onResume}>
              {task.status === "FAILED" ? <RotateCcw /> : <CirclePlay />}
              {task.status === "FAILED" ? "重试" : "继续"}
            </Button>
          ) : null}
          {task.status !== "COMPLETED" && task.status !== "CANCELLED" ? (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <Trash2 />
              取消
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Progress value={percent} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted tabular-nums">
          <span>{percent.toFixed(1)}%</span>
          <span>
            {formatBytes(task.downloaded)} / {formatBytes(task.length)}
          </span>
          <span>{formatSpeed(task.downloadSpeed)}</span>
          <span>ETA {formatEta(task.etaSeconds)}</span>
          {task.engine ? <span>{task.engine === "webseed" ? "WebSeed" : "WebTorrent"}</span> : null}
          {task.webSeeds ? <span>源 {task.webSeeds}</span> : null}
          {task.peers ? <span>节点 {task.peers}</span> : null}
        </div>
      </div>

      {task.error ? (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {task.error}
        </p>
      ) : null}

      {task.integrity?.ok ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-ok">
          <FolderDown className="size-4" />
          分片校验通过 {task.integrity.verifiedPieces} pieces · {task.saveLabel}
        </p>
      ) : null}

      {task.files.length > 0 ? (
        <ul className="mt-4 max-h-48 space-y-1 overflow-auto rounded-lg bg-bg/60 p-2">
          {task.files.map((file) => (
            <li key={file.index} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm">
              <Checkbox
                checked={file.selected}
                disabled={!selectable}
                onCheckedChange={() => onToggleFile(file.index)}
              />
              <span className="min-w-0 flex-1 truncate text-fg">{file.path}</span>
              <span className="font-mono text-xs text-subtle tabular-nums">{formatBytes(file.length)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
