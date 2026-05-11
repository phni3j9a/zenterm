import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';

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
  FitAddon: vi.fn().mockImplementation(function () { return { fit: vi.fn() }; }),
}));
vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn().mockImplementation(function () { return {}; }),
}));
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(function () { return {}; }),
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

import { XtermView, type ReconnectInfo } from '../XtermView';

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
  close(code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000 } as CloseEvent);
  }
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  useSettingsStore.setState({ fontSize: 14 } as any);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('XtermView reconnectNonce', () => {
  it('opens a new WS when nonce increments', () => {
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
    expect(MockWebSocket.instances.length).toBe(1);
    const oldWs = MockWebSocket.instances[0];

    act(() => {
      rerender(
        <XtermView
          gatewayUrl="http://gateway.test:18765"
          token="1234"
          sessionId="dev"
          windowIndex={0}
          isVisible
          isFocused
          reconnectNonce={1}
          onStatusChange={() => undefined}
        />,
      );
    });

    expect(oldWs.readyState).toBe(MockWebSocket.CLOSED);
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it('emits ReconnectInfo on unexpected close (reconnecting state)', async () => {
    vi.useFakeTimers();
    const onInfo = vi.fn();
    const onStatus = vi.fn();
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible
        isFocused
        reconnectNonce={0}
        onStatusChange={onStatus}
        onReconnectInfo={onInfo}
      />,
    );
    act(() => {
      MockWebSocket.instances[0].onclose?.({ code: 1006 } as CloseEvent);
    });
    expect(onStatus).toHaveBeenCalledWith('reconnecting');
    const lastInfoCall = onInfo.mock.calls.at(-1);
    expect(lastInfoCall).toBeTruthy();
    const info: ReconnectInfo | null = lastInfoCall![0];
    expect(info).not.toBeNull();
    expect(info!.exhausted).toBe(false);
    expect(info!.attempt).toBeGreaterThanOrEqual(1);
    expect(info!.etaMs).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('clears ReconnectInfo to null when WS opens cleanly', () => {
    const onInfo = vi.fn();
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
        onReconnectInfo={onInfo}
      />,
    );
    act(() => {
      const ws = MockWebSocket.instances[0];
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.({} as Event);
    });
    // First call (mount) was null; reset clears the ReconnectInfo on connect.
    expect(onInfo).toHaveBeenCalledWith(null);
  });
});
