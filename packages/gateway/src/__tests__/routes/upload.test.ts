process.env.AUTH_TOKEN = 'test-token';
process.env.LOG_LEVEL = 'error';

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalAuthToken = process.env.AUTH_TOKEN;
const originalHome = process.env.HOME;
const originalLogLevel = process.env.LOG_LEVEL;
const originalUploadDir = process.env.UPLOAD_DIR;
const originalUploadMaxSize = process.env.UPLOAD_MAX_SIZE;

const tmuxMocks = vi.hoisted(() => ({
  attachSession: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
  sessionExists: vi.fn(),
  listSessions: vi.fn(),
  killSession: vi.fn(),
  renameSession: vi.fn()
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
    TmuxServiceError
  };
});

async function buildTestApp(): Promise<FastifyInstance> {
  const { buildApp } = await import('../../app.js');
  const app = await buildApp();
  await app.ready();
  return app;
}

function buildFilePayload(
  filename: string,
  mimetype: string,
  content: Buffer
): { boundary: string; payload: Buffer } {
  const boundary = '----zenterm-upload-boundary';
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { boundary, payload: Buffer.concat([header, content, footer]) };
}

function buildFieldPayload(name: string, value: string): { boundary: string; payload: Buffer } {
  const boundary = '----zenterm-upload-boundary';
  const payload = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n--${boundary}--\r\n`
  );
  return { boundary, payload };
}

let app: FastifyInstance | undefined;
let expectedUploadDir = '';
let tempDir = '';

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  tempDir = mkdtempSync(join(tmpdir(), 'zenterm-upload-'));
  const homeDir = join(tempDir, 'home');
  mkdirSync(homeDir, { recursive: true });
  process.env.AUTH_TOKEN = 'test-token';
  process.env.HOME = homeDir;
  process.env.LOG_LEVEL = 'error';
  process.env.UPLOAD_DIR = '~/uploads/zenterm';
  process.env.UPLOAD_MAX_SIZE = '16';
  expectedUploadDir = join(homeDir, 'uploads', 'zenterm');
  app = await buildTestApp();
});

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }

  rmSync(tempDir, { recursive: true, force: true });
  process.env.AUTH_TOKEN = originalAuthToken;
  process.env.HOME = originalHome;
  process.env.LOG_LEVEL = originalLogLevel;
  process.env.UPLOAD_DIR = originalUploadDir;
  process.env.UPLOAD_MAX_SIZE = originalUploadMaxSize;
});

describe('upload routes', () => {
  it('POST /api/upload: 画像を保存して保存先を返す', async () => {
    const file = Buffer.from('png');
    const { boundary, payload } = buildFilePayload('image.png', 'image/png', file);

    const response = await app!.inject({
      method: 'POST',
      url: '/api/upload',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    const body = JSON.parse(response.body) as {
      filename: string;
      mimetype: string;
      path: string;
      size: number;
      success: boolean;
    };

    expect(response.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.path).toBe(join(expectedUploadDir, body.filename));
    expect(body.filename).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}_[0-9a-f]{8}\.png$/u);
    expect(body.size).toBe(file.length);
    expect(body.mimetype).toBe('image/png');
    expect(existsSync(body.path)).toBe(true);
    expect(readFileSync(body.path)).toEqual(file);
  });

  it('POST /api/upload?dest=docs/raw: dest 配下に保存する', async () => {
    const file = Buffer.from('custom');
    const { boundary, payload } = buildFilePayload('note.txt', 'text/plain', file);
    const customDir = join(process.env.HOME!, 'docs', 'raw');

    const response = await app!.inject({
      method: 'POST',
      url: '/api/upload?dest=docs/raw',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    const body = JSON.parse(response.body) as {
      filename: string;
      mimetype: string;
      path: string;
      size: number;
      success: boolean;
    };

    expect(response.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.path).toBe(join(customDir, body.filename));
    expect(body.mimetype).toBe('text/plain');
    expect(readFileSync(body.path)).toEqual(file);
  });

  it('POST /api/upload: ファイルがなければ 400 を返す', async () => {
    const { boundary, payload } = buildFieldPayload('note', 'hello');

    const response = await app!.inject({
      method: 'POST',
      url: '/api/upload',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      path: '',
      filename: '',
      size: 0,
      mimetype: ''
    });
  });

  it('POST /api/upload: 非画像 MIME type でも保存する', async () => {
    const { boundary, payload } = buildFilePayload('note.txt', 'text/plain', Buffer.from('text'));

    const response = await app!.inject({
      method: 'POST',
      url: '/api/upload',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    const body = JSON.parse(response.body) as {
      filename: string;
      mimetype: string;
      path: string;
      size: number;
      success: boolean;
    };

    expect(response.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.path).toBe(join(expectedUploadDir, body.filename));
    expect(body.mimetype).toBe('text/plain');
    expect(readFileSync(body.path)).toEqual(Buffer.from('text'));
  });

  it('POST /api/upload?dest=/var/log: ホーム外 dest は 403 を返す', async () => {
    const { boundary, payload } = buildFilePayload('note.txt', 'text/plain', Buffer.from('text'));

    const response = await app!.inject({
      method: 'POST',
      url: '/api/upload?dest=/var/log',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({
      error: 'PATH_TRAVERSAL',
      message: 'ホームディレクトリ外へのアクセスは許可されていません。'
    });
  });

  it('POST /api/upload: サイズ超過なら 413 を返して一時ファイルを削除する', async () => {
    const { boundary, payload } = buildFilePayload(
      'image.png',
      'image/png',
      Buffer.from('0123456789abcdefg')
    );

    const response = await app!.inject({
      method: 'POST',
      url: '/api/upload',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    expect(response.statusCode).toBe(413);
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      path: '',
      filename: '',
      size: 0,
      mimetype: 'image/png'
    });
    expect(readdirSync(expectedUploadDir)).toHaveLength(0);
  });
});
