import { TASK_STATES, type TaskState } from "./types.ts";

const ALLOWED: Record<TaskState, TaskState[]> = {
  NEW: ["FETCHING_METADATA", "CANCELLED", "FAILED"],
  FETCHING_METADATA: ["READY", "FAILED", "CANCELLED", "PAUSED"],
  READY: ["DOWNLOADING", "CANCELLED", "FAILED", "PAUSED"],
  DOWNLOADING: ["PAUSED", "VERIFYING", "FAILED", "CANCELLED", "COMPLETED"],
  VERIFYING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  PAUSED: ["DOWNLOADING", "FETCHING_METADATA", "CANCELLED", "FAILED", "READY"],
  FAILED: ["FETCHING_METADATA", "DOWNLOADING", "CANCELLED", "READY"],
  CANCELLED: ["FETCHING_METADATA"],
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: TaskState, to: TaskState): void {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new Error(`非法状态转移 ${from} → ${to}`);
  }
}

export function isTaskState(value: string): value is TaskState {
  return (TASK_STATES as readonly string[]).includes(value);
}
