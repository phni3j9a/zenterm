import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';

const selectionListeners: Array<() => void> = [];

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function () {
    return {
      open: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onSelectionChange: vi.fn((cb: () => void) => {
        selectionListeners.push(cb);
        return { dispose: vi.fn() };
      }),
      attachCustomKeyEventHandler: vi.fn(),
      write: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      getSelection: vi.fn(() => 'highlighted-text'),
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

import { XtermView } from '../XtermView';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  url: string; readyState = MockWebSocket.OPEN;
  onopen: any = null; onmessage: any = null; onclose: any = null; onerror: any = null;
  send = vi.fn(); close() { this.readyState = MockWebSocket.CLOSED; }
  constructor(url: string) { this.url = url; }
}

beforeEach(() => {
  selectionListeners.length = 0;
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
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

describe('XtermView selection auto-copy', () => {
  it('does not write to clipboard when autoCopyOnSelect is false', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, writable: true, value: { writeText, readText: async () => '' },
    });
    useSettingsStore.setState({ autoCopyOnSelect: false } as any);
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        isVisible
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    selectionListeners[selectionListeners.length - 1]?.();
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('writes term.getSelection() to clipboard when autoCopyOnSelect is true', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, writable: true, value: { writeText, readText: async () => '' },
    });
    useSettingsStore.setState({ autoCopyOnSelect: true } as any);
    render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        isVisible
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    selectionListeners[selectionListeners.length - 1]?.();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('highlighted-text');
  });
});
