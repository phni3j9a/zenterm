import * as childProcess from 'node:child_process';
import * as nodePty from 'node-pty';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

const execFileSyncMock = vi.mocked(childProcess.execFileSync);
const spawnMock = vi.mocked(nodePty.spawn);
const originalHome = process.env.HOME;
const originalAuthToken = process.env.AUTH_TOKEN;
const originalSessionPrefix = process.env.SESSION_PREFIX;
const originalLogLevel = process.env.LOG_LEVEL;

function createTmuxCommandError(message: string): Error & {
  stderr: string;
  stdout: string;
  status: number;
} {
  return Object.assign(new Error(message), {
    stderr: message,
    stdout: '',
    status: 1,
  });
}

function installExecMock(handler: (args: string[]) => string): void {
  execFileSyncMock.mockImplementation((...rawArgs: unknown[]) => {
    const args = (rawArgs[1] as string[] | undefined) ?? [];
    return handler([...args]);
  });
}

async function loadTmuxModule() {
  return import('../../services/tmux.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.HOME = '/home/testuser';
  process.env.AUTH_TOKEN = 'test-token';
  process.env.SESSION_PREFIX = 'zen_';
  process.env.LOG_LEVEL = 'error';
});

afterAll(() => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }

  if (originalAuthToken === undefined) {
    delete process.env.AUTH_TOKEN;
  } else {
    process.env.AUTH_TOKEN = originalAuthToken;
  }

  if (originalSessionPrefix === undefined) {
    delete process.env.SESSION_PREFIX;
  } else {
    process.env.SESSION_PREFIX = originalSessionPrefix;
  }

  if (originalLogLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLogLevel;
  }
});

