import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { FitAddon as FitAddonType } from '@xterm/addon-fit';
import type { SearchAddon as SearchAddonType } from '@xterm/addon-search';
import type { Terminal as TerminalType, ITerminalOptions } from '@xterm/xterm';
import { getWebSocketUrl } from '../api/client';
import { useSettingsStore } from '../stores/settings';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

interface UseTerminalOptions {
  sessionId: string;
  onStatusChange?: (status: ConnectionStatus, message?: string) => void;
  onOutput?: (data: string) => void;
}

interface TerminalSocketMessage {
  type?: string;
  data?: string;
  message?: string;
}

interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
}

interface XtermModules {
  Terminal: typeof import('@xterm/xterm').Terminal;
  FitAddon: typeof import('@xterm/addon-fit').FitAddon;
  Unicode11Addon: typeof import('@xterm/addon-unicode11').Unicode11Addon;
  SearchAddon: typeof import('@xterm/addon-search').SearchAddon;
}

interface TerminalBindings {
  term: TerminalType;
  fit: FitAddonType;
  search: SearchAddonType;
}

interface RuntimeState {
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  intentionalClose: boolean;
  imeLastData: string;
  imeLastTime: number;
}

interface SessionOptions {
  container: HTMLDivElement;
  sessionId: string;
  modules: XtermModules;
  fontSize: number;
  fontFamily: string;
  getTheme: () => TerminalTheme;
  onStatusChange?: (status: ConnectionStatus, message?: string) => void;
  onOutput?: (data: string) => void;
  termRef: MutableRefObject<TerminalType | null>;
  fitRef: MutableRefObject<FitAddonType | null>;
  searchRef: MutableRefObject<SearchAddonType | null>;
  wsRef: MutableRefObject<WebSocket | null>;
}

const IME_DEDUP_MS = 100;
const MAX_RECONNECT = 5;

function getReconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 16000);
}

