// Server はモバイル固有の型
export interface Server {
  id: string;
  name: string;
  url: string;
  token: string;
  isDefault: boolean;
}

// 共通型は @ccsuite/shared から re-export
export type { TmuxSession, ClientMessage, ServerMessage } from '@ccsuite/shared';
