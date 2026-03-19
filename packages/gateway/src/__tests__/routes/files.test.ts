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

const filesystemMocks = vi.hoisted(() => ({
  listDirectory: vi.fn(),
  readFileContent: vi.fn(),
  writeFileContent: vi.fn(),
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

vi.mock('../../services/filesystem.js', () => {
  class FilesystemError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 500,
      public readonly code = 'FS_ERROR'
    ) {
      super(message);
      this.name = 'FilesystemError';
    }
  }

  return {
    ...filesystemMocks,
    FilesystemError,
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

describe('file routes', () => {
  it('GET /api/files: path=~ をデフォルトにディレクトリ一覧を返す', async () => {
    filesystemMocks.listDirectory.mockReturnValue({
      path: '/home/testuser',
      entries: [
        {
          name: 'docs',
          type: 'directory',
          size: 0,
          modified: 1710000000000,
          permissions: 'drwxr-xr-x',
        },
      ],
    });

    const response = await app!.inject({
      method: 'GET',
      url: '/api/files',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      path: '/home/testuser',
      entries: [
        {
          name: 'docs',
          type: 'directory',
          size: 0,
          modified: 1710000000000,
          permissions: 'drwxr-xr-x',
        },
      ],
    });
    expect(filesystemMocks.listDirectory).toHaveBeenCalledWith('~', true);
  });

  it('GET /api/files?showHidden=false: 隠しファイル非表示で一覧を返す', async () => {
    filesystemMocks.listDirectory.mockReturnValue({
      path: '/home/testuser/docs',
      entries: [],
    });

    const response = await app!.inject({
      method: 'GET',
      url: '/api/files?path=docs&showHidden=false',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      path: '/home/testuser/docs',
      entries: [],
    });
    expect(filesystemMocks.listDirectory).toHaveBeenCalledWith('docs', false);
  });

  it('GET /api/files/content?path=test.txt: ファイル内容を返す', async () => {
    filesystemMocks.readFileContent.mockReturnValue({
      path: '/home/testuser/test.txt',
      content: 'hello',
      lines: 1,
      truncated: false,
    });

    const response = await app!.inject({
      method: 'GET',
      url: '/api/files/content?path=test.txt',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      path: '/home/testuser/test.txt',
      content: 'hello',
      lines: 1,
      truncated: false,
    });
    expect(filesystemMocks.readFileContent).toHaveBeenCalledWith('test.txt');
  });

  it('PUT /api/files/content: ファイル内容を書き込む', async () => {
    filesystemMocks.writeFileContent.mockReturnValue({
      path: '/home/testuser/test.txt',
      bytes: 5,
    });

    const response = await app!.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        path: 'test.txt',
        content: 'hello',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      path: '/home/testuser/test.txt',
      bytes: 5,
    });
    expect(filesystemMocks.writeFileContent).toHaveBeenCalledWith('test.txt', 'hello');
  });
});
