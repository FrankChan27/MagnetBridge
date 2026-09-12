import type { TaskSnapshot } from "./types.ts";
import { isTaskState } from "./transitions.ts";

const KEY = "magnetbridge.tasks.v1";
const CONSENT_KEY = "magnetbridge.consent.v1";

export function loadConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveConsent(value: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadTasks(): TaskSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TaskSnapshot[];
    return parsed.map((task) => {
      let status = isTaskState(task.status) ? task.status : "FAILED";
      if (status === "DOWNLOADING" || status === "FETCHING_METADATA" || status === "VERIFYING") {
        status = "PAUSED";
      }
      return { ...task, status, downloadSpeed: 0 };
    });
  } catch {
    return [];
  }
}

export function saveTasks(tasks: TaskSnapshot[]): void {
  try {
    const slim = tasks.map((task) => ({
      ...task,
      downloadSpeed: 0,
    }));
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* quota */
  }
}
