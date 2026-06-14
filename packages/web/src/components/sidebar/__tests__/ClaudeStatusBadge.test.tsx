import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaudeStatusBadge } from '../ClaudeStatusBadge';

describe('ClaudeStatusBadge', () => {
  it('working: aria-label と summary 付きツールチップ', () => {
    render(<ClaudeStatusBadge status={{ activity: 'working', summary: 'XT5処理' }} />);
    const el = screen.getByRole('img');
    expect(el).toHaveAttribute('aria-label', 'Working');
    expect(el).toHaveAttribute('title', 'Working · XT5処理');
  });

  it('waiting: summary 無しならツールチップは状態のみ', () => {
    render(<ClaudeStatusBadge status={{ activity: 'waiting' }} />);
    const el = screen.getByRole('img');
    expect(el).toHaveAttribute('aria-label', 'Waiting for input');
    expect(el).toHaveAttribute('title', 'Waiting for input');
  });

  it('codex: agent に応じた aria-label とツールチップを使う', () => {
    render(<ClaudeStatusBadge status={{ agent: 'codex', activity: 'working', summary: 'zenterm' }} />);
    const el = screen.getByRole('img');
    expect(el).toHaveAttribute('aria-label', 'Codex working');
    expect(el).toHaveAttribute('title', 'Codex working · zenterm');
  });
});
