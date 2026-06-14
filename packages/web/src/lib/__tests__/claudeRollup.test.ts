import { describe, expect, it } from 'vitest';
import type { TmuxWindow } from '@zenterm/shared';
import { rollupAgentStatus, rollupClaudeActivity } from '../claudeRollup';

function win(
  index: number,
  activity?: 'working' | 'waiting',
  agent: 'claude' | 'codex' = 'claude',
): TmuxWindow {
  return {
    index,
    name: `w${index}`,
    active: false,
    zoomed: false,
    paneCount: 1,
    cwd: '/h',
    ...(activity ? { agentStatus: { agent, activity }, claudeStatus: { agent, activity } } : {}),
  };
}

describe('rollupClaudeActivity', () => {
  it('どれか working なら working（waiting より優先）', () => {
    expect(rollupClaudeActivity([win(0, 'waiting'), win(1, 'working')])).toBe('working');
  });

  it('working 無し・waiting あり → waiting', () => {
    expect(rollupClaudeActivity([win(0), win(1, 'waiting')])).toBe('waiting');
  });

  it('claude 在席ウィンドウ無し → undefined', () => {
    expect(rollupClaudeActivity([win(0), win(1)])).toBeUndefined();
  });

  it('空配列 → undefined', () => {
    expect(rollupClaudeActivity([])).toBeUndefined();
  });
});

describe('rollupAgentStatus', () => {
  it('working の Codex ステータスを agent 付きで返す', () => {
    expect(rollupAgentStatus([win(0, 'waiting', 'claude'), win(1, 'working', 'codex')])).toEqual({
      agent: 'codex',
      activity: 'working',
    });
  });

  it('agentStatus が無い旧レスポンスは claudeStatus を Claude として扱う', () => {
    const legacy: TmuxWindow = {
      index: 0,
      name: 'legacy',
      active: false,
      zoomed: false,
      paneCount: 1,
      cwd: '/h',
      claudeStatus: { activity: 'waiting' },
    };
    expect(rollupAgentStatus([legacy])).toEqual({ agent: 'claude', activity: 'waiting' });
  });
});
