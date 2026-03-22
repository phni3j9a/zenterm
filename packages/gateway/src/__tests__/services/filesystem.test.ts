import type { Stats } from 'node:fs';
import * as fs from 'node:fs';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(),
  lstatSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  readlinkSync: vi.fn(),
  realpathSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const createReadStreamMock = vi.mocked(fs.createReadStream);
const lstatSyncMock = vi.mocked(fs.lstatSync);
const readFileSyncMock = vi.mocked(fs.readFileSync);
const readdirSyncMock = vi.mocked(fs.readdirSync);
const realpathSyncMock = vi.mocked(fs.realpathSync);
const statSyncMock = vi.mocked(fs.statSync);
const writeFileSyncMock = vi.mocked(fs.writeFileSync);
const originalHome = process.env.HOME;

function makeStats(
  type: 'file' | 'directory' | 'symlink' | 'other',
  overrides: Partial<Pick<Stats, 'size' | 'mtimeMs' | 'mode'>> = {}
): Stats {
  return {
    size: overrides.size ?? 0,
    mtimeMs: overrides.mtimeMs ?? 0,
    mode:
      overrides.mode ??
      (type === 'directory' ? 0o040755 : type === 'symlink' ? 0o120777 : 0o100644),
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
    isSymbolicLink: () => type === 'symlink',
  } as Stats;
}

function makeErrnoError(message: string, code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(message), { code });
}

function expectFilesystemError(error: unknown, statusCode: number, code: string): void {
  expect((error as { statusCode?: number }).statusCode).toBe(statusCode);
  expect((error as { code?: string }).code).toBe(code);
}

async function loadFilesystemModule() {
  return import('../../services/filesystem.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.HOME = '/home/testuser';
  realpathSyncMock.mockImplementation((...rawArgs: unknown[]) => rawArgs[0] as string);
});

afterAll(() => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
});

