import type { AgentWindowStatus, ClaudeActivity, TmuxWindow } from '@zenterm/shared';

export function getWindowAgentStatus(window: TmuxWindow): AgentWindowStatus | undefined {
  if (window.agentStatus) return window.agentStatus;
  if (!window.claudeStatus) return undefined;
  return {
    agent: window.claudeStatus.agent ?? 'claude',
    activity: window.claudeStatus.activity,
    ...(window.claudeStatus.summary ? { summary: window.claudeStatus.summary } : {}),
  };
}

/**
 * セッション内の各ウィンドウの AI エージェント活動を 1 つに集約する。
 * working 最優先 → waiting → どちらも無ければ undefined。
 */
export function rollupAgentStatus(
  windows: readonly TmuxWindow[],
): AgentWindowStatus | undefined {
  let waiting: AgentWindowStatus | undefined;
  for (const w of windows) {
    const status = getWindowAgentStatus(w);
    if (!status) continue;
    const compact = { agent: status.agent, activity: status.activity };
    if (status.activity === 'working') return compact;
    waiting ??= compact;
  }
  return waiting;
}

/**
 * セッション内の各ウィンドウの Claude 活動を 1 つに集約する。
 * working 最優先 → waiting → どちらも無ければ undefined（= Claude 無）。
 */
export function rollupClaudeActivity(
  windows: readonly TmuxWindow[],
): ClaudeActivity | undefined {
  return rollupAgentStatus(windows)?.activity;
}
