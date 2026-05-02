process.env.AUTH_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'error';

import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
let workDir: string;
let statusPath: string;

const FIXED_NOW = 1_714_500_000; // Unix秒。テスト中の時計を固定する基準

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.AUTH_TOKEN = 'test-token';
  process.env.LOG_LEVEL = 'error';
  workDir = await mkdtemp(join(tmpdir(), 'zenterm-claude-test-'));
  statusPath = join(workDir, 'claude-status.json');
  // XDG_CONFIG_HOME を一時ディレクトリに向けて、サービスのデフォルトパスをここへ寄せる
  process.env.XDG_CONFIG_HOME = workDir;
  // サービスは <XDG_CONFIG_HOME>/zenterm/claude-status.json を見るので、
  // statusPath を実体に合わせて作り直す
  const subDir = join(workDir, 'zenterm');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(subDir, { recursive: true });
  statusPath = join(subDir, 'claude-status.json');

  // 時計を固定
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW * 1000);

  app = await buildTestApp();
});

afterEach(async () => {
  vi.useRealTimers();
  if (app) {
    await app.close();
    app = undefined;
  }
  await rm(workDir, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
});

async function get() {
  const response = await app!.inject({
    method: 'GET',
    url: '/api/claude/limits',
    headers: { authorization: 'Bearer test-token' },
  });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

describe('GET /api/claude/limits', () => {
  it('ファイルが無ければ unconfigured を 200 で返す', async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body).toEqual({ state: 'unconfigured' });
  });

  it('正常なファイル (両ウィンドウあり、新鮮) は ok / stale: false', async () => {
    await writeFile(
      statusPath,
      JSON.stringify({
        schema_version: 1,
        captured_at: FIXED_NOW - 60,
        five_hour: { used_percentage: 23.5, resets_at: FIXED_NOW + 18000 },
        seven_day: { used_percentage: 41.2, resets_at: FIXED_NOW + 600000 },
      })
    );

    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body).toMatchObject({
      state: 'ok',
      capturedAt: FIXED_NOW - 60,
      ageSeconds: 60,
      stale: false,
      fiveHour: { usedPercentage: 23.5, resetsAt: FIXED_NOW + 18000 },
      sevenDay: { usedPercentage: 41.2, resetsAt: FIXED_NOW + 600000 },
    });
  });

  it('captured_at が 5 分超過なら stale: true', async () => {
    await writeFile(
      statusPath,
      JSON.stringify({
        schema_version: 1,
        captured_at: FIXED_NOW - 600,
        five_hour: { used_percentage: 50, resets_at: FIXED_NOW + 1000 },
        seven_day: { used_percentage: 60, resets_at: FIXED_NOW + 100000 },
      })
    );

    const { body } = await get();
    expect(body).toMatchObject({
      state: 'ok',
      ageSeconds: 600,
      stale: true,
    });
  });

  it('rate_limits が両方欠落なら pending', async () => {
    await writeFile(
      statusPath,
      JSON.stringify({
        schema_version: 1,
        captured_at: FIXED_NOW - 30,
        five_hour: null,
        seven_day: null,
      })
    );

    const { body } = await get();
    expect(body).toEqual({
      state: 'pending',
      capturedAt: FIXED_NOW - 30,
      ageSeconds: 30,
      stale: false,
    });
  });

  it('片方の窓だけあれば ok で欠落側は undefined', async () => {
    await writeFile(
      statusPath,
      JSON.stringify({
        schema_version: 1,
        captured_at: FIXED_NOW - 30,
        five_hour: { used_percentage: 10, resets_at: FIXED_NOW + 1000 },
        seven_day: null,
      })
    );

    const { body } = await get();
    expect(body.state).toBe('ok');
    expect(body.fiveHour).toEqual({ usedPercentage: 10, resetsAt: FIXED_NOW + 1000 });
    expect(body.sevenDay).toBeUndefined();
  });

  it('JSON パース失敗は unavailable: malformed', async () => {
    await writeFile(statusPath, 'not json {');

    const { body } = await get();
    expect(body.state).toBe('unavailable');
    expect(body.reason).toBe('malformed');
    expect(body.message).toContain('JSON parse failed');
  });

  it('スキーマ違反 (used_percentage が文字列) も unavailable: malformed', async () => {
    await writeFile(
      statusPath,
      JSON.stringify({
        schema_version: 1,
        captured_at: FIXED_NOW,
        five_hour: { used_percentage: 'high', resets_at: FIXED_NOW + 1000 },
      })
    );

    const { body } = await get();
    expect(body.state).toBe('unavailable');
    expect(body.reason).toBe('malformed');
    expect(body.message).toContain('schema validation failed');
  });

  it('読み取り権限なしなら unavailable: read_error', async () => {
    await writeFile(
      statusPath,
      JSON.stringify({
        schema_version: 1,
        captured_at: FIXED_NOW,
        five_hour: null,
        seven_day: null,
      })
    );
    // 0o000 にして読み取り不能にする (root で実行されると無効になるためその場合はスキップ)
    if (process.getuid && process.getuid() === 0) {
      return;
    }
    await chmod(statusPath, 0o000);

    try {
      const { body } = await get();
      expect(body.state).toBe('unavailable');
      expect(body.reason).toBe('read_error');
    } finally {
      await chmod(statusPath, 0o644);
    }
  });
});
