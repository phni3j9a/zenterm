import { describe, expect, it, vi } from 'vitest';
import { parseControlLine, tmuxControlService } from '../../services/tmuxControl.js';

// node-pty と node:child_process をモックして、テスト環境で spawn や execFileSync が
// 実際の tmux を呼ばないようにする。
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    kill: vi.fn(),
  })),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('parseControlLine', () => {
  it.each([
    ['%window-add @5', 'windows-changed'],
    ['%window-close @7', 'windows-changed'],
    ['%window-renamed @5 work', 'windows-changed'],
    ['%unlinked-window-add @9', 'windows-changed'],
    ['%unlinked-window-close @9', 'windows-changed'],
    ['%unlinked-window-renamed @9 ops', 'windows-changed'],
    ['%layout-change @5 layout-string', 'windows-changed'],
    ['%session-window-changed $1 @5', 'windows-changed'],
  ])('%s -> windows-changed', (line, expected) => {
    expect(parseControlLine(line)).toEqual({ type: expected });
  });

  it.each([
    ['%sessions-changed', 'sessions-changed'],
    ['%session-renamed $1 work', 'sessions-changed'],
  ])('%s -> sessions-changed', (line, expected) => {
    expect(parseControlLine(line)).toEqual({ type: expected });
  });

  it.each([
    ['%output %1 hello world'],
    ['%pane-mode-changed %1'],
    ['%client-detached client'],
    ['%begin 1234 1 1'],
    ['%end 1234 1 1'],
    ['just a regular line'],
    [''],
  ])('%s is ignored', (line) => {
    expect(parseControlLine(line)).toBeNull();
  });

  it('末尾の改行を許容する', () => {
    expect(parseControlLine('%window-add @5\r')).toEqual({ type: 'windows-changed' });
  });
});

describe('publish', () => {
  it('publish したイベントが購読者に届く', () => {
    const received: unknown[] = [];
    const unsubscribe = tmuxControlService.subscribe((e) => received.push(e));
    tmuxControlService.publish({ type: 'claude-status-changed' });
    unsubscribe();
    expect(received).toContainEqual({ type: 'claude-status-changed' });
  });
});
