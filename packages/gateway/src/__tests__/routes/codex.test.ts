process.env.AUTH_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'error';

import { mkdir, mkdtemp, rm, writeFile, utimes } from 'node:fs/promises';
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
let codexHome: string;
let sessionsDir: string;

const FIXED_NOW = 1_777_734_310; // matches the fixture data

// Pin the day-bucket to whatever UTC day FIXED_NOW falls on so the walker finds it.
function dayBucket(epochSec: number) {
  const d = new Date(epochSec * 1000);
  const yyyy = d.getUTCFullYear().toString();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { yyyy, mm, dd };
}

async function writeSession(name: string, lines: unknown[], epochSec = FIXED_NOW) {
  const { yyyy, mm, dd } = dayBucket(epochSec);
  const dir = join(sessionsDir, yyyy, mm, dd);
  await mkdir(dir, { recursive: true });
  const path = join(dir, name);
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  await writeFile(path, body);
  return path;
}

function tokenCount(rateLimits: unknown, tsEpochSec = FIXED_NOW - 60) {
  return {
    timestamp: new Date(tsEpochSec * 1000).toISOString(),
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: { total_token_usage: { total_tokens: 100 } },
      rate_limits: rateLimits,
    },
  };
}

const standardRateLimits = {
  limit_id: 'codex',
  primary: { used_percent: 1.0, window_minutes: 300, resets_at: FIXED_NOW + 18000 },
  secondary: { used_percent: 5.0, window_minutes: 10080, resets_at: FIXED_NOW + 600000 },
  plan_type: 'plus',
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.AUTH_TOKEN = 'test-token';
  process.env.LOG_LEVEL = 'error';

  const work = await mkdtemp(join(tmpdir(), 'zenterm-codex-test-'));
  codexHome = join(work, '.codex');
  sessionsDir = join(codexHome, 'sessions');
  process.env.CODEX_HOME = codexHome;

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
  await rm(codexHome, { recursive: true, force: true });
  delete process.env.CODEX_HOME;
});

async function get() {
  const response = await app!.inject({
    method: 'GET',
    url: '/api/codex/limits',
    headers: { authorization: 'Bearer test-token' },
  });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

describe('GET /api/codex/limits — discovery', () => {
  it('CODEX_HOME 自体が無ければ unconfigured を 200 で返す', async () => {
    // codexHome was created via mkdtemp parent only; .codex itself does not exist yet
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body).toEqual({ state: 'unconfigured' });
  });

  it('CODEX_HOME はあるが sessions/ ディレクトリ無しは pending', async () => {
    await mkdir(codexHome, { recursive: true });
    const { body } = await get();
    expect(body.state).toBe('configured');
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]).toMatchObject({ label: 'default', state: 'pending' });
  });

  it('sessions ディレクトリはあるが jsonl 1 つも無ければ pending', async () => {
    await mkdir(sessionsDir, { recursive: true });
    const { body } = await get();
    expect(body.accounts[0].state).toBe('pending');
  });
});

describe('GET /api/codex/limits — token_count parsing', () => {
  it('rate_limits 含む token_count があれば ok (primary→fiveHour, secondary→sevenDay, plan_type 反映)', async () => {
    await writeSession('rollout-a.jsonl', [tokenCount(standardRateLimits)]);
    const { body } = await get();
    expect(body.state).toBe('configured');
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]).toMatchObject({
      label: 'default',
      state: 'ok',
      capturedAt: FIXED_NOW - 60,
      ageSeconds: 60,
      stale: false,
      planType: 'plus',
      fiveHour: { usedPercentage: 1.0, resetsAt: FIXED_NOW + 18000 },
      sevenDay: { usedPercentage: 5.0, resetsAt: FIXED_NOW + 600000 },
    });
  });

  it('captured_at が 5 分超過なら stale: true', async () => {
    await writeSession('rollout-stale.jsonl', [
      tokenCount(standardRateLimits, FIXED_NOW - 600),
    ]);
    const { body } = await get();
    expect(body.accounts[0]).toMatchObject({ state: 'ok', ageSeconds: 600, stale: true });
  });

  it('token_count はあるが rate_limits が無ければ pending', async () => {
    await writeSession('rollout-norl.jsonl', [tokenCount(undefined)]);
    const { body } = await get();
    expect(body.accounts[0].state).toBe('pending');
  });

  it('primary/secondary 片方欠落でも ok (欠落側 undefined)', async () => {
    await writeSession('rollout-partial.jsonl', [
      tokenCount({ ...standardRateLimits, secondary: null }),
    ]);
    const { body } = await get();
    expect(body.accounts[0].state).toBe('ok');
    expect(body.accounts[0].fiveHour).toEqual({
      usedPercentage: 1.0,
      resetsAt: FIXED_NOW + 18000,
    });
    expect(body.accounts[0].sevenDay).toBeUndefined();
  });

  it('壊れた行は skip して次の行を見る', async () => {
    await writeSession('rollout-mixed.jsonl', [
      'not json line',
      { type: 'event_msg', payload: { type: 'token_count', rate_limits: 'broken' } },
      tokenCount(standardRateLimits),
    ]);
    const { body } = await get();
    expect(body.accounts[0].state).toBe('ok');
  });

  it('複数ファイルがあれば mtime 最新の方を採用する', async () => {
    const olderPath = await writeSession('rollout-old.jsonl', [
      tokenCount({
        ...standardRateLimits,
        primary: { used_percent: 90, window_minutes: 300, resets_at: FIXED_NOW + 1000 },
      }),
    ]);
    const newerPath = await writeSession('rollout-new.jsonl', [
      tokenCount(standardRateLimits),
    ]);
    // Force mtime ordering
    const oldT = new Date((FIXED_NOW - 3600) * 1000);
    const newT = new Date((FIXED_NOW - 60) * 1000);
    await utimes(olderPath, oldT, oldT);
    await utimes(newerPath, newT, newT);

    const { body } = await get();
    expect(body.accounts[0].fiveHour.usedPercentage).toBe(1.0);
  });

  it('jsonl 末尾から逆順走査: 最新の token_count を採用', async () => {
    await writeSession('rollout-multi-events.jsonl', [
      tokenCount({
        ...standardRateLimits,
        primary: { used_percent: 10, window_minutes: 300, resets_at: FIXED_NOW + 1000 },
      }, FIXED_NOW - 300),
      tokenCount(standardRateLimits, FIXED_NOW - 60),
    ]);
    const { body } = await get();
    expect(body.accounts[0].capturedAt).toBe(FIXED_NOW - 60);
    expect(body.accounts[0].fiveHour.usedPercentage).toBe(1.0);
  });
});
