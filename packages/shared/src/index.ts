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
