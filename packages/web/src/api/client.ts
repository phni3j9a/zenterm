import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
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
}