function sendSocketMessage(ws: WebSocket | null, payload: object): void {
  if (ws?.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function createTerminalOptions(fontSize: number, fontFamily: string, theme: TerminalTheme): ITerminalOptions {
  return {
    allowProposedApi: true,
    fontSize,
    fontFamily,
    theme,
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10000,
    convertEol: true,
  };
}

function createTerminalBindings(
  container: HTMLDivElement,
  modules: XtermModules,
  fontSize: number,
  fontFamily: string,
  getTheme: () => TerminalTheme,
): TerminalBindings {
  const term = new modules.Terminal(createTerminalOptions(fontSize, fontFamily, getTheme()));
  const fit = new modules.FitAddon();
  const unicode = new modules.Unicode11Addon();
  const search = new modules.SearchAddon();
  term.loadAddon(fit);
  term.loadAddon(unicode);
  term.loadAddon(search);
  term.unicode.activeVersion = '11';
  term.open(container);
  fit.fit();
  return { term, fit, search };
}

function createRuntimeState(): RuntimeState {
  return {
    reconnectAttempt: 0,
    reconnectTimer: null,
    intentionalClose: false,
    imeLastData: '',
    imeLastTime: 0,
  };
}

function getReconnectMessage(attempt: number): string | undefined {
  if (attempt <= 0) return undefined;
  return `Reconnecting... (${attempt}/${MAX_RECONNECT})`;
}

function handleMessage(
  event: MessageEvent<string>,
  term: TerminalType,
  state: RuntimeState,
  onStatusChange?: (status: ConnectionStatus, message?: string) => void,
  onOutput?: (data: string) => void,
): void {
  try {
    const msg = JSON.parse(event.data) as TerminalSocketMessage;
    if (msg.type === 'output') {
      term.write(msg.data ?? '');
      onOutput?.(msg.data ?? '');
      return;
    }
    if (msg.type === 'exit') {
      state.intentionalClose = true;
      onStatusChange?.('disconnected', msg.message ?? 'Session ended');
      return;
    }
    if (msg.type === 'error') onStatusChange?.('error', msg.message ?? 'Connection error');
  } catch {
    term.write(event.data);
  }
}

function scheduleReconnect(
  state: RuntimeState,
  onStatusChange: UseTerminalOptions['onStatusChange'],
  reconnect: () => void,
): void {
  if (state.reconnectAttempt >= MAX_RECONNECT) {
    onStatusChange?.('error', 'Connection lost. Max reconnect attempts reached.');
    return;
  }
  state.reconnectAttempt += 1;
  onStatusChange?.('reconnecting', getReconnectMessage(state.reconnectAttempt));
  state.reconnectTimer = setTimeout(reconnect, getReconnectDelay(state.reconnectAttempt));
}

function handleSocketOpen(
  ws: WebSocket,
  sessionId: string,
  term: TerminalType,
  state: RuntimeState,
  onStatusChange?: (status: ConnectionStatus, message?: string) => void,
): void {
  state.reconnectAttempt = 0;
  onStatusChange?.('connected');
  sendSocketMessage(ws, { type: 'resize', cols: term.cols, rows: term.rows });
  // SSH quick connect: send stored command if present
  const sshKey = `zenterm_ssh_cmd_${sessionId}`;
  const sshCmd = sessionStorage.getItem(sshKey);
  if (sshCmd) {
    sessionStorage.removeItem(sshKey);
    setTimeout(() => sendSocketMessage(ws, { type: 'input', data: sshCmd }), 300);
  }
}

function handleSocketClose(
  ws: WebSocket,
  wsRef: MutableRefObject<WebSocket | null>,
  state: RuntimeState,
  onStatusChange: UseTerminalOptions['onStatusChange'],
  reconnect: () => void,
): void {
  if (wsRef.current === ws) wsRef.current = null;
  if (state.intentionalClose) return;
  scheduleReconnect(state, onStatusChange, reconnect);
}

function connectSocket(
  sessionId: string,
  term: TerminalType,
  wsRef: MutableRefObject<WebSocket | null>,
  state: RuntimeState,
  onStatusChange: UseTerminalOptions['onStatusChange'],
  onOutput: UseTerminalOptions['onOutput'],
  reconnect: () => void,
): void {
  state.reconnectTimer = null;
  const status = state.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
  onStatusChange?.(status, getReconnectMessage(state.reconnectAttempt));
  const ws = new WebSocket(getWebSocketUrl(sessionId));
  wsRef.current = ws;
  ws.onopen = () => handleSocketOpen(ws, sessionId, term, state, onStatusChange);
  ws.onmessage = (event) => handleMessage(event, term, state, onStatusChange, onOutput);
  ws.onclose = () => handleSocketClose(ws, wsRef, state, onStatusChange, reconnect);
  ws.onerror = () => undefined;
}

function shouldSkipImeData(data: string, state: RuntimeState, now: number): boolean {
  return data.length > 1
    && data.charCodeAt(0) > 0x1f
    && data === state.imeLastData
    && (now - state.imeLastTime) < IME_DEDUP_MS;
}

function bindTerminalEvents(
  term: TerminalType,
  wsRef: MutableRefObject<WebSocket | null>,
  state: RuntimeState,
  container: HTMLDivElement,
): void {
  term.onData((data) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (shouldSkipImeData(data, state, now)) return;
    state.imeLastData = data;
    state.imeLastTime = now;
    sendSocketMessage(ws, { type: 'input', data });
  });
  term.onResize(({ cols, rows }) => {
    sendSocketMessage(wsRef.current, { type: 'resize', cols, rows });
  });

  // Auto-copy on selection (opt-in via settings)
  term.onSelectionChange(() => {
    const selection = term.getSelection();
    if (!selection) return;
    try {
      const settings = JSON.parse(localStorage.getItem('zenterm_settings') ?? '{}');
      if (settings.autoCopyOnSelect) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    } catch { /* ignore */ }
  });

  // Right-click paste
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    navigator.clipboard.readText().then((text) => {
      if (text) {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          sendSocketMessage(ws, { type: 'input', data: text });
        }
      }
    }).catch(() => {});
  });
}

