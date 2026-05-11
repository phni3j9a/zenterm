import type {
  ClaudeLimitsResponse, CodexLimitsResponse, SystemStatus, TmuxSession, TmuxWindow,
  FileListResponse, FileContentResponse, FileWriteResponse, FileDeleteResponse,
  FileRenameResponse, FileCopyResponse, FileMoveResponse, FileMkdirResponse, FileUploadResponse,
} from '@zenterm/shared';
import { HttpError } from './errors';

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: payload,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new HttpError(res.status, text);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = res.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as T;
  }

  async verifyToken(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return res.ok;
  }

  listSessions(): Promise<TmuxSession[]> {
    return this.request<TmuxSession[]>('GET', '/api/sessions');
  }

  listWindows(sessionId: string): Promise<TmuxWindow[]> {
    return this.request<TmuxWindow[]>(
      'GET',
      `/api/sessions/${encodeURIComponent(sessionId)}/windows`,
    );
  }

  createSession(body?: { name?: string }): Promise<TmuxSession> {
    return this.request<TmuxSession>('POST', '/api/sessions', body ?? {});
  }

  renameSession(sessionId: string, body: { name: string }): Promise<TmuxSession> {
    return this.request<TmuxSession>(
      'PATCH',
      `/api/sessions/${encodeURIComponent(sessionId)}`,
      body,
    );
  }

  killSession(sessionId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(
      'DELETE',
      `/api/sessions/${encodeURIComponent(sessionId)}`,
    );
  }

  createWindow(sessionId: string, body?: { name?: string }): Promise<TmuxWindow> {
    return this.request<TmuxWindow>(
      'POST',
      `/api/sessions/${encodeURIComponent(sessionId)}/windows`,
      body ?? {},
    );
  }

  renameWindow(
    sessionId: string,
    windowIndex: number,
    body: { name: string },
  ): Promise<TmuxWindow> {
    return this.request<TmuxWindow>(
      'PATCH',
      `/api/sessions/${encodeURIComponent(sessionId)}/windows/${windowIndex}`,
      body,
    );
  }

  killWindow(sessionId: string, windowIndex: number): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(
      'DELETE',
      `/api/sessions/${encodeURIComponent(sessionId)}/windows/${windowIndex}`,
    );
  }

  getSystemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('GET', '/api/system/status');
  }

  getClaudeLimits(): Promise<ClaudeLimitsResponse> {
    return this.request<ClaudeLimitsResponse>('GET', '/api/claude/limits');
  }

  getCodexLimits(): Promise<CodexLimitsResponse> {
    return this.request<CodexLimitsResponse>('GET', '/api/codex/limits');
  }

  listFiles(path: string, showHidden: boolean): Promise<FileListResponse> {
    const qs = `?path=${encodeURIComponent(path)}&showHidden=${showHidden ? 'true' : 'false'}`;
    return this.request<FileListResponse>('GET', `/api/files${qs}`);
  }

  getFileContent(path: string): Promise<FileContentResponse> {
    return this.request<FileContentResponse>(
      'GET',
      `/api/files/content?path=${encodeURIComponent(path)}`,
    );
  }

  writeFileContent(path: string, content: string): Promise<FileWriteResponse> {
    return this.request<FileWriteResponse>('PUT', '/api/files/content', { path, content });
  }

  deleteFile(path: string): Promise<FileDeleteResponse> {
    return this.request<FileDeleteResponse>('DELETE', '/api/files', { path });
  }

  renameFile(path: string, newName: string): Promise<FileRenameResponse> {
    return this.request<FileRenameResponse>('POST', '/api/files/rename', { path, newName });
  }

  copyFiles(sources: string[], destination: string): Promise<FileCopyResponse> {
    return this.request<FileCopyResponse>('POST', '/api/files/copy', { sources, destination });
  }

  moveFiles(sources: string[], destination: string): Promise<FileMoveResponse> {
    return this.request<FileMoveResponse>('POST', '/api/files/move', { sources, destination });
  }

  createDirectory(path: string): Promise<FileMkdirResponse> {
    return this.request<FileMkdirResponse>('POST', '/api/files/mkdir', { path });
  }

  buildRawFileUrl(path: string): string {
    return `${this.baseUrl}/api/files/raw?path=${encodeURIComponent(path)}`;
  }

  async uploadFile(file: File, destPath: string): Promise<FileUploadResponse> {
    const url = `${this.baseUrl}/api/upload?dest=${encodeURIComponent(destPath)}&preserveName=true`;
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new HttpError(res.status, text);
    }
    return (await res.json()) as FileUploadResponse;
  }
}
