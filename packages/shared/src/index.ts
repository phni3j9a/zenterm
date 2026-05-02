/** tmux ウィンドウ情報 (session 内の表示単位) */
export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
  zoomed: boolean;
  paneCount: number;
  cwd: string;
}

/** tmux セッション情報 (gateway ↔ mobile 共通) */
export interface TmuxSession {
  name: string;
  displayName: string;
  created: number;
  cwd: string;
  windows?: TmuxWindow[];
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

/**
 * Claude Code レート制限ウィンドウ
 * `used_percentage` は 0–100、`resets_at` は Unix epoch 秒。
 */
export interface ClaudeLimitsWindow {
  usedPercentage: number;
  resetsAt: number;
}

/**
 * statusline スクリプトが捕捉してから古いと判定するまでの秒数。
 * Claude Code はイベント駆動で statusline を再実行するため、
 * これを超えるデータは別マシン/別セッションでの消費と乖離している可能性がある。
 */
export const CLAUDE_STATUS_STALE_AFTER_SECONDS = 300;

/**
 * 1 アカウント分の Claude Code レート制限ステータス。
 * `label` は UI 表示用の識別子で、ファイル名 stem または JSON 内の `label` から決まる。
 */
export type ClaudeAccountStatus =
  | {
      label: string;
      state: 'unavailable';
      reason: 'malformed' | 'read_error';
      message: string;
    }
  | {
      label: string;
      state: 'pending';
      capturedAt: number;
      ageSeconds: number;
      stale: boolean;
    }
  | {
      label: string;
      state: 'ok';
      capturedAt: number;
      ageSeconds: number;
      stale: boolean;
      fiveHour?: ClaudeLimitsWindow;
      sevenDay?: ClaudeLimitsWindow;
    };

/**
 * `GET /api/claude/limits` レスポンス。
 * 常に HTTP 200 で返り、`state` で UI が分岐する。
 *
 * - `unconfigured`: ZenTerm 連携用ファイルが一切存在しない (セットアップ未完了)
 * - `configured`: 1 アカウント以上のファイルを検出。`accounts` に各アカウントの
 *   ステータスが入る (それぞれ `pending` / `unavailable` / `ok` のいずれか)
 *
 * ファイルパス:
 * - 単一アカウント (legacy): `~/.config/zenterm/claude-status.json`
 *   → label = "default"
 * - 複数アカウント: `~/.config/zenterm/claude-status/<name>.json`
 *   → label = ファイル内の `label` フィールド or ファイル名 stem
 */
export type ClaudeLimitsResponse =
  | { state: 'unconfigured' }
  | { state: 'configured'; accounts: ClaudeAccountStatus[] };