function observeTerminalResize(container: HTMLDivElement, fit: FitAddonType): ResizeObserver {
  const resizeObserver = new ResizeObserver(() => {
    fit.fit();
  });
  resizeObserver.observe(container);
  return resizeObserver;
}

function cleanupSession(
  state: RuntimeState,
  resizeObserver: ResizeObserver,
  wsRef: MutableRefObject<WebSocket | null>,
  term: TerminalType,
  termRef: MutableRefObject<TerminalType | null>,
  fitRef: MutableRefObject<FitAddonType | null>,
  searchRef: MutableRefObject<SearchAddonType | null>,
): void {
  state.intentionalClose = true;
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  resizeObserver.disconnect();
  wsRef.current?.close();
  term.dispose();
  termRef.current = null;
  fitRef.current = null;
  searchRef.current = null;
  wsRef.current = null;
}

function createSession(options: SessionOptions): () => void {
  const { container, sessionId, modules, fontSize, fontFamily, getTheme, onStatusChange, onOutput, termRef, fitRef, searchRef, wsRef } = options;
  const state = createRuntimeState();
  const { term, fit, search } = createTerminalBindings(container, modules, fontSize, fontFamily, getTheme);
  termRef.current = term;
  fitRef.current = fit;
  searchRef.current = search;
  bindTerminalEvents(term, wsRef, state, container);
  const connect = () => connectSocket(sessionId, term, wsRef, state, onStatusChange, onOutput, connect);
  connect();
  const resizeObserver = observeTerminalResize(container, fit);
  return () => cleanupSession(state, resizeObserver, wsRef, term, termRef, fitRef, searchRef);
}

export function useTerminal({ sessionId, onStatusChange, onOutput }: UseTerminalOptions) {
  const termRef = useRef<TerminalType | null>(null);
  const fitRef = useRef<FitAddonType | null>(null);
  const searchRef = useRef<SearchAddonType | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermLoaded = useRef(false);
  const xtermModulesRef = useRef<XtermModules | null>(null);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const themeMode = useSettingsStore((s) => s.themeMode);

  const getTheme = useCallback(() => {
    const style = getComputedStyle(document.documentElement);
    const get = (name: string) => style.getPropertyValue(name).trim();
    return {
      background: get('--term-bg'),
      foreground: get('--term-fg'),
      cursor: get('--term-cursor'),
      cursorAccent: get('--term-cursor-accent'),
      selectionBackground: get('--term-selection'),
    };
  }, [themeMode]);

  const loadXtermModules = useCallback(async (): Promise<XtermModules> => {
    if (xtermLoaded.current && xtermModulesRef.current) return xtermModulesRef.current;
    const [{ Terminal }, { FitAddon }, { Unicode11Addon }, { SearchAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-unicode11'),
      import('@xterm/addon-search'),
    ]);
    const modules = { Terminal, FitAddon, Unicode11Addon, SearchAddon };
    xtermModulesRef.current = modules;
    xtermLoaded.current = true;
    return modules;
  }, []);

  const attach = useCallback((container: HTMLDivElement) => {
    containerRef.current = container;
    onStatusChange?.('connecting');
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const init = async () => {
      const modules = await loadXtermModules();
      if (cancelled) return;
      cleanup = createSession({
        container,
        sessionId,
        modules,
        fontSize,
        fontFamily,
        getTheme,
        onStatusChange,
        onOutput,
        termRef,
        fitRef,
        searchRef,
        wsRef,
      });
    };

    init().catch(() => {
      if (cancelled) return;
      onStatusChange?.('error', 'Failed to load terminal');
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [fontSize, fontFamily, getTheme, loadXtermModules, onStatusChange, onOutput, sessionId]);

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

  // Update font family on change
  useEffect(() => {
    if (termRef.current && fitRef.current) {
      termRef.current.options.fontFamily = fontFamily;
      fitRef.current.fit();
    }
  }, [fontFamily]);

  const focus = useCallback(() => {
    termRef.current?.focus();
  }, []);

  return { attach, focus, termRef, searchRef, wsRef };
}
