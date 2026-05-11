import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';

const xtermProps: any[] = [];
vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: (props: any) => {
    xtermProps.push(props);
    return <div data-testid="mock-xterm" data-nonce={props.reconnectNonce} />;
  },
}));

import { TerminalPane } from '../TerminalPane';

beforeEach(() => {
  xtermProps.length = 0;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TerminalPane Reconnect button', () => {
  it('initially mounts XtermView with nonce 0', () => {
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
    expect(screen.getByTestId('mock-xterm').getAttribute('data-nonce')).toBe('0');
  });

  it('increments nonce when Reconnect button is clicked', () => {
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
    // Force the status to "disconnected" by invoking the captured callback.
    const last = xtermProps.at(-1);
    expect(typeof last.onStatusChange).toBe('function');
    act(() => {
      last.onStatusChange('disconnected');
    });
    const btn = screen.getByRole('button', { name: /reconnect/i });
    fireEvent.click(btn);
    const nodes = screen.getAllByTestId('mock-xterm');
    const nonce = parseInt(nodes[nodes.length - 1].getAttribute('data-nonce') ?? '0', 10);
    expect(nonce).toBe(1);
  });

  it('shows reconnecting eta when ReconnectInfo is set with attempt + etaMs', () => {
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
    const last = xtermProps.at(-1);
    act(() => {
      last.onStatusChange('reconnecting');
      last.onReconnectInfo({ attempt: 2, etaMs: 4000, exhausted: false });
    });
    expect(screen.getByTestId('terminal-reconnect-eta')).toBeInTheDocument();
  });
});
