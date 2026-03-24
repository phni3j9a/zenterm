import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { getWebSocketUrl } from '../api/client';
import { useSettingsStore } from '../stores/settings';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseTerminalOptions {
  sessionId: string;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function useTerminal({ sessionId, onStatusChange }: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const themeMode = useSettingsStore((s) => s.themeMode);

  const getTheme = useCallback(() => {
    if (themeMode === 'dark') {
      return {
        background: '#1B1A17',
        foreground: '#DBD6C8',
        cursor: '#94A687',
        cursorAccent: '#1B1A17',
        selectionBackground: 'rgba(148, 166, 135, 0.25)',
      };
    }
    return {
      background: '#F5F4F0',
      foreground: '#2A2721',
      cursor: '#7B8B6F',
      cursorAccent: '#F5F4F0',
      selectionBackground: 'rgba(123, 139, 111, 0.18)',
    };
  }, [themeMode]);

  const attach = useCallback((container: HTMLDivElement) => {
    containerRef.current = container;

    const term = new Terminal({
      allowProposedApi: true,
      fontSize,
      fontFamily: "'Menlo', 'Consolas', 'Liberation Mono', monospace",
      theme: getTheme(),
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      convertEol: true,
    });

    const fit = new FitAddon();
    const unicode = new Unicode11Addon();
    term.loadAddon(fit);
    term.loadAddon(unicode);
    term.unicode.activeVersion = '11';

    term.open(container);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // WebSocket connection
    onStatusChange?.('connecting');
    const url = getWebSocketUrl(sessionId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      onStatusChange?.('connected');
      // Send initial resize
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'output':
            term.write(msg.data);
            break;
          case 'exit':
            onStatusChange?.('disconnected');
            break;
          case 'error':
            onStatusChange?.('error');
            break;
        }
      } catch {
        // raw data fallback
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      onStatusChange?.('disconnected');
    };

    ws.onerror = () => {
      onStatusChange?.('error');
    };

    // Terminal input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Resize handling
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, [sessionId, fontSize, getTheme, onStatusChange]);

  // Update theme on change
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getTheme();
    }
  }, [getTheme]);

  // Update font size on change
  useEffect(() => {
    if (termRef.current && fitRef.current) {
      termRef.current.options.fontSize = fontSize;
      fitRef.current.fit();
    }
  }, [fontSize]);

  const focus = useCallback(() => {
    termRef.current?.focus();
  }, []);

  return { attach, focus, termRef, wsRef };
}
