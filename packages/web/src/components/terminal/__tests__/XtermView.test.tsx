import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

// xterm.js can't render in jsdom (no canvas). Mock the modules so the
// component tree mounts cleanly while we test WS / lifecycle wiring.
vi.mock('@xterm/xterm', () => ({
  // vitest 4.x requires regular functions (not arrow functions) for constructor mocks
  Terminal: vi.fn().mockImplementation(function() {
    return {
      open: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      write: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      options: {},
      cols: 80,
      rows: 24,
      unicode: { activeVersion: '6' },
    };
  }),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(function() { return { fit: vi.fn() }; }),
}));

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(function() { return {}; }),
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(function() { return {}; }),
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
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
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
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('XtermView', () => {
  it('opens a WebSocket with the right URL on mount', () => {
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isFocused
        theme="dark"
        fontSize={14}
        onStatusChange={() => undefined}
      />,
    );
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      'ws://gateway.test:18765/ws/terminal?sessionId=dev&windowIndex=0&token=1234',
    );
  });

  it('reports connected status when WS opens', () => {
    const onStatus = vi.fn();
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isFocused
        theme="dark"
        fontSize={14}
        onStatusChange={onStatus}
      />,
    );
    expect(onStatus).toHaveBeenCalledWith('disconnected');
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    expect(onStatus).toHaveBeenCalledWith('connected');
  });

  it('closes the WS on unmount', () => {
    const { unmount } = render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isFocused
        theme="dark"
        fontSize={14}
        onStatusChange={() => undefined}
      />,
    );
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('reconnects with backoff on unexpected close', async () => {
    vi.useFakeTimers();
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isFocused
        theme="dark"
        fontSize={14}
        onStatusChange={() => undefined}
      />,
    );
    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => {
      MockWebSocket.instances[0].onclose?.({ code: 1006 } as CloseEvent);
    });
    expect(MockWebSocket.instances).toHaveLength(1); // not yet reconnected
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.useRealTimers();
  });
});
