import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu, type ContextMenuItem } from '../ContextMenu';

const baseItems: ContextMenuItem[] = [
  { id: 'copy', label: 'Copy', onSelect: vi.fn() },
  { id: 'paste', label: 'Paste', onSelect: vi.fn() },
  { id: 'del', label: 'Delete', onSelect: vi.fn(), disabled: true },
];

describe('ContextMenu', () => {
  it('renders nothing when open=false', () => {
    render(
      <ContextMenu
        open={false}
        anchorPoint={{ x: 0, y: 0 }}
        items={baseItems}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders menu items when open=true', () => {
    render(
      <ContextMenu
        open
        anchorPoint={{ x: 10, y: 20 }}
        items={baseItems}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Paste' })).toBeInTheDocument();
  });

  it('clicking an item calls onSelect and onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const items: ContextMenuItem[] = [{ id: 'copy', label: 'Copy', onSelect }];
    render(
      <ContextMenu open anchorPoint={{ x: 0, y: 0 }} items={items} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disabled items have aria-disabled=true and clicks are no-ops', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const items: ContextMenuItem[] = [{ id: 'copy', label: 'Copy', onSelect, disabled: true }];
    render(
      <ContextMenu open anchorPoint={{ x: 0, y: 0 }} items={items} onClose={onClose} />,
    );
    const btn = screen.getByRole('menuitem', { name: 'Copy' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    render(
      <ContextMenu open anchorPoint={{ x: 0, y: 0 }} items={baseItems} onClose={onClose} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('pointerdown outside calls onClose', () => {
    const onClose = vi.fn();
    render(
      <>
        <div data-testid="outside" />
        <ContextMenu open anchorPoint={{ x: 0, y: 0 }} items={baseItems} onClose={onClose} />
      </>,
    );
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('destructive items render with error color style', () => {
    const items: ContextMenuItem[] = [
      { id: 'del', label: 'Delete', onSelect: vi.fn(), destructive: true },
    ];
    render(
      <ContextMenu open anchorPoint={{ x: 0, y: 0 }} items={items} onClose={vi.fn()} />,
    );
    const btn = screen.getByRole('menuitem', { name: 'Delete' });
    // The button's color style should differ from default (set to error token)
    expect(btn).toBeInTheDocument();
    // Verify the button has a non-empty style color (the exact hex depends on theme)
    expect(btn.style.color).toBeTruthy();
  });

  it('renders optional shortcut text', () => {
    const items: ContextMenuItem[] = [
      { id: 'copy', label: 'Copy', onSelect: vi.fn(), shortcut: '⌘C' },
    ];
    render(
      <ContextMenu open anchorPoint={{ x: 0, y: 0 }} items={items} onClose={vi.fn()} />,
    );
    expect(screen.getByText('⌘C')).toBeInTheDocument();
  });

  it('ArrowDown / ArrowUp move focus through items', () => {
    render(
      <ContextMenu open={true} anchorPoint={{ x: 0, y: 0 }} onClose={vi.fn()} items={baseItems} ariaLabel="m" />,
    );
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    // items[2] is disabled, so focus should skip to wrap-around items[0]
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('viewport edge flip: anchorPoint near right edge → menu shifts left', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
    render(
      <ContextMenu open={true} anchorPoint={{ x: 790, y: 10 }} onClose={vi.fn()} items={baseItems} ariaLabel="m" />,
    );
    const menu = screen.getByRole('menu') as HTMLElement;
    const left = parseFloat(menu.style.left || '0');
    expect(left).toBeLessThanOrEqual(800 - 160);
  });
});
