import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionsMenu } from '../RowActionsMenu';

describe('RowActionsMenu', () => {
  const items = [
    { label: 'Rename', onClick: vi.fn() },
    { label: 'Delete', onClick: vi.fn(), destructive: true },
  ];

  it('does not render content when closed', () => {
    render(
      <RowActionsMenu open={false} anchorEl={null} items={items} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders menu items when open', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(
      <RowActionsMenu open anchorEl={anchor} items={items} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('clicking an item calls its onClick and onClose', async () => {
    const renameClick = vi.fn();
    const onClose = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const items = [{ label: 'Rename', onClick: renameClick }];
    render(<RowActionsMenu open anchorEl={anchor} items={items} onClose={onClose} />);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(renameClick).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape closes the menu', async () => {
    const onClose = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<RowActionsMenu open anchorEl={anchor} items={items} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking outside closes the menu', async () => {
    const onClose = vi.fn();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(
      <>
        <RowActionsMenu open anchorEl={anchor} items={items} onClose={onClose} />
        <div data-testid="outside" style={{ width: 50, height: 50 }} />
      </>,
    );
    await userEvent.click(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });
});
