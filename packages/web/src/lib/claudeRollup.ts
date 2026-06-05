import type { ClaudeActivity, TmuxWindow } from '@zenterm/shared';

/**
 * セッション内の各ウィンドウの Claude 活動を 1 つに集約する。
 * working 最優先 → waiting → どちらも無ければ undefined（= Claude 無）。
 */
export function rollupClaudeActivity(
  windows: readonly TmuxWindow[],
): ClaudeActivity | undefined {
  let sawWaiting = false;
  for (const w of windows) {
    if (w.claudeStatus?.activity === 'working') return 'working';
    if (w.claudeStatus?.activity === 'waiting') sawWaiting = true;
  }
  return sawWaiting ? 'waiting' : undefined;
}
