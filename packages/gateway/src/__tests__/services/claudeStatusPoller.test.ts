import { describe, expect, it, vi } from 'vitest';
import {
  computeStatusSignature,
  ClaudeStatusPoller,
} from '../../services/claudeStatusPoller.js';

describe('computeStatusSignature', () => {
  // 行: session_name|index|name|active|zoomed|panes|cwd|panePid|command|title
  it('prefix 一致セッションのみ・activity を署名化（ソート安定）', () => {
    const out = [
      'zen_a|0|main|1|0|1|/h|101|claude|⠂ x',
      'zen_a|1|w|0|0|1|/h|102|zsh|server',
      '_zen_view_1|0|main|1|0|1|/h|103|claude|⠂ x', // prefix 不一致 → 除外
      'zen_b|0|m|1|0|1|/h|104|claude|✳ y',
      'zen_c|0|m|1|0|1|/h|105|codex|⠋ z',
    ].join('\n');
    expect(computeStatusSignature(out, 'zen_')).toBe(
      'zen_a/0:claude:working,zen_a/1:none,zen_b/0:claude:waiting,zen_c/0:codex:working',
    );
  });

  it('空出力 → 空署名', () => {
    expect(computeStatusSignature('', 'zen_')).toBe('');
  });
});

describe('ClaudeStatusPoller', () => {
  function make(outputs: string[]) {
    let i = 0;
    const publish = vi.fn();
    const runTmux = vi.fn(() => outputs[Math.min(i++, outputs.length - 1)]);
    const poller = new ClaudeStatusPoller({ runTmux, publish, intervalMs: 1000, sessionPrefix: 'zen_' });
    return { poller, publish, runTmux };
  }

  it('署名が変化した tick だけ publish する', () => {
    const { poller, publish } = make([
      'zen_a|0|m|1|0|1|/h|101|claude|⠂ x', // working
      'zen_a|0|m|1|0|1|/h|101|claude|⠂ x', // 同じ → publish しない
      'zen_a|0|m|1|0|1|/h|101|claude|✳ x', // waiting → publish
    ]);
    poller.tick();
    poller.tick();
    poller.tick();
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith({ type: 'claude-status-changed' });
  });

  it('runTmux が throw したら全 none 扱い（直前が非空なら 1 回 publish）', () => {
    const publish = vi.fn();
    let mode: 'ok' | 'throw' = 'ok';
    const runTmux = vi.fn(() => {
      if (mode === 'throw') throw new Error('no server');
      return 'zen_a|0|m|1|0|1|/h|101|claude|⠂ x';
    });
    const poller = new ClaudeStatusPoller({ runTmux, publish, intervalMs: 1000, sessionPrefix: 'zen_' });
    poller.tick(); // '' → working: publish 1
    mode = 'throw';
    poller.tick(); // working → '': publish 2
    poller.tick(); // '' → '': no publish
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('acquire でインターバル開始（即時 tick）、release で停止', () => {
    vi.useFakeTimers();
    const { poller, runTmux } = make(['zen_a|0|m|1|0|1|/h|101|zsh|x']);
    poller.acquire();
    expect(runTmux).toHaveBeenCalledTimes(1); // 即時 tick
    vi.advanceTimersByTime(2000);
    expect(runTmux).toHaveBeenCalledTimes(3); // +2 tick
    poller.release();
    vi.advanceTimersByTime(5000);
    expect(runTmux).toHaveBeenCalledTimes(3); // 停止後は増えない
    vi.useRealTimers();
  });
});
