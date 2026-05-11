import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';
import { initI18n } from '@/i18n';
import { TerminalContextMenu } from '../TerminalContextMenu';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en' } as any);
  initI18n();
});

describe('TerminalContextMenu', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <TerminalContextMenu
        open={false}
        x={10}
        y={20}
        hasSelection={false}
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders 4 items when open=true', () => {
    render(
      <TerminalContextMenu
        open
        x={10}
        y={20}
        hasSelection
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('menuitem', { name: /^Copy$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Paste$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Clear$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Reconnect$/ })).toBeInTheDocument();
  });

  it('disables Copy when hasSelection=false', () => {
    render(
      <TerminalContextMenu
        open
        x={10}
        y={20}
        hasSelection={false}
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('menuitem', { name: /^Copy$/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('clicking an item triggers callback and onClose', () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();
    render(
      <TerminalContextMenu
        open
        x={10}
        y={20}
        hasSelection
        onCopy={onCopy}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /^Copy$/ }));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key calls onClose', () => {
    const onClose = vi.fn();
    render(
      <TerminalContextMenu
        open
        x={10}
        y={20}
        hasSelection
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking outside calls onClose', () => {
    const onClose = vi.fn();
    render(
      <>
        <div data-testid="outside" style={{ width: 100, height: 100 }} />
        <TerminalContextMenu
          open
          x={10}
          y={20}
          hasSelection
          onCopy={() => undefined}
          onPaste={() => undefined}
          onClear={() => undefined}
          onReconnect={() => undefined}
          onClose={onClose}
        />
      </>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('positions itself at x/y', () => {
    render(
      <TerminalContextMenu
        open
        x={42}
        y={84}
        hasSelection
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={() => undefined}
      />,
    );
    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBe('42px');
    expect(menu.style.top).toBe('84px');
  });
});
