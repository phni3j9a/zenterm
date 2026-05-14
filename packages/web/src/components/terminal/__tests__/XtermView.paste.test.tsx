import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('@xterm/xterm', () => {
  const Terminal = vi.fn().mockImplementation(function () {
    return {
      loadAddon: vi.fn(),
      open: vi.fn(),
      write: vi.fn(),
      options: {},
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onResize: vi.fn(() => ({ dispose: vi.fn() })),
      onSelectionChange: vi.fn(() => ({ dispose: vi.fn() })),
      onBell: vi.fn(() => ({ dispose: vi.fn() })),
      focus: vi.fn(),
      getSelection: vi.fn(() => ''),
      clear: vi.fn(),
      dispose: vi.fn(),
      attachCustomKeyEventHandler: vi.fn(),
      refresh: vi.fn(),
      reset: vi.fn(),
      cols: 80,
      rows: 24,
      unicode: { activeVersion: '6' },
    };
  });
  return { Terminal };
});
vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn().mockImplementation(function () { return { fit: vi.fn() }; }) }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: vi.fn().mockImplementation(function () { return {}; }) }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: vi.fn().mockImplementation(function () { return {}; }) }));
vi.mock('@xterm/addon-search', () => ({
  SearchAddon: vi.fn().mockImplementation(function () { return { findNext: vi.fn(), findPrevious: vi.fn(), clearDecorations: vi.fn() }; }),
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({ default: '' }));

import { Terminal } from '@xterm/xterm';
import { XtermView } from '../XtermView';

function lastHandler() {
  const calls = (Terminal as unknown as ReturnType<typeof vi.fn>).mock.results;
  const inst = calls[calls.length - 1].value;
  return (inst.attachCustomKeyEventHandler as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: KeyboardEvent) => boolean;
}

const baseProps = {
  gatewayUrl: 'http://gw',
  token: 'tok',
  sessionId: 'sess',
  windowIndex: 0,
  isFocused: true,
  isVisible: true,
  reconnectNonce: 0,
  onStatusChange: vi.fn(),
};

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close() { this.readyState = MockWebSocket.CLOSED; }
  constructor(_url: string) {}
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('XtermView paste extension', () => {
  it('calls onPasteImages when clipboard has an image item', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' });
    const item = {
      types: ['image/png'],
      getType: vi.fn(async (t: string) => (t === 'image/png' ? blob : new Blob())),
    } as unknown as ClipboardItem;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: vi.fn().mockResolvedValue([item]), readText: vi.fn().mockResolvedValue('') },
    });
    const onPasteImages = vi.fn();
    render(<XtermView {...baseProps} onPasteImages={onPasteImages} />);
    const ev = new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true });
    const result = lastHandler()(ev);
    expect(result).toBe(false);
    await waitFor(() => expect(onPasteImages).toHaveBeenCalled());
    const files: File[] = onPasteImages.mock.calls[0][0];
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe('image/png');
    expect(files[0].name).toMatch(/^image_\d+_0\.png$/);
  });

  it('falls back to text paste when clipboard has no image', async () => {
    const item = {
      types: ['text/plain'],
      getType: vi.fn(async () => new Blob(['hi'], { type: 'text/plain' })),
    } as unknown as ClipboardItem;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: vi.fn().mockResolvedValue([item]), readText: vi.fn().mockResolvedValue('hello') },
    });
    const onPasteImages = vi.fn();
    render(<XtermView {...baseProps} onPasteImages={onPasteImages} />);
    const ev = new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true });
    lastHandler()(ev);
    await waitFor(() => expect(navigator.clipboard.readText).toHaveBeenCalled());
    expect(onPasteImages).not.toHaveBeenCalled();
  });

  it('falls back to text paste when clipboard.read rejects with NotAllowedError', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: vi.fn().mockRejectedValue(err), readText: vi.fn().mockResolvedValue('text-fallback') },
    });
    const onPasteImages = vi.fn();
    render(<XtermView {...baseProps} onPasteImages={onPasteImages} />);
    const ev = new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true });
    lastHandler()(ev);
    await waitFor(() => expect(navigator.clipboard.readText).toHaveBeenCalled());
  });

  it('also handles Cmd+Shift+V on macOS', async () => {
    const blob = new Blob([new Uint8Array([0xff])], { type: 'image/jpeg' });
    const item = {
      types: ['image/jpeg'],
      getType: vi.fn(async () => blob),
    } as unknown as ClipboardItem;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: vi.fn().mockResolvedValue([item]), readText: vi.fn().mockResolvedValue('') },
    });
    const onPasteImages = vi.fn();
    render(<XtermView {...baseProps} onPasteImages={onPasteImages} />);
    const ev = new KeyboardEvent('keydown', { key: 'V', metaKey: true, shiftKey: true });
    const result = lastHandler()(ev);
    expect(result).toBe(false);
    await waitFor(() => expect(onPasteImages).toHaveBeenCalled());
  });
});