describe('tmux service', () => {
  it('listSessions: tmux 出力を複数セッションにパースする', async () => {
    const { listSessions } = await loadTmuxModule();

    installExecMock((args) => {
      expect(args).toEqual([
        'list-sessions',
        '-F',
        '#{session_name}|#{session_created}|#{pane_current_path}',
      ]);

      return [
        'zen_1|1710000000|/home/raspi5',
        'zen_work|1710000100|/srv/project',
        'other_ignored|1710000200|/tmp',
      ].join('\n');
    });

    expect(listSessions()).toEqual([
      {
        name: 'zen_1',
        displayName: '1',
        created: 1710000000000,
        cwd: '/home/raspi5',
      },
      {
        name: 'zen_work',
        displayName: 'work',
        created: 1710000100000,
        cwd: '/srv/project',
      },
    ]);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('listSessions: tmux サーバー未起動なら空配列を返す', async () => {
    const { listSessions } = await loadTmuxModule();

    installExecMock(() => {
      throw createTmuxCommandError('no server running on /tmp/tmux-1000/default');
    });

    expect(listSessions()).toEqual([]);
  });

  it('createSession: 名前指定で作成する', async () => {
    const { createSession } = await loadTmuxModule();

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          throw createTmuxCommandError("can't find session");
        case 'new-session':
        case 'set-option':
        case 'set-window-option':
          return '';
        case 'list-sessions':
          return 'zen_dev|1710000000|/home/testuser';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(createSession('dev')).toEqual({
      name: 'zen_dev',
      displayName: 'dev',
      created: 1710000000000,
      cwd: '/home/testuser',
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['new-session', '-d', '-s', 'zen_dev', '-c', '/home/testuser'],
      expect.any(Object)
    );
  });

  it('createSession: 名前省略時は自動採番する', async () => {
    const { createSession } = await loadTmuxModule();
    let listCalls = 0;

    installExecMock((args) => {
      switch (args[0]) {
        case 'list-sessions':
          listCalls += 1;
          return listCalls === 1
            ? ['zen_1|1710000000|/home/testuser', 'zen_2|1710000050|/home/testuser'].join('\n')
            : 'zen_3|1710000100|/home/testuser';
        case 'has-session':
          throw createTmuxCommandError("can't find session");
        case 'new-session':
        case 'set-option':
        case 'set-window-option':
          return '';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(createSession()).toEqual({
      name: 'zen_3',
      displayName: '3',
      created: 1710000100000,
      cwd: '/home/testuser',
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['new-session', '-d', '-s', 'zen_3', '-c', '/home/testuser'],
      expect.any(Object)
    );
  });

  it('createSession: 既存名なら 409 SESSION_EXISTS を返す', async () => {
    const { createSession, TmuxServiceError } = await loadTmuxModule();

    installExecMock((args) => {
      if (args[0] === 'has-session') {
        return '';
      }

      throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
    });

    try {
      createSession('existing');
      throw new Error('Expected createSession to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TmuxServiceError);
      expect((error as { statusCode?: number }).statusCode).toBe(409);
      expect((error as { code?: string }).code).toBe('SESSION_EXISTS');
    }
  });

  it('killSession: 正常に削除する', async () => {
    const { killSession } = await loadTmuxModule();

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
        case 'kill-session':
          return '';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(() => killSession('cleanup')).not.toThrow();
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['kill-session', '-t', '=zen_cleanup'],
      expect.any(Object)
    );
  });

  it('killSession: 存在しないセッションなら 404 SESSION_NOT_FOUND', async () => {
    const { killSession, TmuxServiceError } = await loadTmuxModule();

    installExecMock((args) => {
      if (args[0] === 'has-session') {
        throw createTmuxCommandError("can't find session");
      }

      throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
    });

    try {
      killSession('missing');
      throw new Error('Expected killSession to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TmuxServiceError);
      expect((error as { statusCode?: number }).statusCode).toBe(404);
      expect((error as { code?: string }).code).toBe('SESSION_NOT_FOUND');
    }
  });

  it('renameSession: 正常にリネームする', async () => {
    const { renameSession } = await loadTmuxModule();

    installExecMock((args) => {
      if (args[0] === 'has-session' && args[2] === '=zen_old') {
        return '';
      }

      if (args[0] === 'has-session' && args[2] === '=zen_new') {
        throw createTmuxCommandError("can't find session");
      }

      switch (args[0]) {
        case 'rename-session':
        case 'set-option':
        case 'set-window-option':
          return '';
        case 'list-sessions':
          return 'zen_new|1710000000|/home/testuser';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(renameSession('old', 'new')).toEqual({
      name: 'zen_new',
      displayName: 'new',
      created: 1710000000000,
      cwd: '/home/testuser',
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['rename-session', '-t', '=zen_old', 'zen_new'],
      expect.any(Object)
    );
  });

  it('renameSession: 同名リネームは何もしない', async () => {
    const { renameSession } = await loadTmuxModule();

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-sessions':
          return 'zen_same|1710000000|/home/testuser';
        case 'rename-session':
          throw new Error('rename-session should not be called');
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(renameSession('same', 'same')).toEqual({
      name: 'zen_same',
      displayName: 'same',
      created: 1710000000000,
      cwd: '/home/testuser',
    });
    expect(
      execFileSyncMock.mock.calls.some((call) => {
        const args = (call[1] as string[] | undefined) ?? [];
        return args[0] === 'rename-session';
      })
    ).toBe(false);
  });

  it('renameSession: 既存名へのリネームなら 409 を返す', async () => {
    const { renameSession, TmuxServiceError } = await loadTmuxModule();

    installExecMock((args) => {
      if (args[0] === 'has-session') {
        return '';
      }

      throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
    });

    try {
      renameSession('old', 'existing');
      throw new Error('Expected renameSession to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TmuxServiceError);
      expect((error as { statusCode?: number }).statusCode).toBe(409);
      expect((error as { code?: string }).code).toBe('SESSION_EXISTS');
    }
  });

  it('normalizeSessionName: 不正文字でバリデーションエラー', async () => {
    const { normalizeSessionName } = await loadTmuxModule();

    expect(() => normalizeSessionName('bad/name')).toThrowError(
      /セッション名は英数字、ハイフン、アンダースコア、ドットのみ使用できます/
    );
  });
});
