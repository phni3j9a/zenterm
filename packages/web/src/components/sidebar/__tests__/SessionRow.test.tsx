import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TmuxSession } from '@zenterm/shared';
import { SessionRow } from '../SessionRow';

const session: TmuxSession = {
  name: 'zen_dev',
  displayName: 'dev',
  created: 1,
  cwd: '/home/me',
  windows: [
    { index: 0, name: 'main', active: true, zoomed: false, paneCount: 1, cwd: '/home/me' },
    { index: 1, name: 'test', active: false, zoomed: false, paneCount: 1, cwd: '/home/me' },
  ],
};

describe('SessionRow', () => {
  it('renders displayName and cwd', () => {
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('/home/me')).toBeInTheDocument();
  });

  it('clicking row calls onSelect with displayName', async () => {
    const onSelect = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={onSelect}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('dev'));
    expect(onSelect).toHaveBeenCalledWith('dev', undefined);
  });

  it('expand toggle is visible when window count > 1', async () => {
    const onToggleExpand = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={onToggleExpand}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Expand windows/i));
    expect(onToggleExpand).toHaveBeenCalledWith('zen_dev');
  });

  it('kebab menu opens on click and offers Rename + Delete', async () => {
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    expect(screen.getByRole('menuitem', { name: /Rename/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
  });

  it('Rename click triggers inline edit and onRename on Enter', async () => {
    const onRename = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={onRename}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');
    expect(onRename).toHaveBeenCalledWith('dev', 'renamed');
  });

  it('Delete click calls onRequestDelete', async () => {
    const onRequestDelete = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        activeWindowIndex={null}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={onRequestDelete}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(onRequestDelete).toHaveBeenCalledWith(session);
  });
});
