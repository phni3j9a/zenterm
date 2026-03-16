import type { Server, TmuxSession } from '@/src/types';

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
