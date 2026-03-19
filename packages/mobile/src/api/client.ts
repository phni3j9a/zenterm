import type {
  Server,
  TmuxSession,
  SystemStatus,
  FileListResponse,
  FileContentResponse,
  FileWriteResponse,
  FileUploadResponse,
} from '@/src/types';

const getBaseUrl = (url: string) => url.replace(/\/+$/, '');
const DEFAULT_TIMEOUT = 15_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(server: Server, path: string, options?: RequestInit): Promise<T> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT);

  // Respect caller's signal: if they abort, forward it to our controller
  const callerSignal = options?.signal;
  const onCallerAbort = () => timeoutController.abort();
  callerSignal?.addEventListener('abort', onCallerAbort);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${server.token}`,
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${getBaseUrl(server.url)}${path}`, {
      ...options,
      signal: timeoutController.signal,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : res.statusText;
      throw new ApiError(res.status, message);
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Distinguish timeout from caller-initiated abort
      if (callerSignal?.aborted) {
        throw error;
      }

      throw new ApiError(0, '接続がタイムアウトしました。サーバーの状態を確認してください。');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

export const verifyAuth = (server: Server) =>
  apiRequest<{ ok: boolean }>(server, '/api/auth/verify', { method: 'POST' });

export const listSessions = (server: Server) => apiRequest<TmuxSession[]>(server, '/api/sessions');

export const createSession = (server: Server, name?: string) =>
  apiRequest<TmuxSession>(server, '/api/sessions', {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  });

export const renameSession = (server: Server, id: string, name: string) =>
  apiRequest<TmuxSession>(server, `/api/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });

export const deleteSession = (server: Server, id: string) =>
  apiRequest<{ ok: boolean }>(server, `/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const getSystemStatus = (server: Server, options?: { signal?: AbortSignal }) =>
  apiRequest<SystemStatus>(server, '/api/system/status', options?.signal ? { signal: options.signal } : undefined);

export const listFiles = (server: Server, path = '~', showHidden = true) =>
  apiRequest<FileListResponse>(server, `/api/files?path=${encodeURIComponent(path)}&showHidden=${showHidden}`);

export const getFileContent = (server: Server, path: string) =>
  apiRequest<FileContentResponse>(server, `/api/files/content?path=${encodeURIComponent(path)}`);

export const writeFileContent = (server: Server, path: string, content: string) =>
  apiRequest<FileWriteResponse>(server, '/api/files/content', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  });

export async function uploadFile(server: Server, fileUri: string, fileName: string, mimeType: string): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('image', { uri: fileUri, name: fileName, type: mimeType } as unknown as Blob);

  const res = await fetch(`${getBaseUrl(server.url)}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${server.token}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : res.statusText;
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<FileUploadResponse>;
}
