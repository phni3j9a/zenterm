# ZenTerm PC Web Phase 2d (TerminalPane mount 永続化 + Terminal UX 改善) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 2c で deferred になっていた "TerminalPane 完全マウント保持" を回収し、Files タブを往復しても xterm の scrollback と WebSocket が保持される構造に改修する。あわせて、ヘッダーへの displayName + window 名 + sessionId copy ボタン + フォントズーム UI、接続状態 badge と手動 Reconnect ボタン、右クリックメニュー (Copy / Paste / Clear / Reconnect)、選択時自動コピー (opt-in)、Ctrl+Shift+C / Ctrl+Shift+V / Ctrl+= / Ctrl+- / Ctrl+0 のキーボードショートカットを追加する。

**Architecture:** `AuthenticatedShell` の右ペインを **Files route 時も TerminalPane を unmount しない** ように改修し、`<TerminalPane isVisible={!isFilesRoute}>` と `{isFilesRoute && <FilesViewerPane>}` を sibling で並列配置する。`XtermView` には `isVisible: boolean` / `reconnectNonce: number` / `onReconnectInfo` の 3 props を追加し、display:none 中は ResizeObserver / fit を抑制、表示復帰時に rAF で 1 回 fit + cols/rows 差分 resize 送信 + focus を実施。WS は `isVisible` に関係なく接続維持。`reconnectNonce` 変化で WS 再接続を強制 (effect deps に追加)。`TerminalPane` 内部に inline で書かれていたヘッダーは新 `TerminalHeader` コンポーネントに切り出し、`useSessionsStore` を購読して displayName + window 名を表示。フォントズームは Settings store の既存 `fontSize` を駆動 (ヘッダー −/+ ボタン + xterm `attachCustomKeyEventHandler`)。Copy / Paste は `navigator.clipboard` + `term.getSelection()` + `encodeInput()`。右クリックメニューは `position: fixed` の小さい新 `TerminalContextMenu` コンポーネント。Settings store には `autoCopyOnSelect: boolean` を追加し persist version を 1 → 2 に上げる (migrate で `false` 補完)。

**Tech Stack:** TypeScript 5.7 strict (`noUnusedParameters: true`) / React 19 / Vite 6 / zustand 5 / react-router 7 / vitest 4 / @testing-library/react / Playwright / xterm.js 6 (既存)。新規 npm 依存ゼロ。

**Spec:** `docs/superpowers/specs/2026-05-11-pc-web-phase-2d-design.md`

**Pre-existing facts (Phase 2c 完了時点):**

- `packages/web/src/components/AuthenticatedShell.tsx`: `isFilesRoute` 判定で `<FilesViewerPane>` か `<TerminalPane>` のどちらか一方のみ mount する 3 項演算子構造 (line 213-222)。Phase 2d で「TerminalPane を常時 mount + Files は sibling で重ねる」構造へ書き換え対象
- `packages/web/src/components/TerminalPane.tsx`: status state を持ち、ヘッダーは inline (line 63-90)。root は `display: 'grid'` + `gridTemplateRows: '48px 1fr'`。Phase 2d で `isVisible` prop を受けて `display: isVisible ? 'grid' : 'none'` を適用。ヘッダーは `TerminalHeader` に切り出し
- `packages/web/src/components/terminal/XtermView.tsx`: 1 component に xterm 生成 / theme / focus / WS / ResizeObserver の 5 effect。Phase 2d で `isVisible` / `reconnectNonce` / `onReconnectInfo` を追加し、表示復帰時の fit / WS effect deps に nonce 追加 / ResizeObserver の早期 return / `attachCustomKeyEventHandler` / `term.onSelectionChange` を実装
- `packages/web/src/components/terminal/__tests__/`: 現状 `XtermView.test.tsx` 1 本のみ。Phase 2d で 4 本追加 (visibility / reconnect / autoCopy / shortcuts) + `TerminalHeader.test.tsx` + `TerminalContextMenu.test.tsx`
- `packages/web/src/stores/settings.ts`: `themeMode / language / fontSize` の 3 設定 + persist version 1。Phase 2d で `autoCopyOnSelect: boolean` 追加 + version 2 + migrate
- `packages/web/src/stores/__tests__/settings.test.ts`: 既存 5 ケース。Phase 2d で autoCopyOnSelect 用ケース + migration 1 ケースを追加
- `packages/web/src/components/settings/SettingsPanel.tsx`: `AppearanceSection / TerminalSection / GatewaySection / SystemStatusSection / RateLimitsSection` を縦並び。Phase 2d で `TerminalSection` に autoCopyOnSelect トグルを追加
- `packages/web/src/i18n/locales/{en,ja}.json`: `terminal.status.{connected,disconnected,reconnecting,error}` と `terminal.selectPrompt` 既存。Phase 2d で `terminal.*` namespace を大幅拡張 + `settings.terminal.autoCopyOnSelect` キー追加
- `packages/web/src/lib/terminalProtocol.ts`: `encodeInput(data: string) / encodeResize(cols, rows) / parseServerMessage(raw) / buildTerminalWsUrl(...)` 既存
- `packages/web/src/lib/reconnectBackoff.ts`: `createReconnectBackoff()` で `next() → { delayMs, attempt, exhausted }` / `reset()`。MAX_ATTEMPTS=20, INITIAL=1000ms, MAX=30000ms
- `packages/web/src/theme/tokens.ts`: 使えるキーは `tokens.colors.{bg,bgElevated,surface,surfaceHover,border,borderSubtle,textPrimary,textSecondary,textMuted,textInverse,primary,primaryMuted,primarySubtle,success,warning,error}` / `tokens.typography.{bodyMedium,smallMedium,small,caption,heading,mono}` / `tokens.spacing.{xs,sm,md,lg,xl,'2xl','3xl','4xl'}` / `tokens.radii.{sm,md,lg}`。`bodyMedium.fontSize` 等のサブキーで参照
- `packages/web/src/setupTests.ts`: jsdom 25。i18n は `lng: 'en'` で初期化済み。Blob.stream polyfill 既存。`navigator.clipboard` polyfill **未** ⇒ Phase 2d Task 1 で追加
- `packages/web/src/i18n/index.ts`: `initI18n()` は store の language を読んで init/changeLanguage。テストで `useSettingsStore.setState({ language: 'en' }); initI18n();` で英語固定可能
- Playwright: 既存 spec 16 本、port 使用済 = 18790-18798 + 18800-18806。Phase 2d は **18807-18810** を割り当て (4 spec)
- Phase 2c の `useSessionsStore` には `sessions: TmuxSession[]` slice あり、`TmuxSession.displayName: string` と `TmuxSession.windows: TmuxWindow[]` (各 `{ index: number, name: string, ... }`) を持つ。`TerminalHeader` で `useSessionsStore((s) => s.sessions.find(...))` で取得

**Branch:** 既に `feature/web-pc-phase-2d` (origin/main から分岐、spec 1 commit 済み)

---

## Sub-phase 2d-1: TerminalPane mount 永続化 (Tasks 1-6)

Files タブ往復で xterm が unmount されない構造へ。`navigator.clipboard` polyfill の追加もここで先取り (後続サブフェーズ全部で必要)。

### Task 1: jsdom に `navigator.clipboard` polyfill を追加

**Files:**

- Modify: `packages/web/src/setupTests.ts`

- [ ] **Step 1: Read current setupTests.ts**

```bash
cd /home/server/projects/zenterm/server && cat packages/web/src/setupTests.ts | head -40
```

Expected: 現状の Blob.stream polyfill + i18n init が確認できる。

- [ ] **Step 2: Add clipboard polyfill**

`packages/web/src/setupTests.ts` の i18n init 直前 (Blob.stream polyfill ブロックの直後) に以下を追加:

```ts
// jsdom 25 has no navigator.clipboard. Tests that exercise Copy/Paste UX
// (Phase 2d) need writeText/readText. Define a writable mock so individual
// tests can override with vi.fn() per case.
if (typeof navigator !== 'undefined' && !('clipboard' in navigator)) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: {
      writeText: async (_text: string) => undefined,
      readText: async () => '',
    },
  });
}
```

- [ ] **Step 3: Verify type-check still passes**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```

Expected: PASS — 既存 test に影響なし。

- [ ] **Step 4: Verify existing vitest still passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/setupTests.ts || true
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal
```

Expected: 既存 XtermView.test.tsx PASS (4 ケース)。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/setupTests.ts
git commit -m "$(cat <<'EOF'
test(web): add navigator.clipboard polyfill in setupTests for Phase 2d

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: XtermView に `isVisible` prop を追加 (failing test → impl)

**Files:**

- Modify: `packages/web/src/components/terminal/XtermView.tsx`
- Test: `packages/web/src/components/terminal/__tests__/XtermView.visibility.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/terminal/__tests__/XtermView.visibility.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';

// Track the most recently constructed Terminal mock so we can assert focus/fit calls.
const fitCalls: number[] = [];
const focusCalls: number[] = [];
const sentMessages: string[] = [];

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
      focus: vi.fn(() => focusCalls.push(performance.now())),
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
  FitAddon: vi.fn().mockImplementation(function () {
    return { fit: vi.fn(() => fitCalls.push(performance.now())) };
  }),
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
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    sentMessages.push(data);
  }

  close(code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000 } as CloseEvent);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }
}

beforeEach(() => {
  fitCalls.length = 0;
  focusCalls.length = 0;
  sentMessages.length = 0;
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  useSettingsStore.setState({ fontSize: 14 } as any);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('XtermView isVisible prop', () => {
  it('does not unmount terminal when toggled false', () => {
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
    const wsBefore = MockWebSocket.instances.length;
    rerender(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible={false}
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    // No new WebSocket should be opened, and the existing one stays connected.
    expect(MockWebSocket.instances.length).toBe(wsBefore);
    expect(MockWebSocket.instances[0].readyState).not.toBe(MockWebSocket.CLOSED);
  });

  it('calls fit + focus when toggled false → true', () => {
    const { rerender } = render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible={false}
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    const fitCallsBeforeReveal = fitCalls.length;
    const focusCallsBeforeReveal = focusCalls.length;
    act(() => {
      rerender(
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
    });
    expect(fitCalls.length).toBeGreaterThan(fitCallsBeforeReveal);
    expect(focusCalls.length).toBeGreaterThan(focusCallsBeforeReveal);
  });

  it('sends a resize message on reveal when WS is open', () => {
    const { rerender } = render(
      <XtermView
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible={false}
        isFocused
        reconnectNonce={0}
        onStatusChange={() => undefined}
      />,
    );
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    sentMessages.length = 0;
    act(() => {
      rerender(
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
    });
    const resizeMsgs = sentMessages.filter((m) => m.includes('"type":"resize"'));
    expect(resizeMsgs.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the new test (expect FAIL — props not yet on signature)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal/__tests__/XtermView.visibility.test.tsx
```

Expected: FAIL — TypeScript error or runtime mismatch because `isVisible` / `reconnectNonce` aren't accepted yet.

- [ ] **Step 3: Implement `isVisible` + `reconnectNonce` in XtermView**

Replace the entire body of `packages/web/src/components/terminal/XtermView.tsx` with:

```tsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { terminalColorsDark, terminalColorsLight } from '@/theme/terminalColors';
import { FONT_FAMILY_MONO } from '@/theme/tokens';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/stores/settings';
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
      const last = lastSentSizeRef.current;
      if (
        ws &&
        ws.readyState === WebSocket.OPEN &&
        (last === null || last.cols !== term.cols || last.rows !== term.rows)
      ) {
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
```

- [ ] **Step 4: Run the new visibility test (expect PASS)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal/__tests__/XtermView.visibility.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run the original XtermView test to confirm no regression**

