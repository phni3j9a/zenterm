import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TmuxWindow } from '@zenterm/shared';
import { WindowRow } from '../WindowRow';

const window: TmuxWindow = {
  index: 1,
  name: 'test',
  active: false,
  zoomed: false,
  paneCount: 1,
  cwd: '/home/me',
};

describe('WindowRow', () => {
  it('renders window name', () => {
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('clicking row calls onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        onSelect={onSelect}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText('test'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('Rename via kebab triggers onRename with new name', async () => {
    const onRename = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        onSelect={vi.fn()}
        onRename={onRename}
        onRequestDelete={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for window test/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'renamed{Enter}');
    expect(onRename).toHaveBeenCalledWith('dev', 1, 'renamed');
  });

  it('Delete via kebab calls onRequestDelete', async () => {
    const onRequestDelete = vi.fn();
    render(
      <WindowRow
        sessionDisplayName="dev"
        window={window}
        isActive={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={onRequestDelete}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Actions for window test/));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(onRequestDelete).toHaveBeenCalledWith('dev', window);
  });
});
