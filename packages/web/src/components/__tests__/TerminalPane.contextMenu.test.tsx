import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';
import { initI18n } from '@/i18n';

const captured: any[] = [];
vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: (props: any) => {
    captured.push(props);
    return (
      <div
        data-testid="mock-xterm"
        onContextMenu={(e) => {
          e.preventDefault();
          props.onContextMenu?.({ x: 50, y: 60, hasSelection: true });
        }}
      />
    );
  },
}));

import { TerminalPane } from '../TerminalPane';

beforeEach(() => {
  captured.length = 0;
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

describe('TerminalPane context menu', () => {
  it('opens menu on contextmenu event from XtermView and closes on Escape', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    fireEvent.contextMenu(screen.getByTestId('mock-xterm'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Copy$/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Reconnect menuitem bumps reconnectNonce', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    const initialNonce = captured[0].reconnectNonce;
    fireEvent.contextMenu(screen.getByTestId('mock-xterm'));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Reconnect$/ }));
    const last = captured.at(-1);
    expect(last.reconnectNonce).toBe(initialNonce + 1);
  });

  it('Clear menuitem invokes actionsRef.clear', () => {
    const clearSpy = vi.fn();
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    act(() => {
      const last = captured.at(-1);
      last.onActionsReady?.({ copy: vi.fn(), paste: vi.fn(), clear: clearSpy });
    });
    fireEvent.contextMenu(screen.getByTestId('mock-xterm'));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Clear$/ }));
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
