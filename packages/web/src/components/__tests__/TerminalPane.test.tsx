import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';

// Same xterm.js mocks as XtermView test — TerminalPane mounts XtermView
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function() {
    return {
      open: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onSelectionChange: vi.fn(() => ({ dispose: vi.fn() })),
      attachCustomKeyEventHandler: vi.fn(),
      write: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      getSelection: vi.fn(() => ''),
      clear: vi.fn(),
      refresh: vi.fn(),
      options: {},
      cols: 80,
      rows: 24,
      unicode: { activeVersion: '6' },
    };
  }),
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(function() {
    return { fit: vi.fn() };
  }),
}));
vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(function() {
    return {};
  }),
}));
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(function() {
    return {};
  }),
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

import { TerminalPane } from '../TerminalPane';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close() { this.readyState = MockWebSocket.CLOSED; }
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  // matchMedia for theme detection
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  // Dismiss onboarding so the empty-state test sees EmptyState, not OnboardingGuide.
  useSettingsStore.setState({ dismissOnboarding: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TerminalPane', () => {
  it('shows empty state when no session selected', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId={null}
        windowIndex={null}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    expect(screen.getByText(/Select a session/i)).toBeInTheDocument();
  });

  it('shows session/window in toolbar when active', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={2}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    expect(screen.getByText(/dev/)).toBeInTheDocument();
    expect(screen.getByText(/w2/)).toBeInTheDocument();
  });

  it('keeps DOM mounted but hidden when isVisible=false', () => {
    const { container } = render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible={false}
      />,
    );
    const root = container.querySelector('section[data-terminal-root="true"]');
    expect(root).not.toBeNull();
    expect((root as HTMLElement).style.display).toBe('none');
  });

  it('shows DOM (display: grid) when isVisible=true', () => {
    const { container } = render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    const root = container.querySelector('section[data-terminal-root="true"]');
    expect(root).not.toBeNull();
    expect((root as HTMLElement).style.display).toBe('grid');
  });
});