The existing `XtermView.test.tsx` does not pass `isVisible` / `reconnectNonce` — it must be updated. Edit `packages/web/src/components/terminal/__tests__/XtermView.test.tsx` to add `isVisible` and `reconnectNonce={0}` to all 4 `<XtermView ... />` JSX usages (props after `isFocused`).

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal/__tests__/XtermView.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/terminal/XtermView.tsx packages/web/src/components/terminal/__tests__/XtermView.test.tsx packages/web/src/components/terminal/__tests__/XtermView.visibility.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add isVisible + reconnectNonce + onReconnectInfo to XtermView

display:none-aware fit/focus/resize on reveal; ResizeObserver early-returns
while hidden; nonce-driven WS reconnect; emits ReconnectInfo for header.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: TerminalPane に `isVisible` prop を受け display:none を適用

**Files:**

- Modify: `packages/web/src/components/TerminalPane.tsx`
- Modify: `packages/web/src/components/__tests__/TerminalPane.test.tsx`

- [ ] **Step 1: Update existing TerminalPane test for `isVisible` prop**

Edit `packages/web/src/components/__tests__/TerminalPane.test.tsx`. After the existing 2 tests, add:

```tsx
  it('keeps DOM mounted but hidden when isVisible=false', () => {
    const { container } = render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible={false}
      />,
    );
    const root = container.querySelector('section[data-terminal-root="true"]');
    expect(root).not.toBeNull();
    expect((root as HTMLElement).style.display).toBe('none');
  });

  it('shows DOM (display: grid) when isVisible=true', () => {
    const { container } = render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={0}
        isVisible
      />,
    );
    const root = container.querySelector('section[data-terminal-root="true"]');
    expect(root).not.toBeNull();
    expect((root as HTMLElement).style.display).toBe('grid');
  });
```

Also update the existing `'shows session/window in toolbar when active'` test by adding `isVisible` prop (TS will require it):

```tsx
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="1234"
        sessionId="dev"
        windowIndex={2}
        isVisible
      />,
    );
```

The `'shows empty state when no session selected'` case keeps `sessionId={null}` — also add `isVisible`. (Empty-state branch returns early without the `data-terminal-root` section.)

- [ ] **Step 2: Run the test (expect FAIL — `isVisible` prop missing)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.test.tsx
```

Expected: FAIL — TS or runtime errors about unknown prop / missing `data-terminal-root`.

- [ ] **Step 3: Update TerminalPane to receive `isVisible` and apply display**

Replace `packages/web/src/components/TerminalPane.tsx` with:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XtermView, type TerminalStatus } from './terminal/XtermView';
import { useTheme } from '@/theme';

export interface TerminalPaneProps {
  gatewayUrl: string;
  token: string;
  sessionId: string | null;
  windowIndex: number | null;
  isVisible: boolean;
}

export function TerminalPane({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  isVisible,
}: TerminalPaneProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<TerminalStatus>('disconnected');

  const statusColor: string = (() => {
    switch (status) {
      case 'connected':
        return tokens.colors.success;
      case 'reconnecting':
        return tokens.colors.warning;
      case 'error':
        return tokens.colors.error;
      default:
        return tokens.colors.textMuted;
    }
  })();

  if (sessionId === null || windowIndex === null) {
    return (
      <main
        style={{
          flex: 1,
          background: tokens.colors.bg,
          color: tokens.colors.textSecondary,
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {t('terminal.selectPrompt')}
      </main>
    );
  }

  return (
    <section
      data-terminal-root="true"
      style={{
        flex: 1,
        display: isVisible ? 'grid' : 'none',
        gridTemplateRows: '48px 1fr',
        height: '100vh',
        background: tokens.colors.bg,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          padding: `0 ${tokens.spacing.lg}px`,
          borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
          color: tokens.colors.textPrimary,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: tokens.typography.bodyMedium.fontSize }}>
          {sessionId}
        </span>
        <span style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.smallMedium.fontSize }}>
          · w{windowIndex}
        </span>
        <span style={{ flex: 1 }} />
        <span
          aria-label={`Connection ${t(`terminal.status.${status}` as 'terminal.status.connected')}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
          }}
        />
      </header>
      <div style={{ minHeight: 0 }}>
        <XtermView
          gatewayUrl={gatewayUrl}
          token={token}
          sessionId={sessionId}
          windowIndex={windowIndex}
          isFocused={isVisible}
          isVisible={isVisible}
          reconnectNonce={0}
          onStatusChange={setStatus}
        />
      </div>
    </section>
  );
}
```

> The header is intentionally kept inline for this task; Sub-phase 2d-3 carves it out into `TerminalHeader`.

- [ ] **Step 4: Run TerminalPane test (expect PASS)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/TerminalPane.tsx packages/web/src/components/__tests__/TerminalPane.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): TerminalPane accepts isVisible prop and applies display:none

Forwarded to XtermView.isVisible. Empty-state branch also respects the flag.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: AuthenticatedShell に並列レイアウトを適用

**Files:**

- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/components/__tests__/AuthenticatedShell.test.tsx`

- [ ] **Step 1: Add a test asserting both panes coexist when on /web/files**

Append to `packages/web/src/components/__tests__/AuthenticatedShell.test.tsx`:

```tsx
import { useFilesStore } from '@/stores/files';

// ...inside `describe('AuthenticatedShell', ...)` add:

  it('keeps TerminalPane mounted when navigated to /web/files', () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    useFilesStore.getState().reset?.();
    const { container } = render(
      <MemoryRouter initialEntries={['/web/files']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    // TerminalPane root is present in DOM but hidden (display:none) because
    // sessionId === null + isVisible=false collapses to empty-state hidden.
    // FilesViewerPane is also rendered.
    expect(container.querySelector('main, section')).not.toBeNull();
    // Files heading from FilesViewerPane (rendered when isFilesRoute) — the
    // exact selector varies with FilesViewerPane internals; the smoke test is
    // that both branches render without throwing.
    expect(container.textContent ?? '').toMatch(/Files|file/i);
  });
```

(`useFilesStore` import is allowed; `reset?.()` is optional-chained because the store may not expose it in all builds.)

- [ ] **Step 2: Run test (expect FAIL — only one branch renders today)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/AuthenticatedShell.test.tsx
```

Expected: FAIL — files content not present alongside terminal-related DOM.

- [ ] **Step 3: Replace the right-pane branch with a parallel layout**

In `packages/web/src/components/AuthenticatedShell.tsx`, replace the `return (...)` block (the JSX from `<div style={{ display: 'flex' ...}}>` onward) with:

```tsx
  return (
    <div style={{ display: 'flex', height: '100vh', background: tokens.colors.bg }}>
      <Sidebar
        sessions={sessions}
        loading={loading}
        error={error}
        activeSessionId={activeSessionId}
        activeWindowIndex={activeWindowIndex}
        onSelect={(sessionId, windowIndex) => open(sessionId, windowIndex ?? 0)}
        onCreateSession={handleCreateSession}
        onRenameSession={handleRenameSession}
        onRequestDeleteSession={handleRequestDeleteSession}
        onCreateWindow={handleCreateWindow}
        onRenameWindow={handleRenameWindow}
        onRequestDeleteWindow={handleRequestDeleteWindow}
        filesClient={filesClient}
      />
      <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex' }}>
        <TerminalPane
          gatewayUrl={gatewayUrl}
          token={token}
          sessionId={activeSessionId}
          windowIndex={activeWindowIndex}
          isVisible={!isFilesRoute}
        />
        {isFilesRoute && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <FilesViewerPane client={filesClient} token={token} />
          </div>
        )}
      </div>
    </div>
  );
```

Key points:

- TerminalPane is **always** rendered as the first child of the right wrapper.
- FilesViewerPane is overlaid (absolute) on top only when `isFilesRoute`. This keeps Files unmount-on-leave behaviour intact (Files-side stores reset when their owning component unmounts).
- The wrapper `display: 'flex'` lets both panes occupy the available width.

- [ ] **Step 4: Run AuthenticatedShell test (expect PASS)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/AuthenticatedShell.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/AuthenticatedShell.tsx packages/web/src/components/__tests__/AuthenticatedShell.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): keep TerminalPane mounted when navigating to /web/files

FilesViewerPane is overlaid via absolute positioning; TerminalPane stays in
DOM with isVisible=false, preserving xterm scrollback and the WebSocket.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Flow test — Files navigation does not unmount TerminalPane

**Files:**

- Test: `packages/web/src/__tests__/flows/AuthenticatedShell.terminalKeepAlive.test.tsx`

- [ ] **Step 1: Write the failing flow test**

Create `packages/web/src/__tests__/flows/AuthenticatedShell.terminalKeepAlive.test.tsx`:

```tsx
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// Mock xterm so the component tree mounts cleanly.
const constructorCalls: number[] = [];
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function () {
    constructorCalls.push(performance.now());
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

import { AuthenticatedShell } from '@/components/AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';
import { useSessionViewStore } from '@/stores/sessionView';

function NavTo({ to }: { to: string }) {
  const nav = useNavigate();
  useEffect(() => { nav(to); }, [nav, to]);
  return null;
}

beforeEach(() => {
  constructorCalls.length = 0;
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => [],
    text: async () => '[]',
  }));
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example.com:18765' });
  useSessionViewStore.setState({ activeSessionId: 'dev', activeWindowIndex: 0 });
});

describe('AuthenticatedShell terminal keep-alive', () => {
  it('does not construct a new Terminal when navigating to /web/files and back', async () => {
    let nav: ((to: string) => void) | null = null;
    function Capture() {
      const n = useNavigate();
      useEffect(() => { nav = n; }, [n]);
      return null;
    }

    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Routes>
          <Route
            path="/web/*"
            element={
              <>
                <Capture />
                <AuthenticatedShell />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const initial = constructorCalls.length;
    expect(initial).toBeGreaterThan(0);
    const wsBefore = MockWebSocket.instances.length;

    await act(async () => { nav?.('/web/files'); });
    await act(async () => { nav?.('/web/sessions'); });

    expect(constructorCalls.length).toBe(initial);
    expect(MockWebSocket.instances.length).toBe(wsBefore);
  });
});
```

- [ ] **Step 2: Run flow test (expect PASS — Task 4 already wired the keep-alive)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/AuthenticatedShell.terminalKeepAlive.test.tsx
```

Expected: PASS (1 test). If it fails because `Capture` doesn't get the navigate ref before first commit, wrap the assertion block in `await waitFor(...)`.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/AuthenticatedShell.terminalKeepAlive.test.tsx
git commit -m "$(cat <<'EOF'
test(web): add flow test asserting Terminal constructor is not re-invoked across /web/files navigation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Sub-phase 2d-1 sanity (full vitest + type-check)

**Files:**

- (no edits)

- [ ] **Step 1: Run full vitest**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web
```

Expected: PASS — Phase 2a + 2b + 2c + Phase 2d-1 additions all green.

- [ ] **Step 2: Run type-check**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```

Expected: PASS.

- [ ] **Step 3: No commit needed if no diffs.** Otherwise stage the fixups and commit:

```bash
git status --short
git diff --stat
# If unintended diffs exist, fix and commit; otherwise skip.
```

---

## Sub-phase 2d-2: Reconnect ボタン (Tasks 7-11)

XtermView の `reconnectNonce` / `onReconnectInfo` は既に Sub-phase 2d-1 で props 化済み。本サブフェーズでは TerminalPane 側で nonce / ReconnectInfo を state 化し、ヘッダー (今は inline) に Reconnect ボタンを生やす。`TerminalHeader` への切り出しは Sub-phase 2d-3 で行うので、ここでは inline ヘッダーに props を追加するだけに留める。

---

### Task 7: XtermView reconnect 単体テスト (nonce 増分で WS 再接続)

**Files:**

- Test: `packages/web/src/components/terminal/__tests__/XtermView.reconnect.test.tsx`

- [ ] **Step 1: Write the test**

Create `packages/web/src/components/terminal/__tests__/XtermView.reconnect.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test (expect PASS — XtermView already supports nonce)**

```bash
npx vitest run -w @zenterm/web src/components/terminal/__tests__/XtermView.reconnect.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/terminal/__tests__/XtermView.reconnect.test.tsx
git commit -m "$(cat <<'EOF'
test(web): cover XtermView reconnectNonce + onReconnectInfo wiring

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: TerminalPane に nonce / ReconnectInfo state を追加

**Files:**

- Modify: `packages/web/src/components/TerminalPane.tsx`

- [ ] **Step 1: Update TerminalPane to hold nonce + reconnectInfo**

Edit `packages/web/src/components/TerminalPane.tsx`. Replace the imports and the function body so it reads (only the changed regions shown — keep imports otherwise):

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XtermView,
  type ReconnectInfo,
  type TerminalStatus,
} from './terminal/XtermView';
import { useTheme } from '@/theme';
```

Replace the state declaration:

```tsx
  const [status, setStatus] = useState<TerminalStatus>('disconnected');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [reconnectInfo, setReconnectInfo] = useState<ReconnectInfo | null>(null);

  const handleReconnect = (): void => {
    setReconnectNonce((n) => n + 1);
  };
