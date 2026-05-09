import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TmuxSession } from '@zenterm/shared';
import { SessionsListPanel } from '../SessionsListPanel';

const sessions: TmuxSession[] = [
  {
    name: 'zen_dev',
    displayName: 'dev',
    created: 1,
    cwd: '/home/me/proj',
    windows: [
      { index: 0, name: 'main', active: true, zoomed: false, paneCount: 1, cwd: '/home/me/proj' },
      { index: 1, name: 'test', active: false, zoomed: false, paneCount: 1, cwd: '/home/me/proj' },
    ],
  },
];

describe('SessionsListPanel', () => {
  it('renders session names', () => {
    render(<SessionsListPanel sessions={sessions} onSelect={vi.fn()} activeSessionId={null} activeWindowIndex={null} />);
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('clicking a session calls onSelect with sessionId', async () => {
    const onSelect = vi.fn();
    render(<SessionsListPanel sessions={sessions} onSelect={onSelect} activeSessionId={null} activeWindowIndex={null} />);
    await userEvent.click(screen.getByText('dev'));
    expect(onSelect).toHaveBeenCalledWith('dev', undefined);
  });

  it('expands to show windows and clicking a window calls onSelect with index', async () => {
    const onSelect = vi.fn();
    render(<SessionsListPanel sessions={sessions} onSelect={onSelect} activeSessionId={null} activeWindowIndex={null} />);
    await userEvent.click(screen.getByLabelText(/Expand windows/i));
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    await userEvent.click(screen.getByText('test'));
    expect(onSelect).toHaveBeenCalledWith('dev', 1);
  });

  it('highlights active session', () => {
    render(
      <SessionsListPanel
        sessions={sessions}
        onSelect={vi.fn()}
        activeSessionId="dev"
        activeWindowIndex={0}
      />,
    );
    const row = screen.getByText('dev').closest('button');
    expect(row).toHaveAttribute('aria-current', 'true');
  });
});
