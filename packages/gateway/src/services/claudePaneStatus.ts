import { execFileSync } from 'node:child_process';
import type {
  AgentActivity,
  AgentKind,
  AgentWindowStatus,
  ClaudeWindowStatus,
} from '@zenterm/shared';

// 点字ブロック（スピナーのコマ）。先頭がこの範囲 → 作業中。
const BRAILLE_MIN = 0x2800;
const BRAILLE_MAX = 0x28ff;
// 入力待ちを示す静止グリフ。将来の仕様変更時はここに追記する。
const WAITING_GLYPHS = new Set(['✳']); // U+2733 EIGHT SPOKED ASTERISK
// claude 在席とみなすフォアグラウンドコマンド。
// 'node' は既知グリフを持つ場合のみ在席扱い（無関係な node アプリの誤検出回避）。
const CLAUDE_COMMANDS = new Set(['claude', 'node']);
const PROCESS_CACHE_MS = 500;

interface ProcessInfo {
  pid: number;
  ppid: number;
  command: string;
  args: string;
}

interface ProcessSnapshot {
  capturedAt: number;
  childrenByParent: Map<number, ProcessInfo[]>;
}

export interface DeriveAgentStatusOptions {
  panePid?: number;
  resolveAgentForPane?: (panePid: number) => AgentKind | undefined;
}

let cachedSnapshot: ProcessSnapshot | null = null;

function classifyGlyph(glyph: string): { known: boolean; working: boolean } {
  const code = glyph.codePointAt(0) ?? -1;
  const braille = code >= BRAILLE_MIN && code <= BRAILLE_MAX;
  const waiting = WAITING_GLYPHS.has(glyph);
  return { known: braille || waiting, working: braille };
}

function basename(command: string): string {
  return command.split('/').filter(Boolean).pop() ?? command;
}

function agentFromProcess(command: string, args: string): AgentKind | undefined {
  const base = basename(command);
  if (base === 'codex') return 'codex';
  if (base === 'claude') return 'claude';

  const text = `${command} ${args}`;
  if (/(^|[/\s])codex(?:\s|$)/u.test(text) || text.includes('@openai/codex')) {
    return 'codex';
  }
  if (
    /(^|[/\s])claude(?:\s|$)/u.test(text) ||
    text.includes('@anthropic-ai/claude') ||
    text.includes('/.local/share/claude/')
  ) {
    return 'claude';
  }
  return undefined;
}

function parseProcessLine(line: string): ProcessInfo | null {
  const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/u);
  if (!match) return null;
  const pid = Number.parseInt(match[1], 10);
  const ppid = Number.parseInt(match[2], 10);
  if (!Number.isFinite(pid) || !Number.isFinite(ppid)) return null;
  return {
    pid,
    ppid,
    command: match[3],
    args: match[4] ?? '',
  };
}

function readProcessSnapshot(now = Date.now()): ProcessSnapshot {
  if (cachedSnapshot && now - cachedSnapshot.capturedAt < PROCESS_CACHE_MS) {
    return cachedSnapshot;
  }

  const childrenByParent = new Map<number, ProcessInfo[]>();
  try {
    const output = execFileSync('ps', ['-eo', 'pid=,ppid=,comm=,args='], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    for (const line of output.split('\n')) {
      const proc = parseProcessLine(line);
      if (!proc) continue;
      const children = childrenByParent.get(proc.ppid) ?? [];
      children.push(proc);
      childrenByParent.set(proc.ppid, children);
    }
  } catch {
    // ps が使えない環境ではプロセス系譜判定を諦め、command/title 判定へフォールバックする。
  }

  cachedSnapshot = { capturedAt: now, childrenByParent };
  return cachedSnapshot;
}

export function resolveAgentForPanePid(panePid: number): AgentKind | undefined {
  if (!Number.isFinite(panePid) || panePid <= 0) return undefined;

  const { childrenByParent } = readProcessSnapshot();
  const queue = [...(childrenByParent.get(panePid) ?? [])];
  const seen = new Set<number>();

  while (queue.length > 0) {
    const proc = queue.shift()!;
    if (seen.has(proc.pid)) continue;
    seen.add(proc.pid);

    const agent = agentFromProcess(proc.command, proc.args);
    if (agent) return agent;

    queue.push(...(childrenByParent.get(proc.pid) ?? []));
  }

  return undefined;
}

export function deriveAgentStatus(
  command: string,
  title: string,
  options: DeriveAgentStatusOptions = {},
): AgentWindowStatus | undefined {
  const trimmed = title.replace(/^\s+/, '');
  const glyph = [...trimmed][0] ?? '';
  const { known, working } = classifyGlyph(glyph);

  let agent: AgentKind | undefined;
  if (command === 'claude') {
    agent = 'claude';
  } else if (command === 'codex') {
    agent = 'codex';
  } else if (command === 'node') {
    const resolver = options.resolveAgentForPane ?? resolveAgentForPanePid;
    const processAgent =
      typeof options.panePid === 'number' ? resolver(options.panePid) : undefined;
    agent = processAgent ?? (known ? 'claude' : undefined);
  }

  if (!agent) {
    return undefined;
  }

  const activity: AgentActivity = working ? 'working' : 'waiting';
  const summary = (known ? trimmed.slice(glyph.length) : trimmed).trim();
  return summary ? { agent, activity, summary } : { agent, activity };
}

/**
 * tmux の pane_current_command / pane_title から Claude の活動状態を判定する。
 * 在席でなければ undefined（= Claude無）。
 * @param command tmux の pane_current_command（basename）
 */
export function deriveClaudeStatus(
  command: string,
  title: string,
): ClaudeWindowStatus | undefined {
  if (!CLAUDE_COMMANDS.has(command)) {
    return undefined; // claude / node 以外は対象外
  }

  const status = deriveAgentStatus(command, title, {
    resolveAgentForPane: () => undefined,
  });
  if (!status || status.agent !== 'claude') {
    return undefined;
  }
  const { activity, summary } = status;
  return summary ? { activity, summary } : { activity };
}
