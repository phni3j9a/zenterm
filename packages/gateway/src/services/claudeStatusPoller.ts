import { execFileSync } from 'node:child_process';
import type { TmuxEvent } from '@zenterm/shared';
import { config } from '../config.js';
import { tmuxControlService } from './tmuxControl.js';
import { tmuxWindowListFormat, parseWindowLine } from './tmux.js';

const POLL_INTERVAL_MS =
  Number.parseInt(process.env.CLAUDE_STATUS_POLL_MS ?? '', 10) || 2000;

/**
 * `tmux list-windows -a`（session_name 前置）の出力から派生状態の signature を作る。
 * prefix 一致セッションのみ対象。tick ごとの比較に使う純関数。
 */
export function computeStatusSignature(output: string, sessionPrefix: string): string {
  const trimmed = output.trim();
  if (!trimmed) return '';
  return trimmed
    .split('\n')
    .map((line) => {
      const sep = line.indexOf('|');
      if (sep === -1) return null;
      const sessionName = line.slice(0, sep);
      if (!sessionName.startsWith(sessionPrefix)) return null;
      const win = parseWindowLine(line.slice(sep + 1));
      if (!win) return null;
      const activity = win.claudeStatus?.activity ?? 'none';
      return `${sessionName}/${win.index}:${activity}`;
    })
    .filter((v): v is string => v !== null)
    .sort()
    .join(',');
}

interface PollerDeps {
  runTmux: () => string;
  publish: (event: TmuxEvent) => void;
  intervalMs: number;
}

function defaultRunTmux(): string {
  return execFileSync(
    'tmux',
    ['list-windows', '-a', '-F', `#{session_name}|${tmuxWindowListFormat}`],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).toString();
}

export class ClaudeStatusPoller {
  private refCount = 0;
  private timer: NodeJS.Timeout | null = null;
  private lastSignature = '';

  constructor(private readonly deps: PollerDeps) {}

  /** WS クライアント接続時に呼ぶ。最初の 1 人でインターバル開始 + 即時 tick。 */
  acquire(): void {
    this.refCount += 1;
    if (this.refCount === 1 && this.timer === null) {
      this.timer = setInterval(() => this.tick(), this.deps.intervalMs);
      this.tick();
    }
  }

  /** WS クライアント切断時に呼ぶ。最後の 1 人でインターバル停止。 */
  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0 && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.lastSignature = '';
    }
  }

  /** tmux を読み、signature が前回と変わっていれば 1 回だけ broadcast する。 */
  tick(): void {
    let signature = '';
    try {
      signature = computeStatusSignature(this.deps.runTmux(), config.SESSION_PREFIX);
    } catch {
      signature = ''; // tmux 不在等は全 none 扱い
    }
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.deps.publish({ type: 'claude-status-changed' });
    }
  }
}

export const claudeStatusPoller = new ClaudeStatusPoller({
  runTmux: defaultRunTmux,
  publish: (event) => tmuxControlService.publish(event),
  intervalMs: POLL_INTERVAL_MS,
});
