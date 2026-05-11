import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettingsStore,
} from '@/stores/settings';

const handlerRefs: Array<(ev: KeyboardEvent) => boolean> = [];

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function () {
    return {
      open: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onSelectionChange: vi.fn(() => ({ dispose: vi.fn() })),
      attachCustomKeyEventHandler: vi.fn((handler: (ev: KeyboardEvent) => boolean) => {
        handlerRefs.push(handler);
      }),
      write: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      getSelection: vi.fn(() => 'selected-text'),
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
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = MockWebSocket.OPEN;
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
  handlerRefs.length = 0;
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  useSettingsStore.setState({ fontSize: DEFAULT_FONT_SIZE } as any);
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

function pressKey(opts: Partial<KeyboardEventInit> & { key: string; type?: string }): boolean {
  const ev = new KeyboardEvent(opts.type ?? 'keydown', {
    ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...opts,
  });
  // The most recently registered handler is the active one.
  const h = handlerRefs.at(-1);
  if (!h) throw new Error('no key handler registered');
  return h(ev);
}

describe('XtermView keyboard shortcuts', () => {
  beforeEach(() => {
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
  });

  it('Ctrl+= increases font size', () => {
    const result = pressKey({ key: '=', ctrlKey: true });
    expect(useSettingsStore.getState().fontSize).toBe(DEFAULT_FONT_SIZE + 1);
    expect(result).toBe(false); // suppress xterm default
  });

  it('Ctrl++ also increases font size (alias)', () => {
    pressKey({ key: '+', ctrlKey: true });
    expect(useSettingsStore.getState().fontSize).toBe(DEFAULT_FONT_SIZE + 1);
  });

  it('Ctrl+- decreases font size', () => {
    pressKey({ key: '-', ctrlKey: true });
    expect(useSettingsStore.getState().fontSize).toBe(DEFAULT_FONT_SIZE - 1);
  });

  it('Ctrl+0 resets to DEFAULT_FONT_SIZE', () => {
    useSettingsStore.setState({ fontSize: 18 } as any);
    pressKey({ key: '0', ctrlKey: true });
    expect(useSettingsStore.getState().fontSize).toBe(DEFAULT_FONT_SIZE);
  });

  it('Ctrl+= at MAX_FONT_SIZE is a no-op (still suppressed)', () => {
    useSettingsStore.setState({ fontSize: MAX_FONT_SIZE } as any);
    const result = pressKey({ key: '=', ctrlKey: true });
    expect(useSettingsStore.getState().fontSize).toBe(MAX_FONT_SIZE);
    expect(result).toBe(false);
  });

  it('Ctrl+- at MIN_FONT_SIZE is a no-op', () => {
    useSettingsStore.setState({ fontSize: MIN_FONT_SIZE } as any);
    pressKey({ key: '-', ctrlKey: true });
    expect(useSettingsStore.getState().fontSize).toBe(MIN_FONT_SIZE);
  });

  it('Ctrl+Shift+C copies selection to clipboard and is suppressed', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, writable: true, value: { writeText, readText: async () => '' },
    });
    const result = pressKey({ key: 'C', ctrlKey: true, shiftKey: true });
    expect(result).toBe(false);
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('selected-text');
  });

  it('Ctrl+Shift+V reads clipboard and sends as input', async () => {
    const readText = vi.fn(async () => 'pasted');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, writable: true, value: { writeText: vi.fn(), readText },
    });
    const result = pressKey({ key: 'V', ctrlKey: true, shiftKey: true });
    expect(result).toBe(false);
    // Allow microtask queue to flush
    await Promise.resolve();
    await Promise.resolve();
    expect(readText).toHaveBeenCalled();
    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(expect.stringContaining('"type":"input"'));
    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(expect.stringContaining('pasted'));
  });

  it('Plain Ctrl+C is allowed through (SIGINT)', () => {
    const result = pressKey({ key: 'c', ctrlKey: true, shiftKey: false });
    expect(result).toBe(true);
  });

  it('Plain typing key returns true', () => {
    const result = pressKey({ key: 'a' });
    expect(result).toBe(true);
  });
});
