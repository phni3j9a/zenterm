import type { TmuxEvent } from '@zenterm/shared';
import { createReconnectBackoff, type ReconnectBackoff } from '@/lib/reconnectBackoff';
import { parseEvent } from './parseEvent';
import type { EventsStatus } from '@/stores/events';

export interface TmuxEventsClientOptions {
  url: string;
  onEvent: (event: TmuxEvent) => void;
  onStatusChange: (status: EventsStatus, attempt: number) => void;
}

export class TmuxEventsClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private backoff: ReconnectBackoff = createReconnectBackoff();
  private stopped = false;

  constructor(private readonly options: TmuxEventsClientOptions) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close(1000);
      this.socket = null;
    }
  }

  triggerReconnect(): void {
    this.backoff.reset();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close(1000);
      this.socket = null;
    }
    if (!this.stopped) this.connect();
  }

  private connect(): void {
    if (this.stopped) return;
    this.options.onStatusChange('connecting', 0);
    const ws = new WebSocket(this.options.url);
    this.socket = ws;

    ws.onopen = () => {
      if (this.stopped) return;
      this.backoff.reset();
      this.options.onStatusChange('connected', 0);
    };

    ws.onmessage = (ev) => {
      if (this.stopped) return;
      const raw = typeof ev.data === 'string' ? ev.data : '';
      const event = parseEvent(raw);
      if (event) this.options.onEvent(event);
    };

    ws.onclose = (ev) => {
      this.socket = null;
      if (this.stopped) return;
      if (ev.code === 1000 || ev.code === 1008) {
        this.options.onStatusChange('idle', 0);
        return;
      }
      const step = this.backoff.next();
      if (step.exhausted) {
        this.options.onStatusChange('failed', step.attempt);
        return;
      }
      this.options.onStatusChange('reconnecting', step.attempt);
      this.reconnectTimer = window.setTimeout(() => this.connect(), step.delayMs);
    };

    ws.onerror = () => {
      // close ハンドラで実際の reconnect を行うので、ここでは何もしない。
    };
  }
}