```

Update the `<XtermView>` JSX to forward the new props:

```tsx
        <XtermView
          gatewayUrl={gatewayUrl}
          token={token}
          sessionId={sessionId}
          windowIndex={windowIndex}
          isFocused={isVisible}
          isVisible={isVisible}
          reconnectNonce={reconnectNonce}
          onStatusChange={setStatus}
          onReconnectInfo={setReconnectInfo}
        />
```

Within the inline `<header>` JSX, immediately before the `<span>` status dot, insert a Reconnect button that is shown when status is `disconnected` / `reconnecting` / `error`:

```tsx
        {(status === 'disconnected' || status === 'reconnecting' || status === 'error') && (
          <button
            type="button"
            aria-label={t('terminal.reconnect')}
            onClick={handleReconnect}
            style={{
              background: tokens.colors.surface,
              color: tokens.colors.textPrimary,
              border: `1px solid ${tokens.colors.border}`,
              padding: `4px 10px`,
              borderRadius: tokens.radii.sm,
              fontSize: tokens.typography.caption.fontSize,
              cursor: 'pointer',
              marginRight: tokens.spacing.sm,
            }}
          >
            ↺ {t('terminal.reconnect')}
          </button>
        )}
        {status === 'reconnecting' && reconnectInfo && !reconnectInfo.exhausted && (
          <span
            data-testid="terminal-reconnect-eta"
            style={{
              color: tokens.colors.textMuted,
              fontSize: tokens.typography.caption.fontSize,
              marginRight: tokens.spacing.sm,
            }}
          >
            {t('terminal.reconnectingEta', {
              seconds: Math.max(1, Math.ceil(reconnectInfo.etaMs / 1000)),
              attempt: reconnectInfo.attempt,
            })}
          </span>
        )}
```

> i18n keys `terminal.reconnect` and `terminal.reconnectingEta` are added in Sub-phase 2d-6. Until then `t('terminal.reconnect')` returns the key string itself, which is harmless for unit tests.

- [ ] **Step 2: Type-check**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/TerminalPane.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire Reconnect button and reconnect-eta into TerminalPane header

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: TerminalPane reconnect 統合テスト

**Files:**

- Test: `packages/web/src/components/__tests__/TerminalPane.reconnect.test.tsx`

- [ ] **Step 1: Write the test**

Create `packages/web/src/components/__tests__/TerminalPane.reconnect.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';

const xtermProps: any[] = [];
vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: (props: any) => {
    xtermProps.push(props);
    return <div data-testid="mock-xterm" data-nonce={props.reconnectNonce} />;
  },
}));

import { TerminalPane } from '../TerminalPane';

beforeEach(() => {
  xtermProps.length = 0;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TerminalPane Reconnect button', () => {
  it('initially mounts XtermView with nonce 0', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        isVisible
      />,
    );
    expect(screen.getByTestId('mock-xterm').getAttribute('data-nonce')).toBe('0');
  });

  it('increments nonce when Reconnect button is clicked', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        isVisible
      />,
    );
    // Force the status to "disconnected" by invoking the captured callback.
    const last = xtermProps.at(-1);
    expect(typeof last.onStatusChange).toBe('function');
    act(() => {
      last.onStatusChange('disconnected');
    });
    const btn = screen.getByRole('button', { name: /terminal\.reconnect/i });
    fireEvent.click(btn);
    const nodes = screen.getAllByTestId('mock-xterm');
    const nonce = parseInt(nodes[nodes.length - 1].getAttribute('data-nonce') ?? '0', 10);
    expect(nonce).toBe(1);
  });

  it('shows reconnecting eta when ReconnectInfo is set with attempt + etaMs', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        isVisible
      />,
    );
    const last = xtermProps.at(-1);
    act(() => {
      last.onStatusChange('reconnecting');
      last.onReconnectInfo({ attempt: 2, etaMs: 4000, exhausted: false });
    });
    expect(screen.getByTestId('terminal-reconnect-eta')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.reconnect.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/__tests__/TerminalPane.reconnect.test.tsx
git commit -m "$(cat <<'EOF'
test(web): TerminalPane Reconnect click bumps XtermView reconnectNonce

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: TerminalPane existing test fix-up after Reconnect button addition

**Files:**

- Modify: `packages/web/src/components/__tests__/TerminalPane.test.tsx`

The existing 4 tests in `TerminalPane.test.tsx` mount the real `XtermView` (not mocked), so the inline header now contains a `↺ terminal.reconnect` button when status is `disconnected`. None of the existing assertions look for that button, so they should still pass — but verify.

- [ ] **Step 1: Run TerminalPane.test.tsx**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.test.tsx
```

Expected: PASS (4 tests). If a regression appears, add `terminal.reconnect` translation lookup tolerance — the assertions only match `/dev/` and `/w2/` so they should be unaffected.

- [ ] **Step 2: No commit needed unless edits were required.**

---

### Task 11: Sub-phase 2d-2 sanity

- [ ] **Step 1: Run full vitest + type-check**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web && npm run -w @zenterm/web type-check
```

Expected: PASS.

---

## Sub-phase 2d-3: TerminalHeader 切り出し + displayName + window 名 + sessionId copy ボタン (Tasks 12-16)

inline ヘッダーを `TerminalHeader` に分離。`useSessionsStore` から displayName と window name を読む。sessionId copy ボタンを追加 (toast は `useUiStore.pushToast`)。

---

### Task 12: TerminalHeader コンポーネント (failing test → impl)

**Files:**

- Create: `packages/web/src/components/terminal/TerminalHeader.tsx`
- Test: `packages/web/src/components/terminal/__tests__/TerminalHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/terminal/__tests__/TerminalHeader.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';
import { initI18n } from '@/i18n';
import { TerminalHeader } from '../TerminalHeader';
import type { TerminalStatus, ReconnectInfo } from '../XtermView';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

const baseProps = {
  sessionId: 'zen_dev',
  windowIndex: 1,
  displayName: 'dev',
  windowName: 'editor',
  status: 'connected' as TerminalStatus,
  reconnectInfo: null as ReconnectInfo | null,
  fontSize: 14,
  onReconnect: () => undefined,
  onCopySessionId: () => undefined,
  onZoomIn: () => undefined,
  onZoomOut: () => undefined,
  onZoomReset: () => undefined,
};

describe('TerminalHeader', () => {
  it('renders displayName and window name + index', () => {
    render(<TerminalHeader {...baseProps} />);
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText(/editor/)).toBeInTheDocument();
    expect(screen.getByText(/\[w1\]/)).toBeInTheDocument();
  });

  it('falls back to sessionId when displayName is empty', () => {
    render(<TerminalHeader {...baseProps} displayName="" />);
    expect(screen.getByText('zen_dev')).toBeInTheDocument();
  });

  it('shows the status text and aria label for connected', () => {
    render(<TerminalHeader {...baseProps} />);
    expect(screen.getByLabelText(/Connection Connected/i)).toBeInTheDocument();
    expect(screen.getByText(/^Connected$/)).toBeInTheDocument();
  });

  it('renders Reconnect button when status is disconnected', () => {
    const onReconnect = vi.fn();
    render(<TerminalHeader {...baseProps} status="disconnected" onReconnect={onReconnect} />);
    const btn = screen.getByRole('button', { name: /reconnect/i });
    fireEvent.click(btn);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('shows reconnecting eta when ReconnectInfo present', () => {
    render(
      <TerminalHeader
        {...baseProps}
        status="reconnecting"
        reconnectInfo={{ attempt: 3, etaMs: 5000, exhausted: false }}
      />,
    );
    expect(screen.getByTestId('terminal-reconnect-eta')).toHaveTextContent(/5/);
    expect(screen.getByTestId('terminal-reconnect-eta')).toHaveTextContent(/3/);
  });

  it('Copy ID button calls onCopySessionId', () => {
    const onCopy = vi.fn();
    render(<TerminalHeader {...baseProps} onCopySessionId={onCopy} />);
    fireEvent.click(screen.getByRole('button', { name: /copy session id/i }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('Zoom buttons call respective handlers', () => {
    const inc = vi.fn();
    const dec = vi.fn();
    const reset = vi.fn();
    render(
      <TerminalHeader
        {...baseProps}
        onZoomIn={inc}
        onZoomOut={dec}
        onZoomReset={reset}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /increase font size/i }));
    fireEvent.click(screen.getByRole('button', { name: /decrease font size/i }));
    fireEvent.click(screen.getByRole('button', { name: /reset font size/i }));
    expect(inc).toHaveBeenCalled();
    expect(dec).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });

  it('disables zoom-out at MIN_FONT_SIZE and zoom-in at MAX_FONT_SIZE', () => {
    const { rerender } = render(<TerminalHeader {...baseProps} fontSize={10} />);
    expect(screen.getByRole('button', { name: /decrease font size/i })).toBeDisabled();
    rerender(<TerminalHeader {...baseProps} fontSize={20} />);
    expect(screen.getByRole('button', { name: /increase font size/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL — module not found)**

```bash
npx vitest run -w @zenterm/web src/components/terminal/__tests__/TerminalHeader.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement TerminalHeader**

Create `packages/web/src/components/terminal/TerminalHeader.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '@/stores/settings';
import type { TerminalStatus, ReconnectInfo } from './XtermView';

export interface TerminalHeaderProps {
  sessionId: string;
  windowIndex: number;
  displayName: string;
  windowName: string;
  status: TerminalStatus;
  reconnectInfo: ReconnectInfo | null;
  fontSize: number;
  onReconnect: () => void;
  onCopySessionId: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function TerminalHeader({
  sessionId,
  windowIndex,
  displayName,
  windowName,
  status,
  reconnectInfo,
  fontSize,
  onReconnect,
  onCopySessionId,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: TerminalHeaderProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

  const statusColor: string = (() => {
    switch (status) {
      case 'connected': return tokens.colors.success;
      case 'reconnecting': return tokens.colors.warning;
      case 'error': return tokens.colors.error;
      default: return tokens.colors.textMuted;
    }
  })();

  const showReconnectBtn = status === 'disconnected' || status === 'reconnecting' || status === 'error';
  const showEta = status === 'reconnecting' && reconnectInfo && !reconnectInfo.exhausted;

  const stepBtn = (disabled: boolean) => ({
    background: tokens.colors.surface,
    border: `1px solid ${tokens.colors.border}`,
    color: tokens.colors.textPrimary,
    width: 24,
    height: 24,
    borderRadius: tokens.radii.sm,
    cursor: disabled ? ('not-allowed' as const) : ('pointer' as const),
    opacity: disabled ? 0.4 : 1,
    fontSize: tokens.typography.caption.fontSize,
  });

  const labelText = displayName && displayName.length > 0 ? displayName : sessionId;

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: `0 ${tokens.spacing.lg}px`,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: tokens.typography.bodyMedium.fontSize }}>
        {labelText}
      </span>
      {windowName && (
        <span style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.smallMedium.fontSize }}>
          {windowName}
        </span>
      )}
      <span style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.smallMedium.fontSize }}>
        [w{windowIndex}]
      </span>
      <button
        type="button"
        aria-label={t('terminal.copySessionId')}
        onClick={onCopySessionId}
        style={{
          background: 'transparent',
          border: `1px solid ${tokens.colors.borderSubtle}`,
          color: tokens.colors.textSecondary,
          padding: `2px 8px`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.caption.fontSize,
          cursor: 'pointer',
        }}
      >
        ID
      </button>
      <span style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs }}>
        <button
          type="button"
          aria-label={t('terminal.zoomOut')}
          onClick={onZoomOut}
          disabled={fontSize <= MIN_FONT_SIZE}
          style={stepBtn(fontSize <= MIN_FONT_SIZE)}
        >
          −
        </button>
        <button
          type="button"
          aria-label={t('terminal.zoomReset')}
          onClick={onZoomReset}
          style={{
            background: 'transparent',
            border: 'none',
            color: tokens.colors.textPrimary,
            cursor: 'pointer',
            minWidth: 24,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            fontSize: tokens.typography.caption.fontSize,
          }}
        >
          {fontSize}
        </button>
        <button
          type="button"
          aria-label={t('terminal.zoomIn')}
          onClick={onZoomIn}
          disabled={fontSize >= MAX_FONT_SIZE}
          style={stepBtn(fontSize >= MAX_FONT_SIZE)}
        >
          +
        </button>
      </div>

      {showEta && reconnectInfo && (
        <span
          data-testid="terminal-reconnect-eta"
          style={{
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            marginLeft: tokens.spacing.sm,
          }}
        >
          {t('terminal.reconnectingEta', {
            seconds: Math.max(1, Math.ceil(reconnectInfo.etaMs / 1000)),
            attempt: reconnectInfo.attempt,
          })}
        </span>
      )}

      {showReconnectBtn && (
        <button
          type="button"
          aria-label={t('terminal.reconnect')}
          onClick={onReconnect}
          style={{
            background: tokens.colors.surface,
            color: tokens.colors.textPrimary,
            border: `1px solid ${tokens.colors.border}`,
            padding: `4px 10px`,
            borderRadius: tokens.radii.sm,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'pointer',
            marginLeft: tokens.spacing.sm,
          }}
        >
          ↺ {t('terminal.reconnect')}
        </button>
      )}

      <span
        aria-label={`Connection ${t(`terminal.status.${status}` as 'terminal.status.connected')}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: tokens.spacing.xs,
          marginLeft: tokens.spacing.sm,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
          }}
        />
        <span style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.caption.fontSize }}>
          {t(`terminal.status.${status}` as 'terminal.status.connected')}
        </span>
      </span>
    </header>
  );
}
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal/__tests__/TerminalHeader.test.tsx
```

Expected: PASS (8 tests). The aria-labels and labels rely on the `terminal.*` i18n keys added in Sub-phase 2d-6. For now, English fallback returns the key string itself — adjust the test's regex `/copy session id/i` to also match `/terminal\.copysessionid/i` if necessary, OR pre-add minimal English-only keys to `en.json` here. Easier: pre-seed only the keys this test needs (commit 2d-3 step) — but the cleaner option is to add the en/ja JSON updates here as part of the task. To keep Sub-phase 2d-6 as the single source for i18n changes, this Sub-phase **also** writes the keys it needs and Sub-phase 2d-6 will only **add additional keys** + the toggle UI.

Edit `packages/web/src/i18n/locales/en.json` `"terminal"` namespace to add (alphabetised):

```json
    "copySessionId": "Copy session ID",
    "copySessionIdSuccess": "Session ID copied",
    "reconnect": "Reconnect",
    "reconnectingEta": "Reconnecting in {{seconds}}s (attempt {{attempt}}/20)",
    "zoomIn": "Increase font size",
    "zoomOut": "Decrease font size",
    "zoomReset": "Reset font size"
