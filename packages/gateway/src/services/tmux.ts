import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { spawn, type IPty } from 'node-pty';
import { z } from 'zod';
import { config } from '../config.js';
import type { TmuxSession, TmuxWindow } from '../types/index.js';

const VIEW_SESSION_PREFIX = '_zen_view_';

interface ExecFileSyncError extends NodeJS.ErrnoException {
  stderr?: Buffer | string;
  stdout?: Buffer | string;
  status?: number | null;
}

const nameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z0-9_.-]{1,50}$/u,
    'セッション名は英数字、ハイフン、アンダースコア、ドットのみ使用できます（1-50文字）'
  );

const windowNameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z0-9_.-]{1,50}$/u,
    'ウィンドウ名は英数字、ハイフン、アンダースコア、ドットのみ使用できます（1-50文字）'
  );

const tmuxListFormat = '#{session_name}|#{session_created}|#{pane_current_path}';
const tmuxWindowListFormat =
  '#{window_index}|#{window_name}|#{?window_active,1,0}|#{?window_zoomed_flag,1,0}|#{window_panes}|#{pane_current_path}';
const homeDir = process.env.HOME ?? process.cwd();
const emptyServerMarkers = [
  'no server running',
  'failed to connect to server',
  'error connecting to',
  'no sessions'
];
const missingSessionMarkers = ["can't find session", 'session not found'];

export class TmuxServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly code = 'TMUX_ERROR',
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'TmuxServiceError';
  }
}

function getErrorText(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unknown error';
}

function bufferToString(value: Buffer | string | undefined): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value instanceof Buffer) {
    return value.toString('utf8').trim();
  }

  return '';
}

function isTmuxMissing(error: unknown): boolean {
  return (error as ExecFileSyncError | undefined)?.code === 'ENOENT';
}

function isTmuxNoServerError(error: unknown): boolean {
  const text = extractTmuxErrorMessage(error).toLowerCase();
  return emptyServerMarkers.some((marker) => text.includes(marker));
}

function isTmuxMissingSessionError(error: unknown): boolean {
  const text = extractTmuxErrorMessage(error).toLowerCase();
  return missingSessionMarkers.some((marker) => text.includes(marker));
}

function extractTmuxErrorMessage(error: unknown): string {
  const execError = error as ExecFileSyncError | undefined;
  const stderr = bufferToString(execError?.stderr);
  const stdout = bufferToString(execError?.stdout);

  return stderr || stdout || getErrorText(error);
}

