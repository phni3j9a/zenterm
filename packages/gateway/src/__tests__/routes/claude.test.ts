process.env.AUTH_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'error';

import { mkdir, mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
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
let zentermDir: string;
let legacyFile: string;
let multiDir: string;

const FIXED_NOW = 1_714_500_000;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.AUTH_TOKEN = 'test-token';
  process.env.LOG_LEVEL = 'error';

  workDir = await mkdtemp(join(tmpdir(), 'zenterm-claude-test-'));
  process.env.XDG_CONFIG_HOME = workDir;
  zentermDir = join(workDir, 'zenterm');
  await mkdir(zentermDir, { recursive: true });
  legacyFile = join(zentermDir, 'claude-status.json');
  multiDir = join(zentermDir, 'claude-status');

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

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schema_version: 1,
    captured_at: FIXED_NOW - 60,
    five_hour: { used_percentage: 23.5, resets_at: FIXED_NOW + 18000 },
    seven_day: { used_percentage: 41.2, resets_at: FIXED_NOW + 600000 },
    ...overrides,
  });
}

describe('GET /api/claude/limits — single legacy file', () => {
  it('ファイルもディレクトリも無ければ unconfigured を 200 で返す', async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body).toEqual({ state: 'unconfigured' });
  });

  it('legacy ファイル単独・正常 (両ウィンドウあり、新鮮) は configured / state ok / label "default"', async () => {
    await writeFile(legacyFile, payload());
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.state).toBe('configured');
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]).toMatchObject({
      label: 'default',
      state: 'ok',
      capturedAt: FIXED_NOW - 60,
      ageSeconds: 60,
      stale: false,
      fiveHour: { usedPercentage: 23.5, resetsAt: FIXED_NOW + 18000 },
      sevenDay: { usedPercentage: 41.2, resetsAt: FIXED_NOW + 600000 },
    });
  });

  it('captured_at が 5 分超過なら stale: true', async () => {
    await writeFile(legacyFile, payload({ captured_at: FIXED_NOW - 600 }));
    const { body } = await get();
    expect(body.accounts[0]).toMatchObject({ state: 'ok', ageSeconds: 600, stale: true });
  });

  it('rate_limits 両方 null で pending', async () => {
    await writeFile(legacyFile, payload({ five_hour: null, seven_day: null }));
    const { body } = await get();
    expect(body.accounts[0]).toEqual({
      label: 'default',
      state: 'pending',
      capturedAt: FIXED_NOW - 60,
      ageSeconds: 60,
      stale: false,
    });
  });

  it('片方の窓だけあれば ok (欠落側 undefined)', async () => {
    await writeFile(legacyFile, payload({ seven_day: null }));
    const { body } = await get();
    expect(body.accounts[0].state).toBe('ok');
    expect(body.accounts[0].fiveHour).toEqual({ usedPercentage: 23.5, resetsAt: FIXED_NOW + 18000 });
    expect(body.accounts[0].sevenDay).toBeUndefined();
  });

  it('JSON パース失敗は unavailable: malformed (label "default")', async () => {
    await writeFile(legacyFile, 'not json {');
    const { body } = await get();
    expect(body.state).toBe('configured');
    expect(body.accounts[0]).toMatchObject({
      label: 'default',
      state: 'unavailable',
      reason: 'malformed',
    });
    expect(body.accounts[0].message).toContain('JSON parse failed');
  });

  it('スキーマ違反は unavailable: malformed', async () => {
    await writeFile(
      legacyFile,
      JSON.stringify({
        schema_version: 1,
        captured_at: FIXED_NOW,
        five_hour: { used_percentage: 'high', resets_at: FIXED_NOW + 1000 },
      })
    );
    const { body } = await get();
    expect(body.accounts[0].state).toBe('unavailable');
    expect(body.accounts[0].reason).toBe('malformed');
  });

  it('読み取り権限なしは unavailable: read_error', async () => {
    await writeFile(legacyFile, payload({ five_hour: null, seven_day: null }));
    if (process.getuid && process.getuid() === 0) return;
    await chmod(legacyFile, 0o000);
    try {
      const { body } = await get();
      expect(body.accounts[0].state).toBe('unavailable');
      expect(body.accounts[0].reason).toBe('read_error');
    } finally {
      await chmod(legacyFile, 0o644);
    }
  });
});

describe('GET /api/claude/limits — multi-account directory', () => {
  it('ディレクトリ内の各 .json を読み、ファイル名 stem を label にする', async () => {
    await mkdir(multiDir, { recursive: true });
    await writeFile(join(multiDir, 'main.json'), payload());
    await writeFile(
      join(multiDir, 'sub.json'),
      payload({
        captured_at: FIXED_NOW - 30,
        five_hour: { used_percentage: 5, resets_at: FIXED_NOW + 9000 },
        seven_day: { used_percentage: 12, resets_at: FIXED_NOW + 500000 },
      })
    );

    const { body } = await get();
    expect(body.state).toBe('configured');
    expect(body.accounts).toHaveLength(2);
    // 並びはファイル名昇順 (sort) なので main < sub
    expect(body.accounts[0].label).toBe('main');
    expect(body.accounts[1].label).toBe('sub');
    expect(body.accounts[1].fiveHour).toEqual({ usedPercentage: 5, resetsAt: FIXED_NOW + 9000 });
  });

  it('JSON 内の label フィールドはファイル名より優先される', async () => {
    await mkdir(multiDir, { recursive: true });
    await writeFile(join(multiDir, 'a1b2c3.json'), payload({ label: 'main account' }));
    const { body } = await get();
    expect(body.accounts[0].label).toBe('main account');
  });

  it('legacy ファイルとディレクトリ両方ある場合は両方返す', async () => {
    await writeFile(legacyFile, payload());
    await mkdir(multiDir, { recursive: true });
    await writeFile(join(multiDir, 'sub.json'), payload({ captured_at: FIXED_NOW - 90 }));
    const { body } = await get();
    expect(body.accounts).toHaveLength(2);
    expect(body.accounts.map((a: { label: string }) => a.label)).toEqual(['default', 'sub']);
  });

  it('1 ファイルが malformed でも他のアカウントは生きる', async () => {
    await mkdir(multiDir, { recursive: true });
    await writeFile(join(multiDir, 'main.json'), payload());
    await writeFile(join(multiDir, 'sub.json'), 'broken{');
    const { body } = await get();
    expect(body.accounts).toHaveLength(2);
    const main = body.accounts.find((a: { label: string }) => a.label === 'main');
    const sub = body.accounts.find((a: { label: string }) => a.label === 'sub');
    expect(main.state).toBe('ok');
    expect(sub.state).toBe('unavailable');
    expect(sub.reason).toBe('malformed');
  });

  it('空ディレクトリ + legacy 不在は unconfigured', async () => {
    await mkdir(multiDir, { recursive: true });
    const { body } = await get();
    expect(body).toEqual({ state: 'unconfigured' });
  });

  it('.json 以外のファイルは無視する', async () => {
    await mkdir(multiDir, { recursive: true });
    await writeFile(join(multiDir, 'README'), 'notes about this dir');
    await writeFile(join(multiDir, 'main.json'), payload());
    const { body } = await get();
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].label).toBe('main');
  });
});
