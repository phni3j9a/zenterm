process.env.AUTH_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'error';

import type { FastifyInstance } from 'fastify';
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

describe('session routes', () => {
  it('GET /api/sessions: セッション一覧を返す', async () => {
    tmuxMocks.listSessions.mockReturnValue([
      {
        name: 'zen_1',
        displayName: '1',
        created: 1710000000000,
        cwd: '/home/testuser',
      },
    ]);

    const response = await app!.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      {
        name: 'zen_1',
        displayName: '1',
        created: 1710000000000,
        cwd: '/home/testuser',
      },
    ]);
    expect(tmuxMocks.listSessions).toHaveBeenCalledOnce();
  });

  it('POST /api/sessions: セッションを作成する', async () => {
    tmuxMocks.createSession.mockReturnValue({
      name: 'zen_dev',
      displayName: 'dev',
      created: 1710000000000,
      cwd: '/home/testuser',
    });

    const response = await app!.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        name: 'dev',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({
      name: 'zen_dev',
      displayName: 'dev',
      created: 1710000000000,
      cwd: '/home/testuser',
    });
    expect(tmuxMocks.createSession).toHaveBeenCalledWith('dev');
  });

  it('POST /api/sessions: バリデーションエラーなら 400', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        name: '',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(tmuxMocks.createSession).not.toHaveBeenCalled();
  });

  it('PATCH /api/sessions/:sessionId: リネーム成功', async () => {
    tmuxMocks.renameSession.mockReturnValue({
      name: 'zen_renamed',
      displayName: 'renamed',
      created: 1710000000000,
      cwd: '/home/testuser',
    });

    const response = await app!.inject({
      method: 'PATCH',
      url: '/api/sessions/original',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        name: 'renamed',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      name: 'zen_renamed',
      displayName: 'renamed',
      created: 1710000000000,
      cwd: '/home/testuser',
    });
    expect(tmuxMocks.renameSession).toHaveBeenCalledWith('original', 'renamed');
  });

  it('DELETE /api/sessions/:sessionId: 削除成功', async () => {
    const response = await app!.inject({
      method: 'DELETE',
      url: '/api/sessions/to-delete',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
    expect(tmuxMocks.killSession).toHaveBeenCalledWith('to-delete');
  });
});