function runTmux(args: string[]): string {
  try {
    return execFileSync('tmux', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error) {
    if (isTmuxMissing(error)) {
      throw new TmuxServiceError('tmux が見つかりません。PATH を確認してください。', 500, 'TMUX_NOT_FOUND', {
        cause: error
      });
    }

    throw new TmuxServiceError(extractTmuxErrorMessage(error), 500, 'TMUX_COMMAND_FAILED', {
      cause: error
    });
  }
}

export function normalizeSessionName(input: string): string {
  const trimmed = input.trim();
  const rawName = trimmed.startsWith(config.SESSION_PREFIX)
    ? trimmed.slice(config.SESSION_PREFIX.length)
    : trimmed;

  return nameSchema.parse(rawName);
}

export function normalizeWindowName(input: string): string {
  return windowNameSchema.parse(input);
}

function getWindowTarget(sessionInput: string, windowIndex: number): string {
  return `${getExactTmuxTarget(sessionInput)}:${windowIndex}`;
}

function getFullSessionName(input: string): string {
  return `${config.SESSION_PREFIX}${normalizeSessionName(input)}`;
}

function getExactTmuxTarget(input: string): string {
  return `=${getFullSessionName(input)}`;
}

function applySessionOptions(input: string): void {
  const target = getExactTmuxTarget(input);
  const commands: string[][] = [
    ['set-option', '-t', target, 'mouse', 'on'],
    ['set-option', '-t', target, 'history-limit', '10000'],
    ['set-option', '-t', target, 'escape-time', '10'],
    ['set-option', '-t', target, 'renumber-windows', 'on'],
    ['set-window-option', '-t', target, 'mode-keys', 'vi'],
    ['set-window-option', '-t', target, 'automatic-rename', 'off']
  ];

  for (const command of commands) {
    try {
      runTmux(command);
    } catch {
      // 既存セッションの環境差分で失敗しても attach 自体は継続する。
    }
  }
}

function buildFallbackSession(displayName: string): TmuxSession {
  return {
    name: getFullSessionName(displayName),
    displayName: normalizeSessionName(displayName),
    created: Date.now(),
    cwd: homeDir
  };
}

function generateSessionName(): string {
  const usedNumbers = new Set(
    listSessions()
      .map((session) => session.displayName)
      .filter((displayName) => /^\d+$/u.test(displayName))
      .map((displayName) => Number.parseInt(displayName, 10))
  );

  let current = 1;
  while (usedNumbers.has(current)) {
    current += 1;
  }

  return String(current);
}

export function listSessions(options: { includeWindows?: boolean } = {}): TmuxSession[] {
  const { includeWindows = true } = options;
  try {
    const output = runTmux(['list-sessions', '-F', tmuxListFormat]).trim();

    if (!output) {
      return [];
    }

    return output
      .split('\n')
      .filter((line) => line.startsWith(config.SESSION_PREFIX))
      .map((line) => {
        const [name, created, cwd] = line.split('|');
        const displayName = name.replace(config.SESSION_PREFIX, '');
        const session: TmuxSession = {
          name,
          displayName,
          created: Number.parseInt(created, 10) * 1000,
          cwd: cwd || homeDir
        };
        if (includeWindows) {
          try {
            session.windows = listWindows(displayName);
          } catch {
            session.windows = [];
          }
        }
        return session;
      });
  } catch (error) {
    if (error instanceof TmuxServiceError && isTmuxNoServerError(error)) {
      return [];
    }

    throw error;
  }
}

export function getSession(input: string): TmuxSession | null {
  const fullName = getFullSessionName(input);
  return listSessions().find((session) => session.name === fullName) ?? null;
}

function generateWindowName(sessionInput: string): string {
  const usedNumbers = new Set(
    listWindows(sessionInput)
      .map((window) => window.name)
      .filter((name) => /^term\d+$/u.test(name))
      .map((name) => Number.parseInt(name.slice(4), 10))
  );

  let current = 1;
  while (usedNumbers.has(current)) {
    current += 1;
  }

  return `term${current}`;
}

export function sessionExists(input: string): boolean {
  try {
    runTmux(['has-session', '-t', getExactTmuxTarget(input)]);
    return true;
  } catch (error) {
    if (error instanceof TmuxServiceError) {
      if (isTmuxNoServerError(error) || isTmuxMissingSessionError(error)) {
        return false;
      }
    }

    throw error;
  }
}

export function createSession(input?: string): TmuxSession {
  const displayName = input ? normalizeSessionName(input) : generateSessionName();

  if (sessionExists(displayName)) {
    throw new TmuxServiceError(`セッション "${displayName}" は既に存在します。`, 409, 'SESSION_EXISTS');
  }

  runTmux([
    'new-session',
    '-d',
    '-s', getFullSessionName(displayName),
    '-n', 'term1',
    '-c', homeDir
  ]);
  applySessionOptions(displayName);

  return getSession(displayName) ?? buildFallbackSession(displayName);
}

function generateViewSessionName(): string {
  return `${VIEW_SESSION_PREFIX}${randomBytes(6).toString('hex')}`;
}

/**
 * クライアントがアタッチしている間だけ存在する一時的な「ビュー」セッションを
 * 削除する。ビューは元 session とグループ化されているため、削除しても元 session
 * の windows/panes は失われない。
 */
export function killViewSession(viewSessionName: string): void {
  if (!viewSessionName.startsWith(VIEW_SESSION_PREFIX)) {
    return;
  }

  try {
    runTmux(['kill-session', '-t', `=${viewSessionName}`]);
  } catch {
    // 既に消えている、tmux server が止まっている等は無視。
  }
}

/** 起動時に取り残された view session を一掃する。 */
export function cleanupOrphanViewSessions(): void {
  let output: string;
  try {
    output = runTmux(['list-sessions', '-F', '#{session_name}']).trim();
  } catch (error) {
    if (error instanceof TmuxServiceError && isTmuxNoServerError(error)) {
      return;
    }
    return;
  }

  for (const line of output.split('\n')) {
    if (line.startsWith(VIEW_SESSION_PREFIX)) {
      killViewSession(line);
    }
  }
}

export interface AttachResult {
  pty: IPty;
  /** 一時的な view session の名前。WebSocket 切断時に kill する責務は呼び出し側にある。 */
  viewSessionName: string | null;
}

export function attachSession(input: string, windowIndex?: number): AttachResult {
  const displayName = normalizeSessionName(input);

  if (!sessionExists(displayName)) {
    throw new TmuxServiceError(`セッション "${displayName}" が見つかりません。`, 404, 'SESSION_NOT_FOUND');
  }

  applySessionOptions(displayName);

  if (typeof windowIndex === 'number' && !windowExists(displayName, windowIndex)) {
    throw new TmuxServiceError(
      `ウィンドウ "${displayName}:${windowIndex}" が見つかりません。`,
      404,
      'WINDOW_NOT_FOUND'
    );
  }

  let target: string;
  let viewSessionName: string | null = null;

  if (typeof windowIndex === 'number') {
    // window 指定がある場合は専用 view session を作る。
    // - 元 session とグループ化することで windows/panes 構造を共有
    // - select-window はこの view 内でのみ有効なので他クライアントに影響しない
    viewSessionName = generateViewSessionName();
    try {
      runTmux([
        'new-session',
        '-d',
        '-t', getExactTmuxTarget(displayName),
        '-s', viewSessionName,
        '-x', '80',
        '-y', '24'
      ]);
      runTmux([
        'select-window',
        '-t', `=${viewSessionName}:${windowIndex}`
      ]);
    } catch (error) {
      // view session が作れなかったら掃除して握り潰す。
      killViewSession(viewSessionName);
      throw new TmuxServiceError(
        `ビューセッションの作成に失敗しました: ${getErrorText(error)}`,
        500,
        'VIEW_SESSION_FAILED',
        { cause: error }
      );
    }
    target = `=${viewSessionName}`;
  } else {
    target = getExactTmuxTarget(displayName);
  }

  try {
    const pty = spawn('tmux', ['attach-session', '-t', target], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: homeDir,
      env: {
        ...process.env,
        LANG: 'ja_JP.UTF-8',
        LC_ALL: 'ja_JP.UTF-8',
        TERM: 'xterm-256color'
      }
    });
    return { pty, viewSessionName };
  } catch (error) {
    if (viewSessionName) {
      killViewSession(viewSessionName);
    }
    if (isTmuxMissing(error)) {
      throw new TmuxServiceError('tmux が見つかりません。PATH を確認してください。', 500, 'TMUX_NOT_FOUND', {
        cause: error
      });
    }

    throw new TmuxServiceError(
      `tmux セッション "${displayName}" へのアタッチに失敗しました: ${getErrorText(error)}`,
      500,
      'PTY_ATTACH_FAILED',
      { cause: error }
    );
  }
}

