import { execFileSync } from 'node:child_process';
import { spawn, type IPty } from 'node-pty';
import type { TmuxEvent } from '@zenterm/shared';

const MONITOR_SESSION = '_zen_monitor';
const RECONNECT_DELAY_MS = 2000;

export type { TmuxEvent };

type Listener = (event: TmuxEvent) => void;

interface ExecError extends NodeJS.ErrnoException {
  stderr?: Buffer | string;
  stdout?: Buffer | string;
}

function bufferToString(value: Buffer | string | undefined): string {
  if (typeof value === 'string') return value.trim();
  if (value instanceof Buffer) return value.toString('utf8').trim();
  return '';
}

function isMissingSession(error: unknown): boolean {
  const text = bufferToString((error as ExecError | undefined)?.stderr).toLowerCase();
  return text.includes("can't find session") || text.includes('session not found');
}

function isNoServer(error: unknown): boolean {
  const text = bufferToString((error as ExecError | undefined)?.stderr).toLowerCase();
  return (
    text.includes('no server running') ||
    text.includes('failed to connect to server') ||
    text.includes('error connecting to')
  );
}

function ensureMonitorSession(): void {
  try {
    execFileSync('tmux', ['has-session', '-t', `=${MONITOR_SESSION}`], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return;
  } catch (error) {
    if (!isMissingSession(error) && !isNoServer(error)) {
      // 想定外の has-session 失敗は new-session で覆い隠さず外へ伝える。
      throw error;
    }
  }

  execFileSync('tmux', ['new-session', '-d', '-s', MONITOR_SESSION, 'sh', '-c', 'sleep infinity'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

/**
 * tmux 制御モード (`tmux -C`) の出力 1 行を ZenTerm 内部イベントに変換する。
 *
 * 戻り値が `null` のときは「無視してよい行」（プロンプト、コマンドレスポンス、
 * 関心外イベントなど）を意味する。
 */
export function parseControlLine(line: string): TmuxEvent | null {
  const trimmed = line.trimEnd();
  if (!trimmed.startsWith('%')) {
    return null;
  }

  const space = trimmed.indexOf(' ');
  const name = space === -1 ? trimmed.slice(1) : trimmed.slice(1, space);

  switch (name) {
    case 'sessions-changed':
    case 'session-renamed':
      return { type: 'sessions-changed' };

    case 'window-add':
    case 'window-close':
    case 'window-renamed':
    case 'unlinked-window-add':
    case 'unlinked-window-close':
    case 'unlinked-window-renamed':
    case 'layout-change':
    case 'session-window-changed':
      return { type: 'windows-changed' };

    default:
      return null;
  }
}

class TmuxControlService {
  private childProcess: IPty | null = null;
  private listeners = new Set<Listener>();
  private buffer = '';
  private restartTimer: NodeJS.Timeout | null = null;
  private stopping = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.childProcess === null && !this.restartTimer) {
      this.start();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  /** テスト用: 現在のリスナー数を確認する */
  get listenerCount(): number {
    return this.listeners.size;
  }

  /** テスト用: ストリームの行処理を直接呼び出す */
  ingest(chunk: string): void {
    this.handleData(chunk);
  }

  private start(): void {
    if (this.childProcess) {
      return;
    }

    try {
      ensureMonitorSession();
    } catch (error) {
      // 監視セッションを作れないなら諦めて再試行する。
      this.scheduleRestart(error);
      return;
    }

    this.stopping = false;
    try {
      this.childProcess = spawn(
        'tmux',
        ['-C', 'attach-session', '-t', `=${MONITOR_SESSION}`],
        {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          env: {
            ...process.env,
            TERM: 'xterm-256color'
          }
        }
      );
    } catch (error) {
      this.scheduleRestart(error);
      return;
    }

    this.buffer = '';
    this.childProcess.onData((data) => this.handleData(data));
    this.childProcess.onExit(() => this.handleExit());
  }

  private stop(): void {
    this.stopping = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (!this.childProcess) {
      return;
    }
    try {
      this.childProcess.kill();
    } catch {
      // 既に死んでいるなら無視。
    }
    this.childProcess = null;
    this.buffer = '';
  }

  private handleData(data: string): void {
    this.buffer += data;
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      const event = parseControlLine(line);
      if (event) {
        this.emit(event);
      }
      newlineIndex = this.buffer.indexOf('\n');
    }
  }

  private emit(event: TmuxEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // リスナー側の例外でストリームを止めない。
      }
    }
  }

  private handleExit(): void {
    this.childProcess = null;
    if (this.stopping || this.listeners.size === 0) {
      return;
    }
    this.scheduleRestart(new Error('tmux control mode exited'));
  }

  private scheduleRestart(reason: unknown): void {
    if (this.restartTimer) {
      return;
    }
    this.emit({ type: 'monitor-restart' });
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.listeners.size > 0) {
        this.start();
      }
    }, RECONNECT_DELAY_MS);
    // reason はログ出力に使いたいが、サービス層に logger を持ち込まないため呼び出し側で観測可能にする。
    void reason;
  }
}

export const tmuxControlService = new TmuxControlService();