```

Edit `packages/web/src/i18n/locales/ja.json` `"terminal"` namespace to add:

```json
    "copySessionId": "セッション ID をコピー",
    "copySessionIdSuccess": "セッション ID をコピーしました",
    "reconnect": "再接続",
    "reconnectingEta": "{{seconds}} 秒後に再接続 (試行 {{attempt}}/20)",
    "zoomIn": "フォントサイズを大きく",
    "zoomOut": "フォントサイズを小さく",
    "zoomReset": "フォントサイズをリセット"
```

Re-run:

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal/__tests__/TerminalHeader.test.tsx
```

Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/terminal/TerminalHeader.tsx packages/web/src/components/terminal/__tests__/TerminalHeader.test.tsx packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add TerminalHeader with displayName + windowName + zoom + reconnect UI

Includes en/ja locales for terminal.copySessionId, reconnect, reconnectingEta,
and zoom controls. The header is wired into TerminalPane in the next task.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: TerminalPane が TerminalHeader を使うように切り替え

**Files:**

- Modify: `packages/web/src/components/TerminalPane.tsx`

- [ ] **Step 1: Replace inline header with TerminalHeader usage**

Replace `packages/web/src/components/TerminalPane.tsx` with:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XtermView,
  type ReconnectInfo,
  type TerminalStatus,
} from './terminal/XtermView';
import { TerminalHeader } from './terminal/TerminalHeader';
import { useTheme } from '@/theme';
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettingsStore,
} from '@/stores/settings';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';

export interface TerminalPaneProps {
  gatewayUrl: string;
  token: string;
  sessionId: string | null;
  windowIndex: number | null;
  isVisible: boolean;
}

export function TerminalPane({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  isVisible,
}: TerminalPaneProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<TerminalStatus>('disconnected');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [reconnectInfo, setReconnectInfo] = useState<ReconnectInfo | null>(null);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const pushToast = useUiStore((s) => s.pushToast);

  const session = useSessionsStore((s) =>
    sessionId ? s.sessions.find((sess) => sess.id === sessionId) : undefined,
  );
  const displayName = session?.displayName ?? '';
  const windowName =
    windowIndex !== null
      ? session?.windows.find((w) => w.index === windowIndex)?.name ?? ''
      : '';

  const handleReconnect = (): void => {
    setReconnectNonce((n) => n + 1);
  };

  const handleCopySessionId = async (): Promise<void> => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      pushToast({ type: 'success', message: t('terminal.copySessionIdSuccess') });
    } catch {
      pushToast({ type: 'error', message: t('terminal.copyFailed') });
    }
  };

  const handleZoomIn = (): void => {
    if (fontSize < MAX_FONT_SIZE) setFontSize(fontSize + 1);
  };
  const handleZoomOut = (): void => {
    if (fontSize > MIN_FONT_SIZE) setFontSize(fontSize - 1);
  };
  const handleZoomReset = (): void => {
    setFontSize(DEFAULT_FONT_SIZE);
  };

  if (sessionId === null || windowIndex === null) {
    return (
      <main
        style={{
          flex: 1,
          background: tokens.colors.bg,
          color: tokens.colors.textSecondary,
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {t('terminal.selectPrompt')}
      </main>
    );
  }

  return (
    <section
      data-terminal-root="true"
      style={{
        flex: 1,
        display: isVisible ? 'grid' : 'none',
        gridTemplateRows: '48px 1fr',
        height: '100vh',
        background: tokens.colors.bg,
      }}
    >
      <TerminalHeader
        sessionId={sessionId}
        windowIndex={windowIndex}
        displayName={displayName}
        windowName={windowName}
        status={status}
        reconnectInfo={reconnectInfo}
        fontSize={fontSize}
        onReconnect={handleReconnect}
        onCopySessionId={handleCopySessionId}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />
      <div style={{ minHeight: 0 }}>
        <XtermView
          gatewayUrl={gatewayUrl}
          token={token}
          sessionId={sessionId}
          windowIndex={windowIndex}
          isFocused={isVisible}
          isVisible={isVisible}
          reconnectNonce={reconnectNonce}
          onStatusChange={setStatus}
          onReconnectInfo={setReconnectInfo}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add `terminal.copyFailed` to locales**

`packages/web/src/i18n/locales/en.json` `"terminal"` namespace, add:

```json
    "copyFailed": "Clipboard copy denied",
```

`packages/web/src/i18n/locales/ja.json`:

```json
    "copyFailed": "クリップボード操作が拒否されました",
```

- [ ] **Step 3: Type-check**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```

Expected: PASS.

- [ ] **Step 4: Update TerminalPane existing tests for the new label format**

`packages/web/src/components/__tests__/TerminalPane.test.tsx` — the `'shows session/window in toolbar when active'` test asserted `/dev/` and `/w2/`. With TerminalHeader the format is `dev` (no displayName because the mock store has empty `sessions`), and `[w2]`. The regex `/dev/` still matches and `/w2/` matches `[w2]`. No edits required.

The `'increments nonce when Reconnect button is clicked'` test (Task 9) used `getByRole('button', { name: /terminal\.reconnect/i })`. With i18n keys now added, the button label is `↺ Reconnect`. Update to `getByRole('button', { name: /reconnect/i })`.

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.test.tsx src/components/__tests__/TerminalPane.reconnect.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/TerminalPane.tsx packages/web/src/components/__tests__/TerminalPane.reconnect.test.tsx packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): wire TerminalHeader into TerminalPane (displayName, copy ID, zoom, reconnect)

Subscribes to useSessionsStore for displayName/windowName; clipboard copy uses
useUiStore for toast feedback.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: TerminalPane displayName / sessionId copy 統合テスト

**Files:**

- Test: `packages/web/src/components/__tests__/TerminalPane.header.test.tsx`

- [ ] **Step 1: Write the test**

Create `packages/web/src/components/__tests__/TerminalPane.header.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { useSessionsStore } from '@/stores/sessions';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { initI18n } from '@/i18n';

vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: () => <div data-testid="mock-xterm" />,
}));

import { TerminalPane } from '../TerminalPane';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  useSessionsStore.setState({
    sessions: [
      {
        id: 'zen_dev',
        displayName: 'dev',
        windows: [{ index: 0, name: 'editor', active: true, panes: 1 }],
        attached: false,
        created: 0,
      } as any,
    ],
  } as any);
  useUiStore.setState({ toasts: [] } as any);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TerminalPane header integration', () => {
  it('renders displayName instead of raw sessionId when sessions store has the entry', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="zen_dev"
        windowIndex={0}
        isVisible
      />,
    );
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    expect(screen.getByText(/\[w0\]/)).toBeInTheDocument();
  });

  it('Copy ID button writes sessionId to navigator.clipboard and pushes a success toast', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, writable: true, value: { writeText, readText: async () => '' },
    });
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="zen_dev"
        windowIndex={0}
        isVisible
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy session id/i }));
    });
    expect(writeText).toHaveBeenCalledWith('zen_dev');
    await waitFor(() => {
      const toasts = (useUiStore.getState() as any).toasts as Array<{ message: string; type: string }>;
      expect(toasts.some((tt) => /copied/i.test(tt.message))).toBe(true);
    });
  });

  it('Zoom + button increases font size in settings store', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="zen_dev"
        windowIndex={0}
        isVisible
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /increase font size/i }));
    expect(useSettingsStore.getState().fontSize).toBe(15);
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.header.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/__tests__/TerminalPane.header.test.tsx
git commit -m "$(cat <<'EOF'
test(web): TerminalPane integrates TerminalHeader with sessions/settings stores

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: AuthenticatedShell test fix-up after sessionId rendering change

