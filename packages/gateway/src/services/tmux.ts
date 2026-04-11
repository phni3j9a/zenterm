import { execFileSync } from 'node:child_process';
import { spawn, type IPty } from 'node-pty';
import { z } from 'zod';
import { config } from '../config.js';
import type { TmuxSession } from '../types/index.js';

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

const tmuxListFormat = '#{session_name}|#{session_created}|#{pane_current_path}';
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
    ['set-window-option', '-t', target, 'mode-keys', 'vi']
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

export function listSessions(): TmuxSession[] {
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
        return {
          name,
          displayName: name.replace(config.SESSION_PREFIX, ''),
          created: Number.parseInt(created, 10) * 1000,
          cwd: cwd || homeDir
        };
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

  runTmux(['new-session', '-d', '-s', getFullSessionName(displayName), '-c', homeDir]);
  applySessionOptions(displayName);

  return getSession(displayName) ?? buildFallbackSession(displayName);
}

export function attachSession(input: string): IPty {
  const displayName = normalizeSessionName(input);

  if (!sessionExists(displayName)) {
    throw new TmuxServiceError(`セッション "${displayName}" が見つかりません。`, 404, 'SESSION_NOT_FOUND');
  }

  applySessionOptions(displayName);

  try {
    return spawn('tmux', ['attach-session', '-t', getExactTmuxTarget(displayName)], {
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
  } catch (error) {
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
