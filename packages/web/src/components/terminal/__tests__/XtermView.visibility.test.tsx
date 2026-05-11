import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';

// Track the most recently constructed Terminal mock so we can assert focus/fit calls.
const fitCalls: number[] = [];
const focusCalls: number[] = [];
const sentMessages: string[] = [];

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function () {
    return {
      open: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onSelectionChange: vi.fn(() => ({ dispose: vi.fn() })),
      attachCustomKeyEventHandler: vi.fn(),
      write: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(() => focusCalls.push(performance.now())),
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
  FitAddon: vi.fn().mockImplementation(function () {
    return { fit: vi.fn(() => fitCalls.push(performance.now())) };
  }),
}));

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(function () { return {}; }),
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(function () { return {}; }),
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

import { XtermView } from '../XtermView';

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

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    sentMessages.push(data);
  }

  close(code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000 } as CloseEvent);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }
}

beforeEach(() => {
  fitCalls.length = 0;
  focusCalls.length = 0;
  sentMessages.length = 0;
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  useSettingsStore.setState({ fontSize: 14 } as any);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('XtermView isVisible prop', () => {
  it('does not unmount terminal when toggled false', () => {
    const { rerender } = render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    const wsBefore = MockWebSocket.instances.length;
    rerender(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible={false}
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    // No new WebSocket should be opened, and the existing one stays connected.
    expect(MockWebSocket.instances.length).toBe(wsBefore);
    expect(MockWebSocket.instances[0].readyState).not.toBe(MockWebSocket.CLOSED);
  });

  it('calls fit + focus when toggled false → true', () => {
    const { rerender } = render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible={false}
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    const fitCallsBeforeReveal = fitCalls.length;
    const focusCallsBeforeReveal = focusCalls.length;
    act(() => {
      rerender(
        <XtermView
          gatewayUrl="http://gateway.test:18765"
          token="1234"
          sessionId="dev"
          windowIndex={0}
          isVisible
          isFocused
          reconnectNonce={0}
          onStatusChange={() => undefined}
        />,
      );
    });
    expect(fitCalls.length).toBeGreaterThan(fitCallsBeforeReveal);
    expect(focusCalls.length).toBeGreaterThan(focusCallsBeforeReveal);
  });

  it('sends a resize message on reveal when WS is open', () => {
    const { rerender } = render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible={false}
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    sentMessages.length = 0;
    act(() => {
      rerender(
        <XtermView
          gatewayUrl="http://gateway.test:18765"
          token="1234"
          sessionId="dev"
          windowIndex={0}
          isVisible
          isFocused
          reconnectNonce={0}
          onStatusChange={() => undefined}
        />,
      );
    });
    const resizeMsgs = sentMessages.filter((m) => m.includes('"type":"resize"'));
    expect(resizeMsgs.length).toBeGreaterThanOrEqual(1);
  });
});