export function killSession(input: string): void {
  const displayName = normalizeSessionName(input);

  if (!sessionExists(displayName)) {
    throw new TmuxServiceError(`セッション "${displayName}" が見つかりません。`, 404, 'SESSION_NOT_FOUND');
  }

  runTmux(['kill-session', '-t', getExactTmuxTarget(displayName)]);
}

export function renameSession(currentName: string, nextName: string): TmuxSession {
  const normalizedCurrent = normalizeSessionName(currentName);
  const normalizedNext = normalizeSessionName(nextName);

  if (!sessionExists(normalizedCurrent)) {
    throw new TmuxServiceError(`セッション "${normalizedCurrent}" が見つかりません。`, 404, 'SESSION_NOT_FOUND');
  }

  if (normalizedCurrent === normalizedNext) {
    return getSession(normalizedCurrent) ?? buildFallbackSession(normalizedCurrent);
  }

  if (sessionExists(normalizedNext)) {
    throw new TmuxServiceError(`セッション "${normalizedNext}" は既に存在します。`, 409, 'SESSION_EXISTS');
  }

  runTmux([
    'rename-session',
    '-t',
    getExactTmuxTarget(normalizedCurrent),
    getFullSessionName(normalizedNext)
  ]);
  applySessionOptions(normalizedNext);

  return getSession(normalizedNext) ?? buildFallbackSession(normalizedNext);
}

export function captureScrollback(input: string, lines = 1000): string {
  const displayName = normalizeSessionName(input);

  if (!sessionExists(displayName)) {
    throw new TmuxServiceError(`セッション "${displayName}" が見つかりません。`, 404, 'SESSION_NOT_FOUND');
  }

  return runTmux([
    'capture-pane',
    '-t', getExactTmuxTarget(displayName),
    '-p',
    '-S', `-${lines}`,
  ]);
}

// ─── Window 操作 ───

function parseWindowLine(line: string): TmuxWindow | null {
  const parts = line.split('|');
  if (parts.length < 6) {
    return null;
  }
  const [indexRaw, name, activeRaw, zoomedRaw, panesRaw, cwd] = parts;
  const index = Number.parseInt(indexRaw, 10);
  const paneCount = Number.parseInt(panesRaw, 10);
  if (Number.isNaN(index) || Number.isNaN(paneCount)) {
    return null;
  }
  return {
    index,
    name,
    active: activeRaw === '1',
    zoomed: zoomedRaw === '1',
    paneCount,
    cwd: cwd || homeDir
  };
}

export function listWindows(sessionInput: string): TmuxWindow[] {
  const displayName = normalizeSessionName(sessionInput);
  if (!sessionExists(displayName)) {
    throw new TmuxServiceError(`セッション "${displayName}" が見つかりません。`, 404, 'SESSION_NOT_FOUND');
  }

  const output = runTmux([
    'list-windows',
    '-t', getExactTmuxTarget(displayName),
    '-F', tmuxWindowListFormat
  ]).trim();

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map(parseWindowLine)
    .filter((window): window is TmuxWindow => window !== null);
}

