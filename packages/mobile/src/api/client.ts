import type { Server, TmuxSession } from '@/src/types';

const getBaseUrl = (url: string) => url.replace(/\/+$/, '');

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
  const headers: Record<string, string> = {
    Authorization: `Bearer ${server.token}`,
  };

  // Only set Content-Type for requests that have a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${getBaseUrl(server.url)}${path}`, {
    ...options,
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
}

export const verifyAuth = (server: Server) =>
  apiRequest<{ ok: boolean }>(server, '/api/auth/verify', { method: 'POST' });

export const listSessions = (server: Server) => apiRequest<TmuxSession[]>(server, '/api/sessions');

export const createSession = (server: Server, name?: string) =>
  apiRequest<TmuxSession>(server, '/api/sessions', {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  });

export const deleteSession = (server: Server, id: string) =>
  apiRequest<{ ok: boolean }>(server, `/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