The `'renders Sidebar + TerminalPane when authenticated'` test in `AuthenticatedShell.test.tsx` (Task 4) asserts `getAllByLabelText(/Sessions/i)`. The label match is unaffected by displayName changes.

- [ ] **Step 1: Run AuthenticatedShell tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/AuthenticatedShell.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 2: No edits / no commit needed unless regressions surface.**

---

### Task 16: Sub-phase 2d-3 sanity

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web && npm run -w @zenterm/web type-check
```

Expected: PASS.

---

## Sub-phase 2d-4: フォントズーム (Tasks 17-20)

ヘッダー −/+/reset ボタンは Sub-phase 2d-3 で完了済み。本サブフェーズでは xterm 内ショートカットを追加。

---

### Task 17: XtermView shortcuts unit test (failing test → impl)

**Files:**

- Test: `packages/web/src/components/terminal/__tests__/XtermView.shortcuts.test.tsx`
- Modify: `packages/web/src/components/terminal/XtermView.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/terminal/__tests__/XtermView.shortcuts.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test (expect FAIL — no key handler attached yet)**

```bash
npx vitest run -w @zenterm/web src/components/terminal/__tests__/XtermView.shortcuts.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement keyboard handler in XtermView**

In `packages/web/src/components/terminal/XtermView.tsx`, add a new `useEffect` after the "Apply focus" effect and before the WebSocket effect. Also add the imports it needs at top.

Add to imports:

```tsx
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettingsStore,
} from '@/stores/settings';
```

(`useSettingsStore` is already imported — keep imports unique. Add the constants `DEFAULT_FONT_SIZE`, `MAX_FONT_SIZE`, `MIN_FONT_SIZE` to the existing import statement.)

Insert the new effect:

```tsx
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
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal/__tests__/XtermView.shortcuts.test.tsx
```

Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/terminal/XtermView.tsx packages/web/src/components/terminal/__tests__/XtermView.shortcuts.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): xterm CustomKeyEvent — Ctrl+Shift+C/V copy/paste, Ctrl+=/-/0 zoom

Plain Ctrl+C remains a SIGINT passthrough. All zoom keys clamp to
MIN_FONT_SIZE / MAX_FONT_SIZE via the settings store.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: TerminalHeader fontSize re-render integration smoke

**Files:**

- (no edits)

The `TerminalHeader` already reads `fontSize` from props. `TerminalPane` reads it from the settings store. So a Ctrl+= keypress that updates the store causes TerminalPane to re-render and pass the new fontSize to TerminalHeader. Verify by running the `TerminalPane.header.test.tsx` Zoom test (Task 14) which already exercises that path through the +/− buttons.

- [ ] **Step 1: Run header test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.header.test.tsx
```

Expected: PASS.

- [ ] **Step 2: No commit needed.**

---

### Task 19: Existing TerminalSection font-size tests still pass

The Settings panel has its own `TerminalSection` font-size controls. They share the same `setFontSize` and remain in scope.

- [ ] **Step 1: Run Settings TerminalSection tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/TerminalSection.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 2: No commit needed.**

---

### Task 20: Sub-phase 2d-4 sanity

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web && npm run -w @zenterm/web type-check
```

Expected: PASS.

---

## Sub-phase 2d-5: Copy / Paste + 右クリックメニュー + Settings autoCopyOnSelect (Tasks 21-26)

`autoCopyOnSelect` を Settings store に追加 (persist version 2 + migrate)。`XtermView` に `term.onSelectionChange` を購読する effect を追加。`TerminalContextMenu` を新規実装し、`XtermView` 上の overlay div の `onContextMenu` から開く。

---

### Task 21: Settings store に `autoCopyOnSelect` を追加 (persist version 2 + migrate)

**Files:**

- Modify: `packages/web/src/stores/settings.ts`
- Modify: `packages/web/src/stores/__tests__/settings.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/web/src/stores/__tests__/settings.test.ts`:

```ts
import { vi } from 'vitest';

describe('useSettingsStore autoCopyOnSelect', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
      autoCopyOnSelect: false,
    } as any);
  });

  it('defaults to false', () => {
    expect(useSettingsStore.getState().autoCopyOnSelect).toBe(false);
  });

  it('setAutoCopyOnSelect updates and persists', () => {
    useSettingsStore.getState().setAutoCopyOnSelect(true);
    expect(useSettingsStore.getState().autoCopyOnSelect).toBe(true);
    const raw = window.localStorage.getItem('zenterm-web-settings');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.autoCopyOnSelect).toBe(true);
    expect(JSON.parse(raw!).version).toBe(2);
  });

  it('migrates v1 persisted state by adding autoCopyOnSelect: false', async () => {
    window.localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 16 },
        version: 1,
      }),
    );
    // Force re-hydration by re-importing via dynamic import is complex; instead,
    // call the persist `rehydrate` API directly.
    await (useSettingsStore as any).persist.rehydrate();
    const s = useSettingsStore.getState();
    expect(s.themeMode).toBe('dark');
    expect(s.language).toBe('en');
    expect(s.fontSize).toBe(16);
    expect(s.autoCopyOnSelect).toBe(false);
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npx vitest run -w @zenterm/web src/stores/__tests__/settings.test.ts
```

Expected: FAIL — `setAutoCopyOnSelect` undefined.

- [ ] **Step 3: Update settings.ts**

Replace `packages/web/src/stores/settings.ts` with:

```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ja';

export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 20;
export const DEFAULT_FONT_SIZE = 14;

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  fontSize: number;
  autoCopyOnSelect: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  setFontSize: (size: number) => void;
  setAutoCopyOnSelect: (value: boolean) => void;
}

function clampFontSize(size: number): number {
  const rounded = Math.round(size);
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, rounded));
}

interface PersistedV1 {
  themeMode: ThemeMode;
  language: Language;
  fontSize: number;
}

interface PersistedV2 extends PersistedV1 {
  autoCopyOnSelect: boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
      autoCopyOnSelect: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      setFontSize: (size) => set({ fontSize: clampFontSize(size) }),
      setAutoCopyOnSelect: (autoCopyOnSelect) => set({ autoCopyOnSelect }),
    }),
    {
      name: 'zenterm-web-settings',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        language: state.language,
        fontSize: state.fontSize,
        autoCopyOnSelect: state.autoCopyOnSelect,
      }),
      migrate: (persistedState, version): PersistedV2 => {
        const s = (persistedState ?? {}) as Partial<PersistedV2>;
        if (version < 2) {
          return {
            themeMode: s.themeMode ?? 'system',
            language: s.language ?? 'ja',
            fontSize: typeof s.fontSize === 'number' ? s.fontSize : DEFAULT_FONT_SIZE,
            autoCopyOnSelect: false,
          };
        }
        return {
          themeMode: s.themeMode ?? 'system',
          language: s.language ?? 'ja',
          fontSize: typeof s.fontSize === 'number' ? s.fontSize : DEFAULT_FONT_SIZE,
          autoCopyOnSelect: s.autoCopyOnSelect ?? false,
        };
      },
    },
  ),
);
```

- [ ] **Step 4: Run (expect PASS)**

```bash
npx vitest run -w @zenterm/web src/stores/__tests__/settings.test.ts
```

Expected: PASS (8 tests = 5 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/settings.ts packages/web/src/stores/__tests__/settings.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add autoCopyOnSelect to settings store with v2 persist migration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: XtermView selection auto-copy effect (failing test → impl)

**Files:**

- Test: `packages/web/src/components/terminal/__tests__/XtermView.autoCopy.test.tsx`
- Modify: `packages/web/src/components/terminal/XtermView.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/terminal/__tests__/XtermView.autoCopy.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run (expect FAIL — no onSelectionChange handler attached)**

```bash
npx vitest run -w @zenterm/web src/components/terminal/__tests__/XtermView.autoCopy.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Add the effect to XtermView**

In `packages/web/src/components/terminal/XtermView.tsx`, after the keyboard-shortcut effect (Task 17), add:

```tsx
  // Selection auto-copy (opt-in via settings).
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const disposable = term.onSelectionChange(() => {
      const enabled = useSettingsStore.getState().autoCopyOnSelect;
      if (!enabled) return;
      const sel = term.getSelection();
      if (!sel) return;
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(sel).catch(() => undefined);
      }
    });
    return () => disposable.dispose();
  }, []);
```

- [ ] **Step 4: Run (expect PASS)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal/__tests__/XtermView.autoCopy.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/terminal/XtermView.tsx packages/web/src/components/terminal/__tests__/XtermView.autoCopy.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): xterm onSelectionChange writes to clipboard when autoCopyOnSelect=true

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 23: TerminalContextMenu component (failing test → impl)

**Files:**

- Create: `packages/web/src/components/terminal/TerminalContextMenu.tsx`
- Test: `packages/web/src/components/terminal/__tests__/TerminalContextMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/terminal/__tests__/TerminalContextMenu.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';
import { initI18n } from '@/i18n';
import { TerminalContextMenu } from '../TerminalContextMenu';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en' } as any);
  initI18n();
});

