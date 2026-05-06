process.env.AUTH_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'error';

import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tmuxMocks = vi.hoisted(() => ({
  attachSession: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
  sessionExists: vi.fn(),
  listSessions: vi.fn(),
  killSession: vi.fn(),
  renameSession: vi.fn(),
}));

const tmuxControlMocks = vi.hoisted(() => ({
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock('../../services/tmux.js', () => {
  class TmuxServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 500,
      public readonly code = 'TMUX_ERROR'
    ) {
      super(message);
      this.name = 'TmuxServiceError';
    }
  }

  return {
    ...tmuxMocks,
    TmuxServiceError,
  };
});

vi.mock('../../services/tmuxControl.js', () => ({
  tmuxControlService: tmuxControlMocks,
}));

async function buildTestApp(): Promise<FastifyInstance> {
  const { buildApp } = await import('../../app.js');
  const app = await buildApp();
  await app.ready();
  return app;
}

let app: FastifyInstance | undefined;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.AUTH_TOKEN = 'test-token';
  process.env.LOG_LEVEL = 'error';
  app = await buildTestApp();
});

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe('auth routes', () => {
  it('POST /api/auth/verify: 正しいトークンなら 200', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/auth/verify',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it('POST /api/auth/verify: トークンなしなら 401', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/auth/verify',
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /api/auth/verify: 不正トークンなら 401', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/auth/verify',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /health: 認証なしで 200', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual({ ok: true });
  });

  it('GET /embed/terminal: モバイル WebView 用 HTML は認証なしで配信する', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/embed/terminal?sessionId=session-1&token=test-token',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('id="terminal"');
  });

  it('GET /terminal/lib/xterm.min.js: モバイル WebView 用 asset は認証なしで配信する', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/terminal/lib/xterm.min.js',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/javascript');
  });

  it('GET /app/login: 旧 Web SPA パスは public 扱いしない', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/app/login',
    });

    expect(response.statusCode).toBe(401);
  });

  it('WS /ws/events: アプリの tmux event stream は query token で接続できる', async () => {
    await app!.listen({ port: 0, host: '127.0.0.1' });
    const address = app!.server.address() as AddressInfo;

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/events?token=test-token`);
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('events websocket connection timed out'));
      }, 2000);

      socket.on('open', () => {
        clearTimeout(timer);
        socket.close();
        resolve();
      });
      socket.on('unexpected-response', (_request, response) => {
        clearTimeout(timer);
        reject(new Error(`events websocket rejected with ${response.statusCode}`));
      });
      socket.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    expect(tmuxControlMocks.subscribe).toHaveBeenCalledOnce();
  });
});
