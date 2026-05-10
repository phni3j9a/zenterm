import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { terminalColorsDark, terminalColorsLight } from '@/theme/terminalColors';
import { FONT_FAMILY_MONO } from '@/theme/tokens';
import { createImeDedup } from '@/lib/imeDedup';
import { createReconnectBackoff } from '@/lib/reconnectBackoff';
import {
  buildTerminalWsUrl,
  encodeInput,
  encodeResize,
  parseServerMessage,
} from '@/lib/terminalProtocol';

export type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface XtermViewProps {
  gatewayUrl: string;
  token: string;
  sessionId: string;
  windowIndex: number;
  isFocused: boolean;
  theme: 'dark' | 'light';
  fontSize: number;
  onStatusChange: (status: TerminalStatus) => void;
}

export function XtermView({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  isFocused,
  theme,
  fontSize,
  onStatusChange,
}: XtermViewProps) {
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(createReconnectBackoff());
  const dedupRef = useRef(createImeDedup());
  const reconnectTimerRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);

  // Create xterm once on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = theme === 'light' ? terminalColorsLight : terminalColorsDark;
    const term = new Terminal({
      allowProposedApi: true,
      fontFamily: FONT_FAMILY_MONO,
      fontSize,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      theme: palette,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = '11';
    term.loadAddon(new WebLinksAddon());

    term.open(container);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    return () => {
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme/fontSize updates
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = theme === 'light' ? terminalColorsLight : terminalColorsDark;
    term.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [theme, fontSize]);

  // Apply focus
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.disableStdin = !isFocused;
    if (isFocused) term.focus();
  }, [isFocused]);

  // WebSocket connect & reconnect
  useEffect(() => {
    isUnmountedRef.current = false;
    backoffRef.current.reset();

    const connect = () => {
      if (isUnmountedRef.current) return;
      const term = termRef.current;
      if (!term) return;

      const url = buildTerminalWsUrl(gatewayUrl, sessionId, windowIndex, token);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      onStatusChangeRef.current('disconnected');

      ws.onopen = () => {
        backoffRef.current.reset();
        term.reset();
        fitRef.current?.fit();
        ws.send(encodeResize(term.cols, term.rows));
        onStatusChangeRef.current('connected');
      };

      ws.onmessage = (ev) => {
        const msg = parseServerMessage(typeof ev.data === 'string' ? ev.data : '');
        if (!msg) return;
        if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'error') {
          onStatusChangeRef.current('error');
        }
      };

      ws.onclose = (ev) => {
        wsRef.current = null;
        if (ev.code === 1000 || ev.code === 1008) {
          onStatusChangeRef.current('disconnected');
          return;
        }
        const step = backoffRef.current.next();
        if (step.exhausted) {
          onStatusChangeRef.current('error');
          return;
        }
        onStatusChangeRef.current('reconnecting');
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, step.delayMs);
      };

      ws.onerror = () => onStatusChangeRef.current('error');
    };

    connect();

    const term = termRef.current;
    const onDataDisposable = term?.onData((data) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      if (!dedupRef.current.shouldPass(data, now)) return;
      ws.send(encodeInput(data));
    });

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      onDataDisposable?.dispose();
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null;
        ws.close(1000);
        wsRef.current = null;
      }
    };
  }, [gatewayUrl, token, sessionId, windowIndex]);

  // ResizeObserver → fit + send resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const fit = fitRef.current;
        const term = termRef.current;
        const ws = wsRef.current;
        if (!fit || !term) return;
        fit.fit();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(encodeResize(term.cols, term.rows));
        }
      });
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: theme === 'light' ? terminalColorsLight.background : terminalColorsDark.background,
      }}
    />
  );
}
