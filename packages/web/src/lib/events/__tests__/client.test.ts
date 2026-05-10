import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TmuxEventsClient } from '../client';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  closeMock = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  close(_code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.closeMock(_code);
    this.onclose?.({ code: _code ?? 1000 });
  }
  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
  triggerMessage(data: string) {
    this.onmessage?.({ data });
  }
  triggerClose(code: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code });
  }
}

describe('TmuxEventsClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens WebSocket and reports connecting → connected', () => {
    const onStatusChange = vi.fn();
    const onEvent = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent,
      onStatusChange,
    });
    client.start();
    expect(onStatusChange).toHaveBeenCalledWith('connecting', 0);
    MockWebSocket.instances[0].triggerOpen();
    expect(onStatusChange).toHaveBeenCalledWith('connected', 0);
  });

  it('parses incoming messages and forwards via onEvent', () => {
    const onEvent = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent,
      onStatusChange: vi.fn(),
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerMessage('{"type":"sessions-changed"}');
    expect(onEvent).toHaveBeenCalledWith({ type: 'sessions-changed' });
  });

  it('ignores unparsable messages', () => {
    const onEvent = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent,
      onStatusChange: vi.fn(),
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerMessage('garbage');
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('reconnects on abnormal close (1006) with backoff', () => {
    const onStatusChange = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent: vi.fn(),
      onStatusChange,
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerClose(1006);
    expect(onStatusChange).toHaveBeenCalledWith('reconnecting', 1);
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('does NOT reconnect on 1000 (normal close)', () => {
    const onStatusChange = vi.fn();
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent: vi.fn(),
      onStatusChange,
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerClose(1000);
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('does NOT reconnect on 1008 (auth fail)', () => {
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent: vi.fn(),
      onStatusChange: vi.fn(),
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerClose(1008);
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('stop() closes socket with 1000 and prevents reconnect', () => {
    const client = new TmuxEventsClient({
      url: 'ws://test/ws/events?token=x',
      onEvent: vi.fn(),
      onStatusChange: vi.fn(),
    });
    client.start();
    MockWebSocket.instances[0].triggerOpen();
    client.stop();
    expect(MockWebSocket.instances[0].closeMock).toHaveBeenCalledWith(1000);
  });
});
