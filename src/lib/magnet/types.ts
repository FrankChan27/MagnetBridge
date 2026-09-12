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

export const ACTIVE_STATES: TaskState[] = [
  "FETCHING_METADATA",
  "DOWNLOADING",
  "VERIFYING",
];

export const TERMINAL_STATES: TaskState[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export type EngineKind = "webseed" | "webtorrent";

export type TorrentFileInfo = {
  index: number;
  path: string;
  name: string;
  length: number;
  offset: number;
  selected: boolean;
};

export type IntegrityReport = {
  ok: boolean;
  verifiedPieces: number;
  totalPieces: number;
  failedPiece?: number;
};

export type TaskSnapshot = {
  id: string;
  magnet: string;
  infoHash: string | null;
  name: string;
  status: TaskState;
  error: string | null;
  files: TorrentFileInfo[];
  downloaded: number;
  length: number;
  pieceLength: number;
  pieceCount: number;
  downloadSpeed: number;
  etaSeconds: number | null;
  peers: number;
  webSeeds: number;
  engine: EngineKind | null;
  createdAt: number;
  updatedAt: number;
  integrity: IntegrityReport | null;
  saveMode: "directory" | "browser-download" | "none";
  saveLabel: string;
};

export type ParsedMagnet = {
  magnet: string;
  infoHash: string;
  name: string | null;
  announce: string[];
  urlList: string[];
  exactSources: string[];
};

export type ParsedMetadata = {
  infoHash: string;
  name: string;
  announce: string[];
  urlList: string[];
  files: TorrentFileInfo[];
  length: number;
  pieceLength: number;
  lastPieceLength: number;
  pieces: string[];
  torrentFile: Uint8Array | null;
};

export type ProgressEvent = {
  downloaded: number;
  length: number;
  downloadSpeed: number;
  peers: number;
  webSeeds: number;
  etaSeconds: number | null;
};
