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

  it('listSessions throws HttpError with status 401 on auth failure', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const client = new ApiClient(baseUrl, token);
    await expect(client.listSessions()).rejects.toMatchObject({
      status: 401,
    });
  });

  it('createSession POSTs to /api/sessions and returns session', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ name: 'zen_new', displayName: 'new', created: 1, cwd: '/home', windows: [] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const session = await client.createSession({ name: 'new' });
    expect(session.displayName).toBe('new');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe('{"name":"new"}');
  });

  it('createSession works with no name', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ name: 'zen_auto', displayName: 'auto', created: 1, cwd: '/', windows: [] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    await client.createSession();
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).body).toBe('{}');
  });

  it('renameSession PATCHes /api/sessions/:id and returns updated session', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ name: 'zen_renamed', displayName: 'renamed', created: 1, cwd: '/', windows: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const session = await client.renameSession('old', { name: 'renamed' });
    expect(session.displayName).toBe('renamed');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/old');
    expect((init as RequestInit).method).toBe('PATCH');
  });

  it('killSession DELETEs /api/sessions/:id', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const client = new ApiClient(baseUrl, token);
    await client.killSession('old');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/old');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('renameSession encodes session id with special characters', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response('{"name":"x","displayName":"x","created":1,"cwd":"/","windows":[]}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = new ApiClient(baseUrl, token);
    await client.renameSession('a b', { name: 'x' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/a%20b');
  });

  it('createWindow POSTs to /api/sessions/:id/windows', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ index: 2, name: 'w2', active: true, zoomed: false, paneCount: 1, cwd: '/' }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const window = await client.createWindow('dev', { name: 'w2' });
    expect(window.index).toBe(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/dev/windows');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe('{"name":"w2"}');
  });

  it('renameWindow PATCHes /api/sessions/:id/windows/:idx', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ index: 1, name: 'renamed', active: false, zoomed: false, paneCount: 1, cwd: '/' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new ApiClient(baseUrl, token);
    const window = await client.renameWindow('dev', 1, { name: 'renamed' });
    expect(window.name).toBe('renamed');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/dev/windows/1');
    expect((init as RequestInit).method).toBe('PATCH');
  });

  it('killWindow DELETEs /api/sessions/:id/windows/:idx', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const client = new ApiClient(baseUrl, token);
    await client.killWindow('dev', 1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test:18765/api/sessions/dev/windows/1');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  describe('ApiClient.getSystemStatus', () => {
    it('GETs /api/system/status with Bearer', async () => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cpu: { usage: 5, cores: 6, model: 'i5', loadAvg: [0.4, 0.5, 0.6] },
            memory: { total: 32e9, used: 6e9, free: 26e9, percent: 18 },
            disk: { total: 256e9, used: 100e9, free: 156e9, percent: 39 },
            temperature: null,
            uptime: 1000,
            gatewayVersion: '0.5.7',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      const client = new ApiClient(baseUrl, token);
      const res = await client.getSystemStatus();
      expect(res.gatewayVersion).toBe('0.5.7');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://gateway.test:18765/api/system/status');
      expect((init as RequestInit).method).toBe('GET');
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer 1234',
      });
    });

    it('throws HttpError on 401', async () => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
      const client = new ApiClient(baseUrl, token);
      await expect(client.getSystemStatus()).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('ApiClient.getClaudeLimits', () => {
    it('GETs /api/claude/limits', async () => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ state: 'unconfigured' }),
      });
      const c = new ApiClient(baseUrl, token);
      const res = await c.getClaudeLimits();
      expect(res).toEqual({ state: 'unconfigured' });
      expect(fetchMock).toHaveBeenCalledWith('http://gateway.test:18765/api/claude/limits', expect.any(Object));
    });
  });

  describe('ApiClient.getCodexLimits', () => {
    it('GETs /api/codex/limits', async () => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ state: 'unconfigured' }),
      });
      const c = new ApiClient(baseUrl, token);
      const res = await c.getCodexLimits();
      expect(res).toEqual({ state: 'unconfigured' });
      expect(fetchMock).toHaveBeenCalledWith('http://gateway.test:18765/api/codex/limits', expect.any(Object));
    });
  });
});
