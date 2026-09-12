import { create } from "zustand";
import { LEGAL_FIXTURES } from "./fixtures.ts";
import { parseMagnetInput } from "./parse.ts";
import { loadConsent, loadTasks, saveConsent, saveTasks } from "./persist.ts";
import { canTransition } from "./transitions.ts";
import type { ParsedMetadata, TaskSnapshot, TaskState } from "./types.ts";
import { selectedLength } from "./pieces.ts";

function now() {
  return Date.now();
}

function newId(): string {
  return crypto.randomUUID();
}

type MagnetStore = {
  tasks: TaskSnapshot[];
  input: string;
  consent: boolean;
  saveLabel: string;
  directoryEnabled: boolean;
  hydrate: () => void;
  setInput: (value: string) => void;
  setConsent: (value: boolean) => void;
  setSaveLabel: (value: string) => void;
  upsertTask: (task: TaskSnapshot) => void;
  patchTask: (id: string, patch: Partial<TaskSnapshot>) => void;
  transition: (id: string, status: TaskState, patch?: Partial<TaskSnapshot>) => void;
  removeTask: (id: string) => void;
  findByHash: (infoHash: string) => TaskSnapshot | undefined;
  createFromMagnet: (magnet: string) => TaskSnapshot;
  applyMetadata: (id: string, meta: ParsedMetadata, selectNames?: string[]) => void;
  toggleFile: (id: string, fileIndex: number) => void;
};

const emptyTask = (magnet: string): TaskSnapshot => {
  let infoHash: string | null = null;
  let name = "未命名任务";
  try {
    const parsed = parseMagnetInput(magnet);
    infoHash = parsed.infoHash;
    name = parsed.name ?? parsed.infoHash.slice(0, 8);
  } catch {
    /* keep defaults; caller validates */
  }
  return {
    id: newId(),
    magnet,
    infoHash,
    name,
    status: "NEW",
    error: null,
    files: [],
    downloaded: 0,
    length: 0,
    pieceLength: 0,
    pieceCount: 0,
    downloadSpeed: 0,
    etaSeconds: null,
    peers: 0,
    webSeeds: 0,
    engine: null,
    createdAt: now(),
    updatedAt: now(),
    integrity: null,
    saveMode: "none",
    saveLabel: "完成后由浏览器保存",
  };
};

export const useMagnetStore = create<MagnetStore>((set, get) => ({
  tasks: [],
  input: "",
  consent: false,
  saveLabel: "完成后由浏览器保存",
  directoryEnabled: false,
  hydrate: () => {
    set({
      tasks: loadTasks(),
      consent: loadConsent(),
    });
  },
  setInput: (value) => set({ input: value }),
  setConsent: (value) => {
    saveConsent(value);
    set({ consent: value });
  },
  setSaveLabel: (value) => set({ saveLabel: value }),
  upsertTask: (task) =>
    set((state) => {
      const tasks = state.tasks.some((t) => t.id === task.id)
        ? state.tasks.map((t) => (t.id === task.id ? task : t))
        : [task, ...state.tasks];
      saveTasks(tasks);
      return { tasks };
    }),
  patchTask: (id, patch) =>
    set((state) => {
      const tasks = state.tasks.map((task) =>
        task.id === id ? { ...task, ...patch, updatedAt: now() } : task,
      );
      saveTasks(tasks);
      return { tasks };
    }),
  transition: (id, status, patch) =>
    set((state) => {
      const tasks = state.tasks.map((task) => {
        if (task.id !== id) return task;
        if (!canTransition(task.status, status) && task.status !== status) {
          return { ...task, error: `无法从 ${task.status} 进入 ${status}`, updatedAt: now() };
        }
        return {
          ...task,
          ...patch,
          status,
          updatedAt: now(),
          error: patch?.error ?? (status === "FAILED" ? task.error : null),
        };
      });
      saveTasks(tasks);
      return { tasks };
    }),
  removeTask: (id) =>
    set((state) => {
      const tasks = state.tasks.filter((task) => task.id !== id);
      saveTasks(tasks);
      return { tasks };
    }),
  findByHash: (infoHash) => get().tasks.find((task) => task.infoHash === infoHash),
  createFromMagnet: (magnet) => {
    const parsed = parseMagnetInput(magnet);
    const existing = get().tasks.find(
      (task) => task.infoHash === parsed.infoHash && task.status !== "CANCELLED" && task.status !== "FAILED",
    );
    if (existing) return existing;
    const fixture = LEGAL_FIXTURES.find((item) => item.magnet.includes(parsed.infoHash));
    const task = emptyTask(magnet);
    task.infoHash = parsed.infoHash;
    task.name = parsed.name ?? fixture?.title ?? parsed.infoHash.slice(0, 12);
    get().upsertTask(task);
    return task;
  },
  applyMetadata: (id, meta, selectNames) => {
    const selectedNames = new Set(selectNames ?? []);
    const files = meta.files.map((file) => ({
      ...file,
      selected: selectedNames.size === 0 || selectedNames.has(file.name),
    }));
    const selected = files.filter((f) => f.selected).map((f) => f.index);
    get().patchTask(id, {
      infoHash: meta.infoHash,
      name: meta.name,
      files,
      length: selectedLength(files, selected),
      pieceLength: meta.pieceLength,
      pieceCount: meta.pieces.length,
      webSeeds: meta.urlList.length,
    });
  },
  toggleFile: (id, fileIndex) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task || (task.status !== "READY" && task.status !== "PAUSED" && task.status !== "NEW")) return;
    const files = task.files.map((file) =>
      file.index === fileIndex ? { ...file, selected: !file.selected } : file,
    );
    const selected = files.filter((f) => f.selected).map((f) => f.index);
    get().patchTask(id, { files, length: selectedLength(files, selected) });
  },
}));
