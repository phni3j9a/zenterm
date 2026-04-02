import type {
  TmuxSession,
  SystemStatus,
  FileListResponse,
  FileContentResponse,
  FileWriteResponse,
  FileUploadResponse,
} from '@zenterm/shared';
import { useAuthStore } from '../stores/auth';

const DEFAULT_TIMEOUT = 15_000;

function getToken(): string {
  try {
    const stored = localStorage.getItem('zenterm_auth');
    if (stored) return JSON.parse(stored).token ?? '';
  } catch { /* ignore */ }
  return '';
}

function getBaseUrl(): string {
  try {
    const stored = localStorage.getItem('zenterm_auth');
    if (stored) {
      const url = JSON.parse(stored).gatewayUrl;
      if (url) return url.replace(/\/+$/, '');
    }
  } catch { /* ignore */ }
  return '';
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  const callerSignal = options?.signal;
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onCallerAbort);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${getToken()}`,
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    const base = getBaseUrl();
    const res = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { ...headers, ...options?.headers },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message =
        body && typeof body === 'object' && 'message' in body
          ? String(body.message)
          : res.statusText;
      if (res.status === 401 && path !== '/api/auth/verify') {
        useAuthStore.getState().logout();
      }
      throw new ApiError(res.status, message);
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (callerSignal?.aborted) throw error;
      throw new ApiError(0, 'Connection timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

export const verifyAuth = () =>
  apiRequest<{ ok: boolean }>('/api/auth/verify', { method: 'POST' });

export const listSessions = () =>
  apiRequest<TmuxSession[]>('/api/sessions');

export const createSession = (name?: string) =>
  apiRequest<TmuxSession>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  });

export const renameSession = (id: string, newName: string) =>
  apiRequest<TmuxSession>(`/api/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: newName }),
  });

export const deleteSession = (id: string) =>
  apiRequest<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export const getSystemStatus = (options?: { signal?: AbortSignal }) =>
  apiRequest<SystemStatus>('/api/system/status', options?.signal ? { signal: options.signal } : undefined);

export const listFiles = (path = '~', showHidden = true) =>
  apiRequest<FileListResponse>(`/api/files?path=${encodeURIComponent(path)}&showHidden=${showHidden}`);

export const getFileContent = (path: string) =>
  apiRequest<FileContentResponse>(`/api/files/content?path=${encodeURIComponent(path)}`);

export const writeFileContent = (path: string, content: string) =>
  apiRequest<FileWriteResponse>('/api/files/content', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  });

export async function uploadFile(
  file: File,
  destDir?: string,
  preserveName = false,
): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const base = getBaseUrl();
  const params = new URLSearchParams();
  if (destDir) params.set('dest', destDir);
  if (preserveName) params.set('preserveName', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${base}/api/upload${query}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String(body.message)
        : res.statusText;
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<FileUploadResponse>;
}

export function getWebSocketUrl(sessionId: string): string {
  const base = getBaseUrl();
  const token = getToken();
  const wsBase = base
    ? base.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return `${wsBase}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
}