describe('TerminalContextMenu', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <TerminalContextMenu
        open={false}
        x={10}
        y={20}
        hasSelection={false}
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders 4 items when open=true', () => {
    render(
      <TerminalContextMenu
        open
        x={10}
        y={20}
        hasSelection
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('menuitem', { name: /^Copy$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Paste$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Clear$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Reconnect$/ })).toBeInTheDocument();
  });

  it('disables Copy when hasSelection=false', () => {
    render(
      <TerminalContextMenu
        open
        x={10}
        y={20}
        hasSelection={false}
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('menuitem', { name: /^Copy$/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('clicking an item triggers callback and onClose', () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();
    render(
      <TerminalContextMenu
        open
        x={10}
        y={20}
        hasSelection
        onCopy={onCopy}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /^Copy$/ }));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key calls onClose', () => {
    const onClose = vi.fn();
    render(
      <TerminalContextMenu
        open
        x={10}
        y={20}
        hasSelection
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking outside calls onClose', () => {
    const onClose = vi.fn();
    render(
      <>
        <div data-testid="outside" style={{ width: 100, height: 100 }} />
        <TerminalContextMenu
          open
          x={10}
          y={20}
          hasSelection
          onCopy={() => undefined}
          onPaste={() => undefined}
          onClear={() => undefined}
          onReconnect={() => undefined}
          onClose={onClose}
        />
      </>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('positions itself at x/y', () => {
    render(
      <TerminalContextMenu
        open
        x={42}
        y={84}
        hasSelection
        onCopy={() => undefined}
        onPaste={() => undefined}
        onClear={() => undefined}
        onReconnect={() => undefined}
        onClose={() => undefined}
      />,
    );
    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBe('42px');
    expect(menu.style.top).toBe('84px');
  });
});
```

- [ ] **Step 2: Run (expect FAIL — module not found)**

```bash
npx vitest run -w @zenterm/web src/components/terminal/__tests__/TerminalContextMenu.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `packages/web/src/components/terminal/TerminalContextMenu.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

export interface TerminalContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  hasSelection: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onReconnect: () => void;
  onClose: () => void;
}

export function TerminalContextMenu({
  open,
  x,
  y,
  hasSelection,
  onCopy,
  onPaste,
  onClear,
  onReconnect,
  onClose,
}: TerminalContextMenuProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    const onMouseDown = (ev: MouseEvent) => {
      if (!ref.current) return;
      if (ev.target instanceof Node && ref.current.contains(ev.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const itemStyle = (disabled: boolean) => ({
    padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
    cursor: disabled ? ('not-allowed' as const) : ('pointer' as const),
    color: disabled ? tokens.colors.textMuted : tokens.colors.textPrimary,
    fontSize: tokens.typography.smallMedium.fontSize,
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    opacity: disabled ? 0.5 : 1,
  });

  const handleClick = (cb: () => void) => () => {
    cb();
    onClose();
  };

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        padding: tokens.spacing.xs,
        zIndex: 1000,
        minWidth: 160,
      }}
    >
      <button
        type="button"
        role="menuitem"
        aria-disabled={!hasSelection}
        disabled={!hasSelection}
        onClick={handleClick(onCopy)}
        style={itemStyle(!hasSelection)}
      >
        {t('terminal.menu.copy')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleClick(onPaste)}
        style={itemStyle(false)}
      >
        {t('terminal.menu.paste')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleClick(onClear)}
        style={itemStyle(false)}
      >
        {t('terminal.menu.clear')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleClick(onReconnect)}
        style={itemStyle(false)}
      >
        {t('terminal.menu.reconnect')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add menu i18n keys**

`packages/web/src/i18n/locales/en.json` `"terminal"`:

```json
    "menu": {
      "copy": "Copy",
      "paste": "Paste",
      "clear": "Clear",
      "reconnect": "Reconnect"
    },
```

`packages/web/src/i18n/locales/ja.json` `"terminal"`:

```json
    "menu": {
      "copy": "コピー",
      "paste": "ペースト",
      "clear": "クリア",
      "reconnect": "再接続"
    },
```

- [ ] **Step 5: Run (expect PASS)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal/__tests__/TerminalContextMenu.test.tsx
```

Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/terminal/TerminalContextMenu.tsx packages/web/src/components/terminal/__tests__/TerminalContextMenu.test.tsx packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
feat(web): add TerminalContextMenu (Copy / Paste / Clear / Reconnect) with Esc + outside-click close

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 24: Wire context menu into TerminalPane

**Files:**

- Modify: `packages/web/src/components/TerminalPane.tsx`
- Modify: `packages/web/src/components/terminal/XtermView.tsx`

The cleanest place to host the right-click event is XtermView's container div. We add an `onContextMenu` callback prop on `XtermView`, and three imperative actions: `onMenuClear()`, `onMenuCopy()`, `onMenuPaste()`. Or — simpler — expose a ref-style `getSelection()` and `clear()` and `paste(text)` via callbacks. To keep the props surface manageable, we'll add 3 props to XtermView:

- `onContextMenu?: (info: { x: number; y: number; hasSelection: boolean }) => void`
- a ref-forwarded API exposed via a `terminalActionsRef` callback prop

Use the **callback-based API** (avoids forwardRef ceremony):

In `packages/web/src/components/terminal/XtermView.tsx`, add to props interface:

```tsx
  onContextMenu?: (info: { x: number; y: number; hasSelection: boolean }) => void;
  onActionsReady?: (actions: TerminalActions) => void;
```

And add the `TerminalActions` type / export near `ReconnectInfo`:

```tsx
export interface TerminalActions {
  copy: () => void;
  paste: () => void;
  clear: () => void;
}
```

In the function body, after `termRef.current = term;` is set in the mount effect, expose actions:

```tsx
    const actions: TerminalActions = {
      copy: () => {
        const sel = term.getSelection();
        if (!sel) return;
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(sel).catch(() => undefined);
        }
      },
      paste: () => {
        if (!navigator.clipboard?.readText) return;
        void navigator.clipboard.readText().then((text) => {
          if (!text) return;
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(encodeInput(text));
          }
        }).catch(() => undefined);
      },
      clear: () => {
        term.clear();
      },
    };
    onActionsReadyRef.current?.(actions);
```

(Add `const onActionsReadyRef = useRef(onActionsReady);` and the syncing `useEffect` mirror of `onStatusChangeRef`.)

Modify the `return (...)` to attach the context-menu handler:

```tsx
  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        const term = termRef.current;
        const sel = term?.getSelection() ?? '';
        onContextMenu({ x: e.clientX, y: e.clientY, hasSelection: sel.length > 0 });
      }}
      style={{
        width: '100%',
        height: '100%',
        background:
          resolvedTheme === 'light' ? terminalColorsLight.background : terminalColorsDark.background,
      }}
    />
  );
```

Now in `packages/web/src/components/TerminalPane.tsx`, wire the menu:

Add to imports:

```tsx
import { TerminalContextMenu } from './terminal/TerminalContextMenu';
import type { TerminalActions } from './terminal/XtermView';
```

Add state inside the component:

```tsx
  const [menu, setMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);
  const actionsRef = useRef<TerminalActions | null>(null);
```

(Import `useRef` from React.)

Pass props to `<XtermView>`:

```tsx
          onContextMenu={(info) => setMenu(info)}
          onActionsReady={(a) => { actionsRef.current = a; }}
```

Render the menu after the `<div style={{ minHeight: 0 }}>`:

```tsx
      {menu && (
        <TerminalContextMenu
          open
          x={menu.x}
          y={menu.y}
          hasSelection={menu.hasSelection}
          onCopy={() => actionsRef.current?.copy()}
          onPaste={() => actionsRef.current?.paste()}
          onClear={() => actionsRef.current?.clear()}
          onReconnect={handleReconnect}
          onClose={() => setMenu(null)}
        />
      )}
```

- [ ] **Step 1: Type-check**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```

Expected: PASS.

- [ ] **Step 2: Re-run impacted tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.test.tsx src/components/__tests__/TerminalPane.header.test.tsx src/components/__tests__/TerminalPane.reconnect.test.tsx src/components/terminal/__tests__/XtermView.test.tsx src/components/terminal/__tests__/XtermView.visibility.test.tsx
```

Expected: PASS (all). The existing XtermView tests do not pass `onContextMenu` / `onActionsReady` — they remain optional so no breakage.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/TerminalPane.tsx packages/web/src/components/terminal/XtermView.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire TerminalContextMenu into TerminalPane via XtermView callbacks

Adds optional onContextMenu + onActionsReady props on XtermView so TerminalPane
can render Copy/Paste/Clear/Reconnect without lifting xterm into a ref.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 25: TerminalPane context-menu integration test

**Files:**

- Test: `packages/web/src/components/__tests__/TerminalPane.contextMenu.test.tsx`

- [ ] **Step 1: Write the test**

Create `packages/web/src/components/__tests__/TerminalPane.contextMenu.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { useSettingsStore } from '@/stores/settings';
import { initI18n } from '@/i18n';

const captured: any[] = [];
vi.mock('@/components/terminal/XtermView', () => ({
  XtermView: (props: any) => {
    captured.push(props);
    return (
      <div
        data-testid="mock-xterm"
        onContextMenu={(e) => {
          e.preventDefault();
          props.onContextMenu?.({ x: 50, y: 60, hasSelection: true });
        }}
      />
    );
  },
}));

import { TerminalPane } from '../TerminalPane';

beforeEach(() => {
  captured.length = 0;
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }),
  });
});

describe('TerminalPane context menu', () => {
  it('opens menu on contextmenu event from XtermView and closes on Escape', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        isVisible
      />,
    );
    fireEvent.contextMenu(screen.getByTestId('mock-xterm'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Copy$/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Reconnect menuitem bumps reconnectNonce', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        isVisible
      />,
    );
    const initialNonce = captured[0].reconnectNonce;
    fireEvent.contextMenu(screen.getByTestId('mock-xterm'));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Reconnect$/ }));
    const last = captured.at(-1);
    expect(last.reconnectNonce).toBe(initialNonce + 1);
  });

  it('Clear menuitem invokes actionsRef.clear', () => {
    const clearSpy = vi.fn();
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        isVisible
      />,
    );
    act(() => {
      const last = captured.at(-1);
      last.onActionsReady?.({ copy: vi.fn(), paste: vi.fn(), clear: clearSpy });
    });
    fireEvent.contextMenu(screen.getByTestId('mock-xterm'));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Clear$/ }));
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/TerminalPane.contextMenu.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/__tests__/TerminalPane.contextMenu.test.tsx
git commit -m "$(cat <<'EOF'
test(web): TerminalPane right-click flow opens menu, closes, runs Clear/Reconnect

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 26: Sub-phase 2d-5 sanity

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web && npm run -w @zenterm/web type-check
```

Expected: PASS.

---

## Sub-phase 2d-6: i18n + Settings UI トグル (Tasks 27-29)

`terminal.*` namespace のキーは Sub-phase 2d-3 / 2d-5 で先行追加済み。本サブフェーズでは Settings UI に `autoCopyOnSelect` トグルを追加 (新キー + テスト + 既存 TerminalSection への統合)。

---

### Task 27: i18n keys final audit + add `settings.terminal.autoCopyOnSelect`

**Files:**

- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

- [ ] **Step 1: Audit current `terminal.*` namespace**

After 2d-3 / 2d-5 the en.json `"terminal"` namespace should contain:

- `selectPrompt`
- `status.{connected,disconnected,reconnecting,error}`
- `copySessionId`
- `copySessionIdSuccess`
- `copyFailed`
- `reconnect`
- `reconnectingEta`
- `zoomIn`, `zoomOut`, `zoomReset`
- `menu.{copy,paste,clear,reconnect}`

If anything is missing, add it now.

- [ ] **Step 2: Add `settings.terminal.autoCopyOnSelect` keys**

Edit `packages/web/src/i18n/locales/en.json` `"settings.terminal"` section (currently has `title` and `fontSize`). Add:

```json
      "autoCopyOnSelect": "Auto-copy selection",
      "autoCopyOnSelectDesc": "Copy selected text to the clipboard automatically when you finish a selection in the terminal."
```

Edit `packages/web/src/i18n/locales/ja.json` `"settings.terminal"`:

```json
      "autoCopyOnSelect": "選択時に自動コピー",
      "autoCopyOnSelectDesc": "ターミナルでテキストを選択し終えた瞬間にクリップボードへコピーします。"
```

- [ ] **Step 3: Type-check / vitest sanity**

```bash
npm run -w @zenterm/web type-check && npx vitest run -w @zenterm/web src/i18n
```

Expected: PASS (no i18n-only tests but TS still compiles).

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "$(cat <<'EOF'
i18n(web): add settings.terminal.autoCopyOnSelect (en/ja) for Phase 2d toggle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 28: TerminalSection に autoCopyOnSelect トグル追加 (failing test → impl)

**Files:**

- Modify: `packages/web/src/components/settings/TerminalSection.tsx`
- Modify: `packages/web/src/components/settings/__tests__/TerminalSection.test.tsx`

- [ ] **Step 1: Append failing tests**

Append to `packages/web/src/components/settings/__tests__/TerminalSection.test.tsx`:

```tsx
import { initI18n } from '@/i18n';

describe('TerminalSection autoCopyOnSelect toggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      themeMode: 'system',
      language: 'en',
      fontSize: 14,
      autoCopyOnSelect: false,
    } as any);
    initI18n();
  });

  it('renders the toggle in the off state by default', () => {
    render(<TerminalSection />);
    const toggle = screen.getByRole('switch', { name: /auto-copy selection/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking toggles autoCopyOnSelect in the store', () => {
    render(<TerminalSection />);
    const toggle = screen.getByRole('switch', { name: /auto-copy selection/i });
    fireEvent.click(toggle);
    expect(useSettingsStore.getState().autoCopyOnSelect).toBe(true);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(useSettingsStore.getState().autoCopyOnSelect).toBe(false);
  });

  it('renders the description string', () => {
    render(<TerminalSection />);
    expect(screen.getByText(/copy selected text to the clipboard automatically/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npx vitest run -w @zenterm/web src/components/settings/__tests__/TerminalSection.test.tsx
```

Expected: FAIL on the new 3 cases.

- [ ] **Step 3: Update TerminalSection.tsx**

Replace `packages/web/src/components/settings/TerminalSection.tsx` with:

```tsx
import { useTranslation } from 'react-i18next';
import { useSettingsStore, MIN_FONT_SIZE, MAX_FONT_SIZE } from '@/stores/settings';
import { useTheme } from '@/theme';

export function TerminalSection() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const autoCopyOnSelect = useSettingsStore((s) => s.autoCopyOnSelect);
  const setAutoCopyOnSelect = useSettingsStore((s) => s.setAutoCopyOnSelect);

  const stepBtn = (disabled: boolean) => ({
    background: tokens.colors.surface,
    border: `1px solid ${tokens.colors.border}`,
    color: tokens.colors.textPrimary,
    width: 28,
    height: 28,
    borderRadius: tokens.radii.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  });

  return (
    <section
      role="region"
      aria-label="Terminal"
      style={{
        marginTop: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
        borderTop: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <h3
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: tokens.typography.caption.fontSize,
          color: tokens.colors.textMuted,
          margin: `0 0 ${tokens.spacing.sm}px 0`,
        }}
      >
        {t('settings.terminal.title', 'Terminal')}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${tokens.spacing.sm}px 0` }}>
        <span style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}>
          {t('settings.terminal.fontSize', 'Font size')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
          <button
            type="button"
            aria-label="Decrease font size"
            disabled={fontSize <= MIN_FONT_SIZE}
            onClick={() => setFontSize(fontSize - 1)}
            style={stepBtn(fontSize <= MIN_FONT_SIZE)}
          >
            −
          </button>
          <span style={{ minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: tokens.colors.textPrimary }}>
            {fontSize}
          </span>
          <button
            type="button"
            aria-label="Increase font size"
            disabled={fontSize >= MAX_FONT_SIZE}
            onClick={() => setFontSize(fontSize + 1)}
            style={stepBtn(fontSize >= MAX_FONT_SIZE)}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: `${tokens.spacing.sm}px 0`, gap: tokens.spacing.md }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}>
            {t('settings.terminal.autoCopyOnSelect', 'Auto-copy selection')}
          </div>
          <div style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize, marginTop: tokens.spacing.xs }}>
            {t('settings.terminal.autoCopyOnSelectDesc', 'Copy selected text to the clipboard automatically.')}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoCopyOnSelect}
          aria-label={t('settings.terminal.autoCopyOnSelect', 'Auto-copy selection')}
          onClick={() => setAutoCopyOnSelect(!autoCopyOnSelect)}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            border: `1px solid ${tokens.colors.border}`,
            background: autoCopyOnSelect ? tokens.colors.primary : tokens.colors.surface,
            position: 'relative',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: tokens.colors.bgElevated,
              position: 'absolute',
              top: 2,
              left: autoCopyOnSelect ? 18 : 2,
              transition: 'left 120ms',
            }}
          />
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run (expect PASS)**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/TerminalSection.test.tsx
```

Expected: PASS (5 existing + 3 new = 8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/settings/TerminalSection.tsx packages/web/src/components/settings/__tests__/TerminalSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): Settings → Terminal adds Auto-copy selection toggle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 29: Sub-phase 2d-6 sanity

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web && npm run -w @zenterm/web type-check && npm run -w @zenterm/web build
```