export function windowExists(sessionInput: string, windowIndex: number): boolean {
  return listWindows(sessionInput).some((window) => window.index === windowIndex);
}

export function findWindow(sessionInput: string, windowIndex: number): TmuxWindow | null {
  return listWindows(sessionInput).find((window) => window.index === windowIndex) ?? null;
}

function findWindowByName(sessionInput: string, windowName: string): TmuxWindow | null {
  return listWindows(sessionInput).find((window) => window.name === windowName) ?? null;
}

function buildFallbackWindow(index: number, name: string): TmuxWindow {
  return {
    index,
    name,
    active: false,
    zoomed: false,
    paneCount: 1,
    cwd: homeDir
  };
}

export function createWindow(sessionInput: string, input?: string): TmuxWindow {
  const displayName = normalizeSessionName(sessionInput);
  if (!sessionExists(displayName)) {
    throw new TmuxServiceError(`セッション "${displayName}" が見つかりません。`, 404, 'SESSION_NOT_FOUND');
  }

  const windowName = input ? normalizeWindowName(input) : generateWindowName(displayName);

  if (findWindowByName(displayName, windowName)) {
    throw new TmuxServiceError(
      `ウィンドウ "${windowName}" は既に存在します。`,
      409,
      'WINDOW_EXISTS'
    );
  }

  runTmux([
    'new-window',
    '-d',
    '-t', getExactTmuxTarget(displayName),
    '-n', windowName,
    '-c', homeDir
  ]);

  return findWindowByName(displayName, windowName) ?? buildFallbackWindow(-1, windowName);
}

export function killWindow(sessionInput: string, windowIndex: number): void {
  const displayName = normalizeSessionName(sessionInput);
  const windows = listWindows(displayName);

  if (!windows.some((window) => window.index === windowIndex)) {
    throw new TmuxServiceError(
      `ウィンドウ "${displayName}:${windowIndex}" が見つかりません。`,
      404,
      'WINDOW_NOT_FOUND'
    );
  }

  if (windows.length <= 1) {
    throw new TmuxServiceError(
      `セッション "${displayName}" の最後のウィンドウは削除できません。`,
      422,
      'LAST_WINDOW'
    );
  }

  runTmux(['kill-window', '-t', getWindowTarget(displayName, windowIndex)]);
}

export function renameWindow(
  sessionInput: string,
  windowIndex: number,
  newName: string
): TmuxWindow {
  const displayName = normalizeSessionName(sessionInput);
  const normalizedName = normalizeWindowName(newName);

  const current = findWindow(displayName, windowIndex);
  if (!current) {
    throw new TmuxServiceError(
      `ウィンドウ "${displayName}:${windowIndex}" が見つかりません。`,
      404,
      'WINDOW_NOT_FOUND'
    );
  }

  if (current.name === normalizedName) {
    return current;
  }

  const conflict = findWindowByName(displayName, normalizedName);
  if (conflict) {
    throw new TmuxServiceError(
      `ウィンドウ "${normalizedName}" は既に存在します。`,
      409,
      'WINDOW_EXISTS'
    );
  }

  runTmux([
    'rename-window',
    '-t', getWindowTarget(displayName, windowIndex),
    normalizedName
  ]);

  return findWindow(displayName, windowIndex) ?? buildFallbackWindow(windowIndex, normalizedName);
}

export function toggleWindowZoom(sessionInput: string, windowIndex: number): TmuxWindow {
  const displayName = normalizeSessionName(sessionInput);
  const current = findWindow(displayName, windowIndex);
  if (!current) {
    throw new TmuxServiceError(
      `ウィンドウ "${displayName}:${windowIndex}" が見つかりません。`,
      404,
      'WINDOW_NOT_FOUND'
    );
  }

  runTmux([
    'resize-pane',
    '-Z',
    '-t', getWindowTarget(displayName, windowIndex)
  ]);

  return findWindow(displayName, windowIndex) ?? buildFallbackWindow(windowIndex, current.name);
}

export function captureWindowScrollback(
  sessionInput: string,
  windowIndex: number,
  lines = 1000
): string {
  const displayName = normalizeSessionName(sessionInput);
  if (!windowExists(displayName, windowIndex)) {
    throw new TmuxServiceError(
      `ウィンドウ "${displayName}:${windowIndex}" が見つかりません。`,
      404,
      'WINDOW_NOT_FOUND'
    );
  }

  return runTmux([
    'capture-pane',
    '-t', getWindowTarget(displayName, windowIndex),
    '-p',
    '-S', `-${lines}`,
  ]);
}
