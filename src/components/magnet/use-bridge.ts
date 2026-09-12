import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTorrentMetadata } from "@/lib/magnet/metadata-proxy";
import { runDownload } from "@/lib/magnet/engine";
import { pickSaveDirectory, canUseDirectoryPicker, type DirectoryHandle } from "@/lib/magnet/filesystem";
import { LEGAL_FIXTURES } from "@/lib/magnet/fixtures";
import { parseMagnetInput } from "@/lib/magnet/parse";
import { useMagnetStore } from "@/lib/magnet/store";
import type { ParsedMetadata, TaskState } from "@/lib/magnet/types";

function originOf(): string {
  return window.location.origin;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function useMagnetBridge() {
  const store = useMagnetStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [canPickDirectory, setCanPickDirectory] = useState(false);
  const directoryRef = useRef<DirectoryHandle | null>(null);
  const abortRef = useRef(new Map<string, AbortController>());
  const metaRef = useRef(new Map<string, ParsedMetadata>());
  const piecesRef = useRef(new Map<string, Map<number, Uint8Array>>());

  useEffect(() => {
    useMagnetStore.getState().hydrate();
    setCanPickDirectory(canUseDirectoryPicker());
  }, []);

  const proxy = useCallback(async (url: string) => {
    const result = await fetchTorrentMetadata({ data: { url } });
    return decodeBase64(result.base64);
  }, []);

  const chooseDirectory = useCallback(async () => {
    const handle = await pickSaveDirectory();
    if (!handle) return;
    directoryRef.current = handle;
    store.setSaveLabel(handle.name);
    useMagnetStore.setState({ directoryEnabled: true, saveLabel: handle.name });
  }, [store]);

  const stop = useCallback((id: string, status: TaskState) => {
    abortRef.current.get(id)?.abort();
    abortRef.current.delete(id);
    store.transition(id, status);
    setBusyId((current) => (current === id ? null : current));
  }, [store]);

  const startTask = useCallback(
    async (magnet: string, opts?: { selectNames?: string[]; taskId?: string }) => {
      if (!store.consent) {
        throw new Error("请先确认：只下载你有权获取的内容");
      }
      const parsed = parseMagnetInput(magnet);
      const fixture = LEGAL_FIXTURES.find((item) => item.magnet.includes(parsed.infoHash));
      const task = opts?.taskId
        ? store.tasks.find((item) => item.id === opts.taskId) ?? store.createFromMagnet(magnet)
        : store.createFromMagnet(magnet);
      if (task.status === "DOWNLOADING" || task.status === "FETCHING_METADATA") return task;
      if (task.status === "COMPLETED") return task;

      const controller = new AbortController();
      abortRef.current.get(task.id)?.abort();
      abortRef.current.set(task.id, controller);
      setBusyId(task.id);
      store.transition(task.id, "FETCHING_METADATA", { error: null, magnet });

      const selectNames = opts?.selectNames ?? fixture?.defaultSelectNames;
      const have = piecesRef.current.get(task.id) ?? new Map();
      piecesRef.current.set(task.id, have);

      try {
        const result = await runDownload({
          magnet,
          origin: originOf(),
          directory: directoryRef.current,
          autoDownload: !directoryRef.current,
          signal: controller.signal,
          fetchMetadataProxy: proxy,
          havePieces: have.size ? new Set(have.keys()) : undefined,
          selectNames,
          selected: task.files.length
            ? task.files.filter((f) => f.selected).map((f) => f.index)
            : undefined,
          onPiece: async (piece) => {
            have.set(piece.index, piece.bytes);
          },
          hooks: {
            onStatus: (status, extra) => {
              if (status === "FETCHING_METADATA") {
                store.transition(task.id, "FETCHING_METADATA", {
                  infoHash: String(extra?.infoHash ?? parsed.infoHash),
                  name: String(extra?.name ?? task.name),
                });
              } else if (status === "READY") {
                store.transition(task.id, "READY");
              } else if (status === "DOWNLOADING") {
                const engine = extra?.engine === "webtorrent" ? "webtorrent" : "webseed";
                store.transition(task.id, "DOWNLOADING", { engine });
              } else if (status === "VERIFYING") {
                store.transition(task.id, "VERIFYING");
              } else if (status === "COMPLETED") {
                store.transition(task.id, "COMPLETED", {
                  downloaded: task.length,
                  downloadSpeed: 0,
                  etaSeconds: 0,
                });
              }
            },
            onProgress: (event) => {
              store.patchTask(task.id, {
                downloaded: event.downloaded,
                downloadSpeed: event.downloadSpeed,
                etaSeconds: event.etaSeconds,
                peers: event.peers,
                webSeeds: event.webSeeds,
              });
            },
            onMetadata: (meta) => {
              metaRef.current.set(task.id, meta);
              store.applyMetadata(task.id, meta, selectNames);
              const selected = meta.files
                .filter((file) => !selectNames?.length || selectNames.includes(file.name))
                .map((file) => file.index);
              store.patchTask(task.id, {
                length: selected.reduce((sum, i) => sum + (meta.files[i]?.length ?? 0), 0),
              });
            },
            onError: (message) => {
              store.transition(task.id, "FAILED", { error: message });
            },
          },
        });

        store.transition(task.id, "COMPLETED", {
          engine: result.engine,
          downloaded: result.files.reduce((sum, f) => sum + f.data.byteLength, 0),
          integrity: {
            ok: true,
            verifiedPieces: result.verifiedPieces,
            totalPieces: result.verifiedPieces,
          },
          saveMode: directoryRef.current ? "directory" : "browser-download",
          saveLabel: directoryRef.current ? directoryRef.current.name : "浏览器下载",
          error: null,
        });
        piecesRef.current.delete(task.id);
      } catch (error) {
        if (controller.signal.aborted) {
          if (useMagnetStore.getState().tasks.find((item) => item.id === task.id)?.status !== "CANCELLED") {
            store.transition(task.id, "PAUSED");
          }
        } else {
          const message = error instanceof Error ? error.message : String(error);
          store.transition(task.id, "FAILED", { error: message });
        }
      } finally {
        abortRef.current.delete(task.id);
        setBusyId((current) => (current === task.id ? null : current));
      }
      return task;
    },
    [proxy, store],
  );

  const pause = useCallback((id: string) => stop(id, "PAUSED"), [stop]);
  const cancel = useCallback((id: string) => {
    piecesRef.current.delete(id);
    stop(id, "CANCELLED");
  }, [stop]);

  const resume = useCallback(
    async (id: string) => {
      const task = useMagnetStore.getState().tasks.find((item) => item.id === id);
      if (!task) return;
      await startTask(task.magnet, { taskId: id });
    },
    [startTask],
  );

  return {
    ...store,
    busyId,
    canPickDirectory,
    chooseDirectory,
    startTask,
    pause,
    resume,
    cancel,
  };
}
