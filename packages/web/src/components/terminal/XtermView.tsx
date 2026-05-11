import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { terminalColorsDark, terminalColorsLight } from '@/theme/terminalColors';
import { FONT_FAMILY_MONO } from '@/theme/tokens';
import { useTheme } from '@/theme';
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettingsStore,
} from '@/stores/settings';
import { createImeDedup } from '@/lib/imeDedup';
import {
  createReconnectBackoff,
  type BackoffStep,
} from '@/lib/reconnectBackoff';
import {
  buildTerminalWsUrl,
  encodeInput,
  encodeResize,
  parseServerMessage,
} from '@/lib/terminalProtocol';

export type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface ReconnectInfo {
  attempt: number;
  etaMs: number;
  exhausted: boolean;
}

export interface XtermViewProps {
  gatewayUrl: string;
  token: string;
  sessionId: string;
  windowIndex: number;
  isFocused: boolean;
  isVisible: boolean;
  reconnectNonce: number;
  onStatusChange: (status: TerminalStatus) => void;
  onReconnectInfo?: (info: ReconnectInfo | null) => void;
}

export function XtermView({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  isFocused,
  isVisible,
  reconnectNonce,
  onStatusChange,
  onReconnectInfo,
}: XtermViewProps) {
  const { resolvedTheme } = useTheme();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const onStatusChangeRef = useRef(onStatusChange);
  const onReconnectInfoRef = useRef(onReconnectInfo);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    onReconnectInfoRef.current = onReconnectInfo;
  }, [onReconnectInfo]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(createReconnectBackoff());
  const dedupRef = useRef(createImeDedup());
  const reconnectTimerRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);
  const isVisibleRef = useRef(isVisible);
  const lastSentSizeRef = useRef<{ cols: number; rows: number } | null>(null);

  // Keep ref in sync so ResizeObserver callback can early-return.
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Create xterm once on mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = resolvedTheme === 'light' ? terminalColorsLight : terminalColorsDark;
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

  // Apply theme/fontSize updates.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = resolvedTheme === 'light' ? terminalColorsLight : terminalColorsDark;
    term.options.fontSize = fontSize;
    if (isVisibleRef.current) {
      fitRef.current?.fit();
    }
  }, [resolvedTheme, fontSize]);

  // Apply focus.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.disableStdin = !isFocused;
    if (isFocused && isVisibleRef.current) term.focus();
  }, [isFocused]);

  // Keyboard shortcuts (intercepted before xterm processes them).
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    type KeyHandler = (ev: KeyboardEvent) => boolean;
    const handler: KeyHandler = (ev) => {
      if (ev.type !== 'keydown') return true;

      // Ctrl+Shift+C — copy selection
      if (ev.ctrlKey && ev.shiftKey && (ev.key === 'C' || ev.key === 'c')) {
        const sel = term.getSelection();
        if (sel && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(sel).catch(() => undefined);
        }
        return false;
      }

      // Ctrl+Shift+V — paste from clipboard
      if (ev.ctrlKey && ev.shiftKey && (ev.key === 'V' || ev.key === 'v')) {
        if (navigator.clipboard?.readText) {
          void navigator.clipboard.readText().then((text) => {
            if (!text) return;
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(encodeInput(text));
            }
          }).catch(() => undefined);
        }
        return false;
      }

      // Ctrl+= / Ctrl++ — zoom in
      if (ev.ctrlKey && !ev.shiftKey && (ev.key === '=' || ev.key === '+')) {
        const cur = useSettingsStore.getState().fontSize;
        if (cur < MAX_FONT_SIZE) {
          useSettingsStore.getState().setFontSize(cur + 1);
        }
        return false;
      }

      // Ctrl+- — zoom out
      if (ev.ctrlKey && !ev.shiftKey && ev.key === '-') {
        const cur = useSettingsStore.getState().fontSize;
        if (cur > MIN_FONT_SIZE) {
          useSettingsStore.getState().setFontSize(cur - 1);
        }
        return false;
      }

      // Ctrl+0 — reset
      if (ev.ctrlKey && !ev.shiftKey && ev.key === '0') {
        useSettingsStore.getState().setFontSize(DEFAULT_FONT_SIZE);
        return false;
      }

      return true;
    };
    term.attachCustomKeyEventHandler(handler);
    return () => {
      // xterm has no formal "detach" — re-attach a passthrough on cleanup.
      try {
        term.attachCustomKeyEventHandler(() => true);
      } catch {
        /* noop */
      }
    };
  }, []);

  // Reveal hook: when isVisible flips false → true, fit + focus + maybe send resize.
  useEffect(() => {
    if (!isVisible) return;
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;
    const raf = window.requestAnimationFrame(() => {
      fit.fit();
      term.refresh(0, term.rows - 1);
      if (isFocused) term.focus();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Always send a resize on reveal — the actual layout dimensions may
        // have changed while hidden (display:none reports stale cols/rows
        // until refresh + fit). Diff-guarding caused the visibility test to
        // miss a reveal-time resize because the mocked size never changes.
        ws.send(encodeResize(term.cols, term.rows));
        lastSentSizeRef.current = { cols: term.cols, rows: term.rows };
      }
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isVisible, isFocused]);

  // WebSocket connect & reconnect (depends on identity + reconnectNonce).
  useEffect(() => {
    isUnmountedRef.current = false;
    backoffRef.current.reset();
    onReconnectInfoRef.current?.(null);

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
        onReconnectInfoRef.current?.(null);
        term.reset();
        if (isVisibleRef.current) fitRef.current?.fit();
        ws.send(encodeResize(term.cols, term.rows));
        lastSentSizeRef.current = { cols: term.cols, rows: term.rows };
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
          onReconnectInfoRef.current?.(null);
          return;
        }
        const step: BackoffStep = backoffRef.current.next();
        if (step.exhausted) {
          onStatusChangeRef.current('error');
          onReconnectInfoRef.current?.({
            attempt: step.attempt,
            etaMs: 0,
            exhausted: true,
          });
          return;
        }
        onStatusChangeRef.current('reconnecting');
        onReconnectInfoRef.current?.({
          attempt: step.attempt,
          etaMs: step.delayMs,
          exhausted: false,
        });
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
  }, [gatewayUrl, token, sessionId, windowIndex, reconnectNonce]);

  // ResizeObserver → fit + send resize (skip while hidden).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (!isVisibleRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const fit = fitRef.current;
        const term = termRef.current;
        const ws = wsRef.current;
        if (!fit || !term) return;
        fit.fit();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(encodeResize(term.cols, term.rows));
          lastSentSizeRef.current = { cols: term.cols, rows: term.rows };
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
        background:
          resolvedTheme === 'light' ? terminalColorsLight.background : terminalColorsDark.background,
      }}
    />
  );
}
