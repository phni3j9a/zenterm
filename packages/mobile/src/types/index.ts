// Server はモバイル固有の型
export interface Server {
  id: string;
  name: string;
  url: string;
  token: string;
  isDefault: boolean;
}

// 共通型は @zenterm/shared から re-export
export type {
  TmuxSession,
  ClientMessage,
  ServerMessage,
  SystemStatus,
  FileEntry,
  FileListResponse,
  FileContentResponse,
  FileWriteResponse,
  FileUploadResponse,
} from '@zenterm/shared';
