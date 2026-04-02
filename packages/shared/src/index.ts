/** tmux セッション情報 (gateway ↔ mobile 共通) */
export interface TmuxSession {
  name: string;
  displayName: string;
  created: number;
  cwd: string;
}

/** クライアント → ゲートウェイ WebSocket メッセージ */
export type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'signal'; signal: string };

/** ゲートウェイ → クライアント WebSocket メッセージ */
export type ServerMessage =
  | { type: 'output'; data: string }
  | { type: 'sessionInfo'; session: TmuxSession }
  | { type: 'exit'; code: number; signal?: number }
  | { type: 'error'; message: string };

/** システムステータス情報 */
export interface SystemStatus {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    loadAvg: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  temperature: number | null;
  uptime: number;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  resolvedType?: 'file' | 'directory' | 'other';
  size: number;
  modified: number;
  permissions: string;
  symlinkTarget?: string;
}

export interface FileListResponse {
  path: string;
  entries: FileEntry[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  lines: number;
  truncated: boolean;
}

/** ファイル書き込みレスポンス */
export interface FileWriteResponse {
  path: string;
  bytes: number;
}

/** ファイルアップロードレスポンス */
export interface FileUploadResponse {
  success: boolean;
  path: string;
  filename: string;
  size: number;
  mimetype: string;
}

/** ファイル削除レスポンス */
export interface FileDeleteResponse {
  path: string;
  deleted: boolean;
}

/** ファイルリネームレスポンス */
export interface FileRenameResponse {
  oldPath: string;
  newPath: string;
}

/** ファイルコピーレスポンス */
export interface FileCopyResponse {
  copied: { source: string; destination: string }[];
}

/** ファイル移動レスポンス */
export interface FileMoveResponse {
  moved: { source: string; destination: string }[];
}

/** ディレクトリ作成レスポンス */
export interface FileMkdirResponse {
  path: string;
  created: boolean;
}
