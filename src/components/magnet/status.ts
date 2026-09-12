import type { TaskState } from "@/lib/magnet/types";

export const STATUS_LABEL: Record<TaskState, string> = {
  NEW: "新建",
  FETCHING_METADATA: "获取元数据",
  READY: "就绪",
  DOWNLOADING: "下载中",
  VERIFYING: "校验",
  COMPLETED: "完成",
  PAUSED: "已暂停",
  FAILED: "失败",
  CANCELLED: "已取消",
};

export const STATUS_TONE: Record<TaskState, "idle" | "run" | "ok" | "warn" | "danger"> = {
  NEW: "idle",
  FETCHING_METADATA: "run",
  READY: "idle",
  DOWNLOADING: "run",
  VERIFYING: "run",
  COMPLETED: "ok",
  PAUSED: "warn",
  FAILED: "danger",
  CANCELLED: "idle",
};
