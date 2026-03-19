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

const systemMocks = vi.hoisted(() => ({
  getSystemStatus: vi.fn(),
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

vi.mock('../../services/system.js', () => ({
  ...systemMocks,
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

describe('system routes', () => {
  it('GET /api/system/status: ステータスを返す', async () => {
    systemMocks.getSystemStatus.mockReturnValue({
      cpu: {
        usage: 12.5,
        cores: 4,
        model: 'Raspberry Pi 5',
        loadAvg: [0.5, 0.25, 0.1],
      },
      memory: {
        total: 8000,
        used: 4000,
        free: 4000,
        percent: 50,
      },
      disk: {
        total: 1000,
        used: 400,
        free: 600,
        percent: 40,
      },
      temperature: 48.2,
      uptime: 7200,
    });

    const response = await app!.inject({
      method: 'GET',
      url: '/api/system/status',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      cpu: {
        usage: 12.5,
        cores: 4,
        model: 'Raspberry Pi 5',
        loadAvg: [0.5, 0.25, 0.1],
      },
      memory: {
        total: 8000,
        used: 4000,
        free: 4000,
        percent: 50,
      },
      disk: {
        total: 1000,
        used: 400,
        free: 600,
        percent: 40,
      },
      temperature: 48.2,
      uptime: 7200,
    });
    expect(systemMocks.getSystemStatus).toHaveBeenCalledOnce();
  });
});
