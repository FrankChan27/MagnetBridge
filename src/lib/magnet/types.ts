export const TASK_STATES = [
  "NEW",
  "FETCHING_METADATA",
  "READY",
  "DOWNLOADING",
  "VERIFYING",
  "COMPLETED",
  "PAUSED",
  "FAILED",
  "CANCELLED",
] as const;

export type TaskState = (typeof TASK_STATES)[number];