Expected: PASS — full vitest, type-check, and a clean build (build is a good sanity gate before the heavier E2E sub-phase).

---

## Sub-phase 2d-7: Playwright E2E (Tasks 30-33)

4 spec、port 18807-18810。各 spec は既存 Files spec と同じ pattern (`mkdtempSync` + spawn gateway + `/health` poll)。

---

### Task 30: terminal-mount-preservation E2E (port 18807)

**Files:**

- Create: `tests/e2e/web/terminal-mount-preservation.spec.ts`

- [ ] **Step 1: Build the gateway (E2E specs spawn the built binary)**

```bash
npm run -w @zenterm/gateway build
```

Expected: PASS.

- [ ] **Step 2: Write the spec**

Create `tests/e2e/web/terminal-mount-preservation.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4807';
const PORT = 18807;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`,
  );
  // Seed at least one file so the Files panel has something visible.
  writeFileSync(join(home, 'README.md'), '# hello\n');

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: {
      ...process.env,
      HOME: home,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      AUTH_TOKEN: TOKEN,
      LOG_LEVEL: 'error',
    },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-mount`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('terminal scrollback survives Files navigation', async ({ page }) => {
  // Pre-create a session so Sidebar shows it.
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'e2e-mount' }),
  });
  expect(created.ok).toBe(true);

  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  // Open the session.
  await page.getByText('e2e-mount').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // Type a marker into the terminal so we can verify scrollback persists.
  await page.locator('.xterm-helper-textarea').focus();
  const marker = `MOUNT_KEEP_${Date.now()}`;
  await page.keyboard.type(`echo ${marker}`);
  await page.keyboard.press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText(marker, { timeout: 5000 });

  // Navigate to Files.
  await page.getByRole('button', { name: /Files tab/i }).click();
  await expect(page).toHaveURL(/\/web\/files$/);
  await expect(page.getByRole('button', { name: /^README\.md$/ })).toBeVisible({ timeout: 5000 });

  // Navigate back to Sessions.
  await page.getByRole('button', { name: /Sessions tab/i }).click();
  await expect(page).toHaveURL(/\/web\/sessions$/);

  // Connection should still be Connected (no reconnect happened).
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible();

  // The marker line must still be in the xterm DOM (proving scrollback survived).
  await expect(page.locator('.xterm-rows')).toContainText(marker);
});
```

- [ ] **Step 3: Run the spec**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/terminal-mount-preservation.spec.ts
```

Expected: PASS (1 test). If the assertion times out because xterm clears on the round trip, the implementation has regressed — investigate XtermView's `isVisible` flow before declaring success.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/web/terminal-mount-preservation.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): terminal-mount-preservation (port 18807) — Files round-trip keeps scrollback

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 31: terminal-reconnect E2E (port 18808)

**Files:**

- Create: `tests/e2e/web/terminal-reconnect.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/web/terminal-reconnect.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4808';
const PORT = 18808;
let home: string;

async function startGateway(): Promise<void> {
  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: {
      ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1',
      AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error',
    },
    stdio: 'inherit',
  });
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
}

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`,
  );
  baseUrl = `http://127.0.0.1:${PORT}`;
  await startGateway();
});

test.afterAll(async () => {
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-rec`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('Reconnect button reconnects after WS is dropped', async ({ page }) => {
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e-rec' }),
  });
  expect(created.ok).toBe(true);

  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.getByText('e2e-rec').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // Force-drop the WS by killing & restarting the gateway.
  gateway?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 800));

  // Status should leave 'Connected' (becomes 'Reconnecting…' or 'Disconnected').
  await expect(page.getByLabel(/Connection Connected/i)).toBeHidden({ timeout: 8000 });

  // Restart the gateway so the reconnect can succeed.
  await startGateway();

  // Click the Reconnect button (skip backoff wait).
  const reconnectBtn = page.getByRole('button', { name: /^Reconnect$/ });
  await expect(reconnectBtn).toBeVisible({ timeout: 5000 });
  await reconnectBtn.click();

  // Eventually returns to Connected.
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 10000 });
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/terminal-reconnect.spec.ts
```

Expected: PASS (1 test). If timing is flaky, increase the post-kill `setTimeout` to 1500 ms and the post-Connected hidden timeout to 10000 ms.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/terminal-reconnect.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): terminal-reconnect (port 18808) — Reconnect button restores connection

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 32: terminal-context-menu E2E (port 18809)

**Files:**

- Create: `tests/e2e/web/terminal-context-menu.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/web/terminal-context-menu.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4809';
const PORT = 18809;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: {
      ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1',
      AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error',
    },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-ctx`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('right-click opens menu; Clear empties xterm rows', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e-ctx' }),
  });
  expect(created.ok).toBe(true);

  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
  await page.getByText('e2e-ctx').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // Type something so the buffer has content.
  await page.locator('.xterm-helper-textarea').focus();
  const marker = `CTX_${Date.now()}`;
  await page.keyboard.type(`echo ${marker}`);
  await page.keyboard.press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText(marker, { timeout: 5000 });

  // Right-click on the xterm.
  await page.locator('.xterm-screen').click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Copy$/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Paste$/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Clear$/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Reconnect$/ })).toBeVisible();

  await page.getByRole('menuitem', { name: /^Clear$/ }).click();

  // After Clear, the marker should no longer appear in the visible rows.
  await expect(page.locator('.xterm-rows')).not.toContainText(marker, { timeout: 3000 });

  // Menu should have closed.
  await expect(page.getByRole('menu')).toBeHidden();
});
```

- [ ] **Step 2: Run**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/terminal-context-menu.spec.ts
```

Expected: PASS (1 test).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/terminal-context-menu.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): terminal-context-menu (port 18809) — right-click menu Clear empties xterm

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 33: terminal-font-zoom E2E (port 18810)

**Files:**

- Create: `tests/e2e/web/terminal-font-zoom.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/web/terminal-font-zoom.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4810';
const PORT = 18810;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`,
  );

  gateway = spawn('node', ['packages/gateway/dist/index.js'], {
    env: {
      ...process.env, HOME: home, PORT: String(PORT), HOST: '127.0.0.1',
      AUTH_TOKEN: TOKEN, LOG_LEVEL: 'error',
    },
    stdio: 'inherit',
  });
  baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-zoom`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* ignore */ }
  gateway?.kill();
});

test('header +/− and Ctrl+=/Ctrl+0 control font size', async ({ page }) => {
  const created = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e-zoom' }),
  });
  expect(created.ok).toBe(true);

  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });
  await page.getByText('e2e-zoom').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // The reset button shows the current font size as its label text.
  const reset = page.getByRole('button', { name: /^Reset font size$/ });
  await expect(reset).toHaveText(/14/);

  await page.getByRole('button', { name: /^Increase font size$/ }).click();
  await expect(reset).toHaveText(/15/);

  await page.getByRole('button', { name: /^Decrease font size$/ }).click();
  await expect(reset).toHaveText(/14/);

  // Use Ctrl+= via keyboard inside xterm.
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.down('Control');
  await page.keyboard.press('=');
  await page.keyboard.up('Control');
  await expect(reset).toHaveText(/15/);

  // Ctrl+0 resets to 14.
  await page.keyboard.down('Control');
  await page.keyboard.press('0');
  await page.keyboard.up('Control');
  await expect(reset).toHaveText(/14/);
});
```

- [ ] **Step 2: Run**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/terminal-font-zoom.spec.ts
```

Expected: PASS (1 test).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/terminal-font-zoom.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): terminal-font-zoom (port 18810) — header +/− and Ctrl+=/Ctrl+0 update fontSize

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Sub-phase 2d-8: 最終検証 (Tasks 34-35)

---

### Task 34: Full vitest + full Playwright + type-check + build

**Files:**

- (none — verification only)

- [ ] **Step 1: Run full vitest suite**

```bash
npx vitest run -w @zenterm/web
```

Expected: PASS — Phase 2a + 2b + 2c + 2d suites all green. The Phase 2d additions are roughly: settings.ts (+3), TerminalSection (+3), TerminalPane.test (+2), TerminalPane.reconnect (+3), TerminalPane.header (+3), TerminalPane.contextMenu (+3), AuthenticatedShell (+1), AuthenticatedShell.terminalKeepAlive flow (+1), TerminalHeader (+8), TerminalContextMenu (+7), XtermView.visibility (+3), XtermView.reconnect (+3), XtermView.shortcuts (+10), XtermView.autoCopy (+2). Roughly **+52** new vitest cases.

- [ ] **Step 2: Run full Playwright suite**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web build
cd /home/server/projects/zenterm/server && npm run -w @zenterm/gateway build
cd /home/server/projects/zenterm/server && npx playwright test
```

