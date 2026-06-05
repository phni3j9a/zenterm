import { describe, expect, it } from 'vitest';
import type { TmuxWindow } from '@zenterm/shared';
import { rollupClaudeActivity } from '../claudeRollup';

function win(index: number, activity?: 'working' | 'waiting'): TmuxWindow {
  return {
    index,
    name: `w${index}`,
    active: false,
    zoomed: false,
    paneCount: 1,
    cwd: '/h',
    ...(activity ? { claudeStatus: { activity } } : {}),
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
