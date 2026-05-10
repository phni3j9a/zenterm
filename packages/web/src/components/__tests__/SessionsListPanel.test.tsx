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

const noopActions = {
  onSelect: vi.fn(),
  onCreateSession: vi.fn(),
  onRenameSession: vi.fn(),
  onRequestDeleteSession: vi.fn(),
  onCreateWindow: vi.fn(),
  onRenameWindow: vi.fn(),
  onRequestDeleteWindow: vi.fn(),
};

describe('SessionsListPanel', () => {
  it('renders session names', () => {
    render(
      <SessionsListPanel
        sessions={sessions}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('clicking a session calls onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <SessionsListPanel
        sessions={sessions}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByText('dev'));
    expect(onSelect).toHaveBeenCalledWith('dev', undefined);
  });

  it('shows loading state', () => {
    render(
      <SessionsListPanel
        sessions={[]}
        loading
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
  });

  it('shows empty state when sessions array is empty', () => {
    render(
      <SessionsListPanel
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByText(/セッションなし/)).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <SessionsListPanel
        sessions={[]}
        loading={false}
        error="boom"
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByText(/読み込めませんでした/)).toBeInTheDocument();
  });

  it('expanding a session reveals + window button', async () => {
    render(
      <SessionsListPanel
        sessions={sessions}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Expand windows/));
    expect(screen.getByRole('button', { name: /\+ window/ })).toBeInTheDocument();
  });

  it('always shows + 新規セッション in footer', () => {
    render(
      <SessionsListPanel
        sessions={sessions}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        {...noopActions}
      />,
    );
    expect(screen.getByRole('button', { name: /新規セッション/ })).toBeInTheDocument();
  });
});