Expected: PASS — Phase 2a + 2b + 2c + 2d (4 new) specs all green.

- [ ] **Step 3: type-check**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```

Expected: PASS — strict + `noUnusedParameters: true` clean.

- [ ] **Step 4: Update spec status**

Edit `docs/superpowers/specs/2026-05-11-pc-web-phase-2d-design.md`. Insert at the very top under the existing front-matter:

```markdown
> 状態: Phase 2d 完了 ({{TODAY}}) — `web-pc-phase-2d-done` タグ付き
```

Replace `{{TODAY}}` with `date +%F`.

- [ ] **Step 5: Update roadmap if applicable**

```bash
cd /home/server/projects/zenterm/server && grep -l "Phase 2d" docs/superpowers/specs/*.md docs/roadmap.md 2>/dev/null
```

For each match, set the status line to "Phase 2d 完了" where appropriate.

- [ ] **Step 6: Commit + tag**

```bash
git add docs/superpowers/specs/2026-05-11-pc-web-phase-2d-design.md docs/roadmap.md 2>/dev/null || true
git diff --cached --quiet || git commit -m "$(cat <<'EOF'
docs(web): mark Phase 2d complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git tag web-pc-phase-2d-done
```

---

### Task 35: Final smoke + handoff

- [ ] **Step 1: Confirm branch state is push-ready**

```bash
cd /home/server/projects/zenterm/server && git status --short
cd /home/server/projects/zenterm/server && git log --oneline origin/main..HEAD | head -40
```

Expected: clean working tree; ~30+ Phase 2d commits since `origin/main`.

- [ ] **Step 2: (Optional) push the branch**

The CLAUDE.md house rules forbid pushing to `main` directly but encourage feature-branch PRs. To open a PR after final verification:

```bash
cd /home/server/projects/zenterm/server && git push -u origin feature/web-pc-phase-2d
gh pr create --title "PC Web Phase 2d: TerminalPane mount keep-alive + Terminal UX" --body "$(cat <<'EOF'
## Summary
- TerminalPane stays mounted while navigating to /web/files (xterm scrollback + WebSocket preserved)
- Reconnect button + reconnecting eta in the new TerminalHeader
- displayName + window name + sessionId Copy button + font zoom (header buttons + Ctrl+=/Ctrl+-/Ctrl+0)
- Right-click menu (Copy / Paste / Clear / Reconnect) + Ctrl+Shift+C/V shortcuts
- Settings → Terminal autoCopyOnSelect toggle (persist v2 + migrate)

## Test plan
- [x] vitest (Phase 2a/b/c/d) all green
- [x] Playwright (existing 16 + Phase 2d 4 new) all green
- [x] npm run type-check clean
- [x] npm run build clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Done.**

---

## Self-Review Notes

### Spec coverage check (§1.3 success criteria)

| Spec criterion | Tasks |
|---|---|
| `/web/sessions` → `/web/files` → `/web/sessions` で xterm scrollback / WS が保持される | Task 2-5 (impl + flow test), Task 30 (E2E mount-preservation) |
| 切断時に Reconnect ボタンが表示され、押下で再接続が走る | Tasks 7-9 (XtermView nonce + TerminalPane wiring + tests), Task 13 (TerminalHeader integration), Task 31 (E2E reconnect) |
| 右クリックメニューで Copy / Paste / Clear / Reconnect が動作する | Tasks 23-25 (TerminalContextMenu + TerminalPane wiring + tests), Task 32 (E2E context-menu) |
| ヘッダーに displayName + window 名 [index] + sessionId copy ボタン + フォントズーム UI が表示 | Tasks 12-14 (TerminalHeader + TerminalPane integration + integration tests), Task 33 (E2E font-zoom verifies header presence indirectly) |
| Ctrl+= / Ctrl+- / Ctrl+0 がフォントサイズを変更する | Task 17 (XtermView shortcuts impl + test), Task 33 (E2E font-zoom Ctrl key path) |
| Phase 2c までの vitest が壊れない | Tasks 1, 6, 11, 16, 20, 26, 29, 34 (sanity gates) |
| Phase 2c までの Playwright が壊れない | Task 34 (full Playwright run) |
| Phase 2d で追加する vitest 単体/統合が全 pass | Tasks 2, 5, 7, 9, 12, 14, 17, 21, 22, 23, 25, 28, 34 |
| Phase 2d で追加する Playwright 4 spec が全 pass | Tasks 30-33, Task 34 |
| `npm run type-check` `npm run build` clean | Tasks 1, 11, 16, 20, 26, 29, 34 |

### Spec coverage check (§2-§5 design surface)

| Design item | Tasks |
|---|---|
| §2.1 XtermView `isVisible` + display:none + reveal fit/focus/resize | Task 2 (impl), Task 3 (TerminalPane forwards) |
| §2.1 ResizeObserver early-return while hidden | Task 2 (impl) |
| §2.1 WS は isVisible に関係なく接続維持 | Task 2 (impl), Task 5 (flow test) |
| §2.1 session/window 切替は現状踏襲 (`reconnectNonce` 依存) | Task 2 (effect deps include nonce + identity) |
| §2.2 ヘッダー status badge (text + chip) | Task 12 (TerminalHeader renders status text + dot) |
| §2.2 reconnecting カウントダウン + 試行回数表示 | Task 12 (showEta block, `terminal.reconnectingEta`) |
| §2.2 disconnected/error/reconnecting で Reconnect ボタン | Task 12 (showReconnectBtn block) |
| §2.2 ReconnectInfo type + onReconnectInfo callback | Task 2 (export + emit), Task 7-8 (consumer wiring) |
| §2.3 autoCopyOnSelect store 追加 + persist v2 + migrate | Task 21 |
| §2.3 onSelectionChange → clipboard.writeText | Task 22 |
| §2.3 右クリックメニュー (Copy/Paste/Clear/Reconnect) | Tasks 23-25 |
| §2.3 Ctrl+Shift+C/V 経由の copy/paste | Task 17 (CustomKeyEvent) |
| §2.4 TerminalHeader 切り出し + displayName + window 名 + sessionId copy | Tasks 12-13 |
| §2.5 フォントズーム (ヘッダー UI + xterm shortcuts) | Tasks 12 (UI), 17 (shortcuts) |
| §3.1 影響ファイル (AuthenticatedShell / TerminalPane / XtermView / TerminalHeader / TerminalContextMenu / settings store / settings UI / locales) | Tasks 1-29 (each file owned by a named task) |
| §3.3 settings persist v1→v2 migrate | Task 21 |
| §4.1 unit tests (visibility / reconnect / autoCopy / shortcuts / TerminalHeader / TerminalContextMenu / TerminalPane.reconnect / TerminalPane.header / TerminalPane.contextMenu / AuthenticatedShell.terminalKeepAlive flow / settings.test extension) | Tasks 2, 5, 7, 9, 12, 14, 17, 21, 22, 23, 25 |
| §4.2 E2E (mount-preservation / reconnect / context-menu / font-zoom) | Tasks 30-33 |
| §4.3 jsdom navigator.clipboard polyfill | Task 1 |

### Type / signature consistency

- `XtermViewProps` shape (Task 2): `{ gatewayUrl, token, sessionId, windowIndex, isFocused, isVisible, reconnectNonce, onStatusChange, onReconnectInfo?, onContextMenu?, onActionsReady? }`. The `onContextMenu` and `onActionsReady` props are added in Task 24 — earlier tasks (2, 7, 17, 22) do not pass them, which is fine because both are `?` optional.
- `ReconnectInfo` exported from `XtermView.tsx` is `{ attempt: number; etaMs: number; exhausted: boolean }`. Consumed by `TerminalPane` (Task 8) and `TerminalHeader` (Task 12) — same shape.
- `TerminalActions` exported from `XtermView.tsx` (Task 24) is `{ copy: () => void; paste: () => void; clear: () => void }`. Consumed by `TerminalPane` (Task 24).
- `TerminalHeaderProps` (Task 12): all 12 props match what `TerminalPane` passes in Task 13.
- `TerminalContextMenuProps` (Task 23): 9 props (`open / x / y / hasSelection / onCopy / onPaste / onClear / onReconnect / onClose`). Used by `TerminalPane` in Task 24.
- `useSettingsStore` shape after Task 21 adds `autoCopyOnSelect: boolean` and `setAutoCopyOnSelect: (v: boolean) => void`. Consumed by Task 22 (`onSelectionChange`), Task 28 (TerminalSection toggle).
- `useSessionsStore` shape unchanged — only **read** by TerminalPane (Task 13) via `s.sessions.find(...)`.
- `useUiStore.pushToast({ type: 'success' | 'error' | 'info', message })` — used by TerminalPane (Task 13). Existing API confirmed in `Pre-existing facts`.

### TypeScript strict / noUnusedParameters compliance

- All callbacks that ignore arguments use `_name`-style prefixed parameters (`writeText: async (_text: string) => undefined` in setupTests.ts, Task 1). No bare `name: T` unused params remain.
- `BackoffStep` import (Task 2) is used (typed local in `step` declaration), no unused.

### Placeholder scan

Searched the plan for `TBD`, `TODO`, `fill in`, `similar to`, `like Task` — none. Every code block is fully expanded; every file path is absolute under `packages/web/src/...` or `tests/e2e/web/...`; every commit message is a complete HEREDOC with the required `Co-Authored-By` trailer.

### Known caveats

- **`vi.mock('@/components/terminal/XtermView', ...)`** in TerminalPane integration tests (Tasks 9, 14, 25) replaces the module wholesale. The mock factory must be hoisted (vitest hoists `vi.mock` calls to top), but `vi.fn()` references inside the factory are evaluated at the time of the first import — Phase 2c flow tests already use this same pattern, so it works in this codebase.
- **`requestAnimationFrame` stubbing**: Task 2's tests use `vi.stubGlobal('requestAnimationFrame', cb => { cb(0); return 1; })` to make the reveal-effect synchronous. Without this stub the assertion-after-rerender pattern races.
- **`(useSettingsStore as any).persist.rehydrate()`** (Task 21 step 1, third test): the zustand `persist` middleware exposes `persist.rehydrate()` on the store hook. The cast is unavoidable because zustand's TS types treat `persist` as an internal property.
- **xterm `attachCustomKeyEventHandler` "detach"** (Task 17 cleanup): xterm has no first-class detach API. Re-attaching a passthrough `() => true` is the canonical workaround and matches xterm.js docs.
- **Phase 2c `wrappedClient` non-memoize concern (IMP-1)**: not in scope; Phase 2d does not touch that wrapper.
- **Reconnect E2E (Task 31)** kills the gateway and restarts it on the same port. On some Linux kernels `SO_REUSEADDR` may delay the rebind by ~30s; if flaky, swap `SIGTERM` for `SIGKILL` and adjust the post-kill sleep.
- **autoCopyOnSelect E2E**: not added because clipboard read in headless Chromium requires `--enable-features=ClipboardAPI` flags; the unit + integration coverage (Tasks 22, 28) is sufficient. Spec §1.3 does not require an E2E for this.

### Spec items NOT covered by a dedicated task

- **xterm `refresh()` reveal call** (spec §5.1): included in Task 2's reveal effect (`term.refresh(0, term.rows - 1)`).
- **Cancel reconnecting button** (spec §2.2 final paragraph): explicitly out of scope — Reconnect button doubles as "skip wait".
- **`overwrite*` toast flows for context menu**: Phase 2d clipboard paste does not need overwrite UX; no keys added.
- **Reconnect-overlay on xterm during reconnecting** (spec §7.3): out of scope; header status text is sufficient.
- **Multi-session keep-alive (LRU)** (spec §1.2): explicit non-goal.
- **xterm `serialize` for reload restore** (spec §1.2): explicit non-goal.

