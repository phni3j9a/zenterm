import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { ApiClient } from '../client';
import { HttpError } from '../errors';

describe('ApiClient', () => {
  const baseUrl = 'http://gateway.test:18765';
  const token = '1234';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifyToken sends Authorization Bearer and returns true on 200', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const client = new ApiClient(baseUrl, token);
    const ok = await client.verifyToken();
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/auth/verify');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer 1234',
    });
  });

  it('verifyToken returns false on 401', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const client = new ApiClient(baseUrl, token);
    expect(await client.verifyToken()).toBe(false);
  });

  it('listSessions parses array response', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: 'zen_dev', displayName: 'dev', created: 1, cwd: '/home', windows: [] },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const sessions = await client.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].displayName).toBe('dev');
  });

  it('throws HttpError on non-2xx (other than auth verify)', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const client = new ApiClient(baseUrl, token);
    await expect(client.listSessions()).rejects.toBeInstanceOf(HttpError);
  });
});
