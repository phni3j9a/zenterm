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

const sessionNoWindows: TmuxSession = {
  name: 'zen_empty',
  displayName: 'empty',
  created: 1,
  cwd: '/home/me',
  windows: [],
};

describe('SessionRow', () => {
  it('renders displayName and cwd', () => {
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
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
        openInPaneOptions={[]}
        onSelect={onSelect}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
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
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={onToggleExpand}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
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
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
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
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={onRename}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
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
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={onRequestDelete}
        onOpenInPane={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(onRequestDelete).toHaveBeenCalledWith(session);
  });

  it('shows open-in-pane menu items when openInPaneOptions provided', async () => {
    const onOpenInPane = vi.fn();
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        openInPaneOptions={[1, 2]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={onOpenInPane}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    // idx=1 → pane: 2、idx=2 → pane: 3
    await userEvent.click(screen.getByRole('menuitem', { name: /pane 2/i }));
    expect(onOpenInPane).toHaveBeenCalledWith(1);
  });

  it('hides open-in-pane items when openInPaneOptions is empty', async () => {
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for session dev/i));
    expect(screen.queryByRole('menuitem', { name: /open in pane|pane \d/i })).toBeNull();
  });

  it('renders state dot with aria-label "Active" when isActive is true', () => {
    render(
      <SessionRow
        session={session}
        isActive={true}
        isExpanded={false}
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.getByTestId('session-row-state-dot')).toHaveAttribute('aria-label', 'Active');
  });

  it('renders state dot with aria-label "Detached" when session has no windows and not active', () => {
    render(
      <SessionRow
        session={sessionNoWindows}
        isActive={false}
        isExpanded={false}
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.getByTestId('session-row-state-dot')).toHaveAttribute('aria-label', 'Detached');
  });

  it('renders chevron toggle with data-testid when session has multiple windows', () => {
    render(
      <SessionRow
        session={session}
        isActive={false}
        isExpanded={false}
        openInPaneOptions={[]}
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.getByTestId('session-row-chevron')).toBeInTheDocument();
  });
});
