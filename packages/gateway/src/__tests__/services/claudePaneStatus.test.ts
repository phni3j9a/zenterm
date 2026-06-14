import { describe, expect, it } from 'vitest';
import { deriveAgentStatus, deriveClaudeStatus } from '../../services/claudePaneStatus.js';

describe('deriveClaudeStatus', () => {
  it('点字スピナー先頭グリフ → working', () => {
    expect(deriveClaudeStatus('claude', '⠂ hiroshima リポジトリ解説')).toEqual({
      activity: 'working',
      summary: 'hiroshima リポジトリ解説',
    });
    // 別フレームでも working
    expect(deriveClaudeStatus('claude', '⠐ x')?.activity).toBe('working');
    expect(deriveClaudeStatus('claude', '⣿ y')?.activity).toBe('working');
  });

  it('✳(U+2733) 先頭グリフ → waiting', () => {
    expect(deriveClaudeStatus('claude', '✳ XT5カメラ処理')).toEqual({
      activity: 'waiting',
      summary: 'XT5カメラ処理',
    });
  });

  it('claude 終了後の stale タイトル（command=zsh）→ undefined', () => {
    expect(deriveClaudeStatus('zsh', '⠐ 残骸タイトル')).toBeUndefined();
  });

  it('node 直起動 + 既知グリフ → 在席', () => {
    expect(deriveClaudeStatus('node', '⠂ task')).toEqual({
      activity: 'working',
      summary: 'task',
    });
  });

  it('node だが既知グリフ無し（無関係な node アプリ）→ undefined', () => {
    expect(deriveClaudeStatus('node', 'vite dev server')).toBeUndefined();
  });

  it('claude 在席だがグリフ不明 → waiting、summary は全体', () => {
    expect(deriveClaudeStatus('claude', 'server-Macmini')).toEqual({
      activity: 'waiting',
      summary: 'server-Macmini',
    });
  });

  it('summary が空なら省略', () => {
    expect(deriveClaudeStatus('claude', '✳')).toEqual({ activity: 'waiting' });
    expect(deriveClaudeStatus('claude', '⠂   ')).toEqual({ activity: 'working' });
  });

  it('空タイトル + 非claude command → undefined', () => {
    expect(deriveClaudeStatus('zsh', '')).toBeUndefined();
  });
});

describe('deriveAgentStatus', () => {
  it('codex command + 点字スピナー先頭グリフ → Codex working', () => {
    expect(deriveAgentStatus('codex', '⠋ zenterm')).toEqual({
      agent: 'codex',
      activity: 'working',
      summary: 'zenterm',
    });
  });

  it('node wrapper 配下の codex プロセスを Codex として扱う', () => {
    expect(
      deriveAgentStatus('node', 'xt5-ftp', {
        panePid: 7108,
        resolveAgentForPane: () => 'codex',
      }),
    ).toEqual({
      agent: 'codex',
      activity: 'waiting',
      summary: 'xt5-ftp',
    });
  });

  it('node wrapper + Codex + 点字スピナー先頭グリフ → Codex working', () => {
    expect(
      deriveAgentStatus('node', '⠋ zenterm', {
        panePid: 7778,
        resolveAgentForPane: () => 'codex',
      }),
    ).toEqual({
      agent: 'codex',
      activity: 'working',
      summary: 'zenterm',
    });
  });

  it('node + 既知グリフでプロセス判定不能なら既存互換で Claude として扱う', () => {
    expect(
      deriveAgentStatus('node', '⠂ task', {
        panePid: 1,
        resolveAgentForPane: () => undefined,
      }),
    ).toEqual({
      agent: 'claude',
      activity: 'working',
      summary: 'task',
    });
  });
});
