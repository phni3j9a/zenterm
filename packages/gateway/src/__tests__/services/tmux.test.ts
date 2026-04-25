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
      switch (args[0]) {
        case 'list-sessions':
          return [
            'zen_1|1710000000|/home/user',
            'zen_work|1710000100|/srv/project',
            'other_ignored|1710000200|/tmp',
          ].join('\n');
        case 'has-session':
          return '';
        case 'list-windows':
          if (args[2] === '=zen_1') {
            return '0|term1|1|0|1|/home/user';
          }
          return '0|term1|1|0|2|/srv/project\n1|term2|0|0|1|/srv/project';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(listSessions()).toEqual([
      {
        name: 'zen_1',
        displayName: '1',
        created: 1710000000000,
        cwd: '/home/user',
        windows: [
          { index: 0, name: 'term1', active: true, zoomed: false, paneCount: 1, cwd: '/home/user' },
        ],
      },
      {
        name: 'zen_work',
        displayName: 'work',
        created: 1710000100000,
        cwd: '/srv/project',
        windows: [
          { index: 0, name: 'term1', active: true, zoomed: false, paneCount: 2, cwd: '/srv/project' },
          { index: 1, name: 'term2', active: false, zoomed: false, paneCount: 1, cwd: '/srv/project' },
        ],
      },
    ]);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('listSessions: includeWindows=false なら windows を含めない', async () => {
    const { listSessions } = await loadTmuxModule();

    installExecMock((args) => {
      if (args[0] === 'list-sessions') {
        return 'zen_a|1710000000|/home/testuser';
      }
      throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
    });

    expect(listSessions({ includeWindows: false })).toEqual([
      {
        name: 'zen_a',
        displayName: 'a',
        created: 1710000000000,
        cwd: '/home/testuser',
      },
    ]);
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
    let hasSessionCalls = 0;

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          hasSessionCalls += 1;
          if (hasSessionCalls === 1) {
            throw createTmuxCommandError("can't find session");
          }
          return '';
        case 'new-session':
        case 'set-option':
        case 'set-window-option':
          return '';
        case 'list-sessions':
          return 'zen_dev|1710000000|/home/testuser';
        case 'list-windows':
          return '0|term1|1|0|1|/home/testuser';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(createSession('dev')).toEqual({
      name: 'zen_dev',
      displayName: 'dev',
      created: 1710000000000,
      cwd: '/home/testuser',
      windows: [
        { index: 0, name: 'term1', active: true, zoomed: false, paneCount: 1, cwd: '/home/testuser' },
      ],
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['new-session', '-d', '-s', 'zen_dev', '-n', 'term1', '-c', '/home/testuser'],
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
      windows: [],
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['new-session', '-d', '-s', 'zen_3', '-n', 'term1', '-c', '/home/testuser'],
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
      windows: [],
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
      windows: [],
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

  it('listWindows: tmux 出力をパースする', async () => {
    const { listWindows } = await loadTmuxModule();

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          expect(args).toEqual([
            'list-windows',
            '-t', '=zen_dev',
            '-F', '#{window_index}|#{window_name}|#{?window_active,1,0}|#{?window_zoomed_flag,1,0}|#{window_panes}|#{pane_current_path}',
          ]);
          return [
            '0|term1|1|0|2|/home/user',
            '1|term2|0|1|1|/srv/work',
          ].join('\n');
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(listWindows('dev')).toEqual([
      { index: 0, name: 'term1', active: true, zoomed: false, paneCount: 2, cwd: '/home/user' },
      { index: 1, name: 'term2', active: false, zoomed: true, paneCount: 1, cwd: '/srv/work' },
    ]);
  });

  it('listWindows: セッションがなければ 404', async () => {
    const { listWindows, TmuxServiceError } = await loadTmuxModule();

    installExecMock((args) => {
      if (args[0] === 'has-session') {
        throw createTmuxCommandError("can't find session");
      }
      throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
    });

    try {
      listWindows('missing');
      throw new Error('Expected listWindows to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TmuxServiceError);
      expect((error as { statusCode?: number }).statusCode).toBe(404);
      expect((error as { code?: string }).code).toBe('SESSION_NOT_FOUND');
    }
  });

  it('createWindow: 名前指定で作成する', async () => {
    const { createWindow } = await loadTmuxModule();
    let listWindowsCalls = 0;

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          listWindowsCalls += 1;
          if (listWindowsCalls < 2) {
            return '0|term1|1|0|1|/home/testuser';
          }
          return '0|term1|0|0|1|/home/testuser\n1|api|1|0|1|/home/testuser';
        case 'new-window':
          return '';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(createWindow('dev', 'api')).toEqual({
      index: 1,
      name: 'api',
      active: true,
      zoomed: false,
      paneCount: 1,
      cwd: '/home/testuser',
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['new-window', '-d', '-t', '=zen_dev', '-n', 'api', '-c', '/home/testuser'],
      expect.any(Object)
    );
  });

  it('createWindow: 名前省略時は term<n> を採番する', async () => {
    const { createWindow } = await loadTmuxModule();
    let listWindowsCalls = 0;

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          listWindowsCalls += 1;
          if (listWindowsCalls < 3) {
            return ['0|term1|1|0|1|/home/testuser', '1|term2|0|0|1|/home/testuser'].join('\n');
          }
          return [
            '0|term1|0|0|1|/home/testuser',
            '1|term2|0|0|1|/home/testuser',
            '2|term3|1|0|1|/home/testuser',
          ].join('\n');
        case 'new-window':
          return '';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    const window = createWindow('dev');
    expect(window.name).toBe('term3');
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['new-window', '-d', '-t', '=zen_dev', '-n', 'term3', '-c', '/home/testuser'],
      expect.any(Object)
    );
  });

  it('createWindow: 既存名なら 409 WINDOW_EXISTS', async () => {
    const { createWindow, TmuxServiceError } = await loadTmuxModule();

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          return '0|term1|1|0|1|/home/testuser\n1|api|0|0|1|/home/testuser';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    try {
      createWindow('dev', 'api');
      throw new Error('Expected createWindow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TmuxServiceError);
      expect((error as { statusCode?: number }).statusCode).toBe(409);
      expect((error as { code?: string }).code).toBe('WINDOW_EXISTS');
    }
  });

  it('killWindow: 正常に削除する', async () => {
    const { killWindow } = await loadTmuxModule();

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          return '0|term1|1|0|1|/home/testuser\n1|term2|0|0|1|/home/testuser';
        case 'kill-window':
          return '';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(() => killWindow('dev', 1)).not.toThrow();
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['kill-window', '-t', '=zen_dev:1'],
      expect.any(Object)
    );
  });

  it('killWindow: 最後の 1 つは 422 LAST_WINDOW', async () => {
    const { killWindow, TmuxServiceError } = await loadTmuxModule();

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          return '0|term1|1|0|1|/home/testuser';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    try {
      killWindow('dev', 0);
      throw new Error('Expected killWindow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TmuxServiceError);
      expect((error as { statusCode?: number }).statusCode).toBe(422);
      expect((error as { code?: string }).code).toBe('LAST_WINDOW');
    }
  });

  it('killWindow: 存在しないなら 404 WINDOW_NOT_FOUND', async () => {
    const { killWindow, TmuxServiceError } = await loadTmuxModule();

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          return '0|term1|1|0|1|/home/testuser\n1|term2|0|0|1|/home/testuser';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    try {
      killWindow('dev', 99);
      throw new Error('Expected killWindow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TmuxServiceError);
      expect((error as { statusCode?: number }).statusCode).toBe(404);
      expect((error as { code?: string }).code).toBe('WINDOW_NOT_FOUND');
    }
  });

  it('renameWindow: 正常にリネームする', async () => {
    const { renameWindow } = await loadTmuxModule();
    let listWindowsCalls = 0;

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          listWindowsCalls += 1;
          if (listWindowsCalls < 3) {
            return '0|term1|1|0|1|/home/testuser\n1|term2|0|0|1|/home/testuser';
          }
          return '0|term1|1|0|1|/home/testuser\n1|api|0|0|1|/home/testuser';
        case 'rename-window':
          return '';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(renameWindow('dev', 1, 'api')).toEqual({
      index: 1,
      name: 'api',
      active: false,
      zoomed: false,
      paneCount: 1,
      cwd: '/home/testuser',
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['rename-window', '-t', '=zen_dev:1', 'api'],
      expect.any(Object)
    );
  });

  it('toggleWindowZoom: resize-pane -Z を発行する', async () => {
    const { toggleWindowZoom } = await loadTmuxModule();
    let listWindowsCalls = 0;

    installExecMock((args) => {
      switch (args[0]) {
        case 'has-session':
          return '';
        case 'list-windows':
          listWindowsCalls += 1;
          return listWindowsCalls === 1
            ? '0|term1|1|0|2|/home/testuser'
            : '0|term1|1|1|2|/home/testuser';
        case 'resize-pane':
          return '';
        default:
          throw new Error(`Unexpected tmux args: ${args.join(' ')}`);
      }
    });

    expect(toggleWindowZoom('dev', 0)).toEqual({
      index: 0,
      name: 'term1',
      active: true,
      zoomed: true,
      paneCount: 2,
      cwd: '/home/testuser',
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'tmux',
      ['resize-pane', '-Z', '-t', '=zen_dev:0'],
      expect.any(Object)
    );
  });

  it('normalizeWindowName: 不正文字でバリデーションエラー', async () => {
    const { normalizeWindowName } = await loadTmuxModule();

    expect(() => normalizeWindowName('bad name')).toThrowError(
      /ウィンドウ名は英数字、ハイフン、アンダースコア、ドットのみ使用できます/
    );
  });
});
