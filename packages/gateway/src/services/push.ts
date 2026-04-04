// Expo Push Notification Service
// Node.js fetch のみ使用、外部依存なし

import type { AgentEvent, AgentEventType, AgentType } from '@zenterm/shared';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FETCH_TIMEOUT_MS = 10_000;
const DEDUP_WINDOW_MS = 5_000;
const CLEANUP_INTERVAL_MS = 60_000;

export interface PushResult {
  sent: number;
  failed: number;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: unknown;
}

// ── 重複抑制 ─────────────────────────────────────────

const lastSentMap = new Map<string, number>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of lastSentMap) {
      if (now - ts > DEDUP_WINDOW_MS) {
        lastSentMap.delete(key);
      }
    }
    if (lastSentMap.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  // Node.js プロセスの終了をブロックしない
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

function isDuplicate(agent: string, type: string): boolean {
  const key = `${agent}:${type}`;
  const last = lastSentMap.get(key);
  if (last !== undefined && Date.now() - last < DEDUP_WINDOW_MS) {
    return true;
  }
  return false;
}

function recordSent(agent: string, type: string): void {
  const key = `${agent}:${type}`;
  lastSentMap.set(key, Date.now());
  ensureCleanupTimer();
}

// ── 通知内容生成 ──────────────────────────────────────

const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'copilot-cli': 'Copilot CLI',
  'unknown': 'Agent',
};

const EVENT_MESSAGES: Record<AgentEventType, string> = {
  'task.completed': '✅ タスクが完了しました',
  'task.failed': '❌ タスクが失敗しました',
  'input.requested': '⏳ 入力を待っています',
  'session.ended': 'セッションが終了しました',
};

function buildTitle(agent: AgentType): string {
  return AGENT_DISPLAY_NAMES[agent];
}

function buildBody(event: AgentEvent): string {
  const base = EVENT_MESSAGES[event.type];
  if (event.summary && event.type !== 'session.ended') {
    return `${base}: ${event.summary}`;
  }
  return base;
}

function buildMessages(tokens: string[], event: AgentEvent): ExpoPushMessage[] {
  const title = buildTitle(event.agent);
  const body = buildBody(event);
  const data: Record<string, unknown> = {
    type: event.type,
    agent: event.agent,
    sessionId: event.sessionId,
  };

  return tokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default' as const,
    priority: 'high' as const,
  }));
}

// ── Expo Push API 送信 ───────────────────────────────

async function postToExpo(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Expo Push API returned ${response.status}`);
  }

  const result = (await response.json()) as { data: ExpoPushTicket[] };
  return result.data;
}

function countResults(tickets: ExpoPushTicket[]): PushResult {
  let sent = 0;
  let failed = 0;
  for (const ticket of tickets) {
    if (ticket.status === 'ok') {
      sent++;
    } else {
      failed++;
      console.warn(
        `[push] Expo ticket error: ${ticket.message ?? 'unknown'}`,
      );
    }
  }
  return { sent, failed };
}

// ── エクスポート関数 ──────────────────────────────────

export async function sendPushNotifications(
  tokens: string[],
  event: AgentEvent,
): Promise<PushResult> {
  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  if (isDuplicate(event.agent, event.type)) {
    return { sent: 0, failed: 0 };
  }

  const messages = buildMessages(tokens, event);

  try {
    const tickets = await postToExpo(messages);
    const result = countResults(tickets);
    recordSent(event.agent, event.type);
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[push] 送信失敗: ${msg}`);
    return { sent: 0, failed: tokens.length };
  }
}

export async function sendTestNotification(
  tokens: string[],
): Promise<PushResult> {
  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    title: 'ZenTerm',
    body: '🔔 テスト通知です',
    data: { type: 'test' },
    sound: 'default' as const,
    priority: 'high' as const,
  }));

  try {
    const tickets = await postToExpo(messages);
    return countResults(tickets);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[push] テスト通知送信失敗: ${msg}`);
    return { sent: 0, failed: tokens.length };
  }
}
