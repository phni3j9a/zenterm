import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';
import { useAuthStore } from '../stores/auth';

const STORAGE_KEY = 'zenterm_auth';
const originalFetch = globalThis.fetch;
const originalLogout = useAuthStore.getState().logout;

function createJsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiRequest', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: '', logout: originalLogout });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    globalThis.fetch = originalFetch;
    useAuthStore.setState({ token: null, gatewayUrl: '', logout: originalLogout });
  });

  it('logs out when a non-verify request returns 401', async () => {
    const logout = vi.fn();
    const fetchMock = vi.fn();

    useAuthStore.setState({ logout });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 'bad-token', gatewayUrl: 'http://gateway' }),
    );
    fetchMock.mockResolvedValue(
      createJsonResponse({ message: 'Unauthorized' }, {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const request = apiRequest('/api/sessions');

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized',
    });
    expect(logout).toHaveBeenCalledOnce();
  });

  it('does not log out when the verify request returns 401', async () => {
    const logout = vi.fn();
    const fetchMock = vi.fn();

    useAuthStore.setState({ logout });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 'bad-token', gatewayUrl: 'http://gateway' }),
    );
    fetchMock.mockResolvedValue(
      createJsonResponse({ message: 'Unauthorized' }, {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(apiRequest('/api/auth/verify')).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized',
    });
    expect(logout).not.toHaveBeenCalled();
  });
});