describe('filesystem service', () => {
  it('validatePath: 正常パスを許可する', async () => {
    const { validatePath } = await loadFilesystemModule();

    expect(validatePath('~/docs/test.txt')).toBe('/home/testuser/docs/test.txt');
  });

  it('validatePath: ../../etc/passwd は PATH_TRAVERSAL', async () => {
    const { validatePath } = await loadFilesystemModule();

    try {
      validatePath('../../etc/passwd');
      throw new Error('Expected validatePath to throw');
    } catch (error) {
      expectFilesystemError(error, 403, 'PATH_TRAVERSAL');
    }
  });

  it('validatePath: ホーム外の絶対パスは PATH_TRAVERSAL', async () => {
    const { validatePath } = await loadFilesystemModule();

    try {
      validatePath('/var/log/syslog');
      throw new Error('Expected validatePath to throw');
    } catch (error) {
      expectFilesystemError(error, 403, 'PATH_TRAVERSAL');
    }
  });

  it('validatePath: 未作成ファイルでも親 symlink がホーム外なら SYMLINK_TRAVERSAL', async () => {
    const { validatePath } = await loadFilesystemModule();

    realpathSyncMock.mockImplementation((...rawArgs: unknown[]) => {
      const target = rawArgs[0] as string;
      if (target === '/home/testuser/link/file.txt') throw makeErrnoError('Not found', 'ENOENT');
      if (target === '/home/testuser/link') return '/var/log';
      return target;
    });

    try {
      validatePath('~/link/file.txt');
      throw new Error('Expected validatePath to throw');
    } catch (error) {
      expectFilesystemError(error, 403, 'SYMLINK_TRAVERSAL');
    }
  });

  it('validatePath: 親ディレクトリも存在しなければ PARENT_NOT_FOUND', async () => {
    const { validatePath } = await loadFilesystemModule();

    realpathSyncMock.mockImplementation(() => {
      throw makeErrnoError('Not found', 'ENOENT');
    });

    try {
      validatePath('~/missing/file.txt');
      throw new Error('Expected validatePath to throw');
    } catch (error) {
      expectFilesystemError(error, 404, 'PARENT_NOT_FOUND');
    }
  });

  it('listDirectory: ディレクトリ優先でソートした一覧を返す', async () => {
    const { listDirectory } = await loadFilesystemModule();
    const dirPath = '/home/testuser/projects';

    statSyncMock.mockImplementation((...rawArgs: unknown[]) => {
      const target = rawArgs[0] as string;
      if (target === dirPath) {
        return makeStats('directory', { mode: 0o040755 });
      }

      throw makeErrnoError(`Unexpected stat path: ${target}`, 'ENOENT');
    });
    readdirSyncMock.mockReturnValue(['b.txt', 'alpha', 'a.txt'] as unknown as ReturnType<typeof fs.readdirSync>);
    lstatSyncMock.mockImplementation((...rawArgs: unknown[]) => {
      const target = rawArgs[0] as string;

      if (target.endsWith('/alpha')) {
        return makeStats('directory', { size: 0, mtimeMs: 30, mode: 0o040755 });
      }

      if (target.endsWith('/a.txt')) {
        return makeStats('file', { size: 10, mtimeMs: 20, mode: 0o100644 });
      }

      if (target.endsWith('/b.txt')) {
        return makeStats('file', { size: 20, mtimeMs: 10, mode: 0o100644 });
      }

      throw makeErrnoError(`Unexpected lstat path: ${target}`, 'ENOENT');
    });

    const result = listDirectory('~/projects');

    expect(result.path).toBe(dirPath);
    expect(result.entries.map((entry) => `${entry.type}:${entry.name}`)).toEqual([
      'directory:alpha',
      'file:a.txt',
      'file:b.txt',
    ]);
  });

  it('listDirectory: showHidden=false なら隠しファイルを除外する', async () => {
    const { listDirectory } = await loadFilesystemModule();
    const dirPath = '/home/testuser/projects';

    statSyncMock.mockReturnValue(makeStats('directory', { mode: 0o040755 }));
    readdirSyncMock.mockReturnValue(['.env', 'alpha', 'note.txt'] as unknown as ReturnType<typeof fs.readdirSync>);
    lstatSyncMock.mockImplementation((...rawArgs: unknown[]) => {
      const target = rawArgs[0] as string;

      if (target.endsWith('/alpha')) {
        return makeStats('directory', { mode: 0o040755 });
      }

      if (target.endsWith('/note.txt')) {
        return makeStats('file', { mode: 0o100644 });
      }

      throw makeErrnoError(`Unexpected lstat path: ${target}`, 'ENOENT');
    });

    const result = listDirectory('~/projects', false);

    expect(result.path).toBe(dirPath);
    expect(result.entries.map((entry) => entry.name)).toEqual(['alpha', 'note.txt']);
    expect(lstatSyncMock).toHaveBeenCalledTimes(2);
  });

  it('listDirectory: 存在しないパスは 404', async () => {
    const { listDirectory } = await loadFilesystemModule();

    statSyncMock.mockImplementation(() => {
      throw makeErrnoError('Not found', 'ENOENT');
    });

    try {
      listDirectory('~/missing');
      throw new Error('Expected listDirectory to throw');
    } catch (error) {
      expectFilesystemError(error, 404, 'PATH_NOT_FOUND');
    }
  });

  it('readFileContent: 正常にファイルを読み込む', async () => {
    const { readFileContent } = await loadFilesystemModule();

    statSyncMock.mockReturnValue(makeStats('file', { size: 11, mode: 0o100644 }));
    readFileSyncMock.mockReturnValue('hello\nworld');

    expect(readFileContent('~/test.txt')).toEqual({
      path: '/home/testuser/test.txt',
      content: 'hello\nworld',
      lines: 2,
      truncated: false,
    });
  });

  it('readFileContent: 512KB 超過なら FILE_TOO_LARGE', async () => {
    const { readFileContent } = await loadFilesystemModule();

    statSyncMock.mockReturnValue(makeStats('file', { size: 512 * 1024 + 1 }));

    try {
      readFileContent('~/large.log');
      throw new Error('Expected readFileContent to throw');
    } catch (error) {
      expectFilesystemError(error, 413, 'FILE_TOO_LARGE');
    }

    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it('readFileContent: 1000 行超なら truncated=true', async () => {
    const { readFileContent } = await loadFilesystemModule();
    const content = Array.from({ length: 1001 }, (_, index) => `line-${index + 1}`).join('\n');

    statSyncMock.mockReturnValue(makeStats('file', { size: content.length }));
    readFileSyncMock.mockReturnValue(content);

    const result = readFileContent('~/long.txt');

    expect(result.truncated).toBe(true);
    expect(result.lines).toBe(1000);
    expect(result.content.split('\n')).toHaveLength(1000);
    expect(result.content).toContain('line-1000');
    expect(result.content).not.toContain('line-1001');
  });

  it('readFileRaw: MIME type と stream を返す', async () => {
    const { readFileRaw } = await loadFilesystemModule();
    const stream = {} as fs.ReadStream;

    statSyncMock.mockReturnValue(makeStats('file', { size: 128, mode: 0o100644 }));
    createReadStreamMock.mockReturnValue(stream);

    expect(readFileRaw('~/docs/image.JPG')).toEqual({
      stream,
      size: 128,
      mimeType: 'image/jpeg',
      filename: 'image.JPG'
    });
    expect(createReadStreamMock).toHaveBeenCalledWith('/home/testuser/docs/image.JPG');
  });

  it('readFileRaw: 20MB 超過なら FILE_TOO_LARGE', async () => {
    const { readFileRaw } = await loadFilesystemModule();

    statSyncMock.mockReturnValue(makeStats('file', { size: 20 * 1024 * 1024 + 1 }));

    try {
      readFileRaw('~/large.bin');
      throw new Error('Expected readFileRaw to throw');
    } catch (error) {
      expectFilesystemError(error, 413, 'FILE_TOO_LARGE');
    }

    expect(createReadStreamMock).not.toHaveBeenCalled();
  });

  it('readFileRaw: ファイルでなければ NOT_A_FILE', async () => {
    const { readFileRaw } = await loadFilesystemModule();

    statSyncMock.mockReturnValue(makeStats('directory', { mode: 0o040755 }));

    try {
      readFileRaw('~/docs');
      throw new Error('Expected readFileRaw to throw');
    } catch (error) {
      expectFilesystemError(error, 400, 'NOT_A_FILE');
    }

    expect(createReadStreamMock).not.toHaveBeenCalled();
  });

  it('writeFileContent: 新規ファイルを書き込んで bytes を返す', async () => {
    const { writeFileContent } = await loadFilesystemModule();
    const filePath = '/home/testuser/new.txt';

    statSyncMock.mockImplementation((...rawArgs: unknown[]) => {
      if ((rawArgs[0] as string) === filePath) {
        throw makeErrnoError('Not found', 'ENOENT');
      }
      throw makeErrnoError(`Unexpected stat path: ${rawArgs[0] as string}`, 'ENOENT');
    });

    expect(writeFileContent('~/new.txt', 'あa')).toEqual({
      path: filePath,
      bytes: 4,
    });
    expect(writeFileSyncMock).toHaveBeenCalledWith(filePath, 'あa', 'utf8');
  });

  it('writeFileContent: ディレクトリには書き込めない', async () => {
    const { writeFileContent } = await loadFilesystemModule();

    statSyncMock.mockReturnValue(makeStats('directory', { mode: 0o040755 }));

    try {
      writeFileContent('~/docs', 'hello');
      throw new Error('Expected writeFileContent to throw');
    } catch (error) {
      expectFilesystemError(error, 400, 'NOT_A_FILE');
    }

    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });

  it('writeFileContent: 512KB 超過なら FILE_TOO_LARGE', async () => {
    const { writeFileContent } = await loadFilesystemModule();
    const content = 'a'.repeat(512 * 1024 + 1);

    try {
      writeFileContent('~/large.txt', content);
      throw new Error('Expected writeFileContent to throw');
    } catch (error) {
      expectFilesystemError(error, 413, 'FILE_TOO_LARGE');
    }

    expect(statSyncMock).not.toHaveBeenCalled();
    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });
});
