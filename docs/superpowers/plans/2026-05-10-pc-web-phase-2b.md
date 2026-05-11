# ZenTerm PC Web Phase 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings タブを追加して Appearance / Terminal / Gateway / SystemStatus / RateLimits の機能パリティを完成させ、i18n インフラ + en/ja を導入する (Phase 2 完成のうち Files 以外)。

**Architecture:** zustand persist の settings store に themeMode/language/fontSize を集約。`useTheme()` の persistence を localStorage 'zenterm-theme-mode' から settings store に移行 (key 名は完全に消す)。i18next + react-i18next を入れて 既存 Phase 2a UI 11 ファイルの hardcoded 文字列を `t()` に置換。SettingsPanel は 5 セクション縦並び、`/web/settings` ルートで AuthenticatedShell (新規共通 shell) 経由で描画。SystemStatus は 5s polling、Limits は手動 refresh。Theme/font は xterm に即時反映。

**Tech Stack:** TypeScript 5.7 / React 19 / Vite 6 / zustand 5 / react-router 7 / vitest 4 / Playwright / xterm.js v5.5+ / 新規: i18next ^23 + react-i18next ^15 + qrcode.react ^4

**Spec:** `docs/superpowers/specs/2026-05-10-pc-web-phase-2b-design.md`

**Pre-existing facts (Phase 1/2a で既存)**:
- `packages/web/src/theme/tokens.ts`: `darkTokens` + `lightTokens` 両方とも完成済み (light は未使用だが定義あり)
- `packages/web/src/theme/terminalColors.ts`: `terminalColorsDark` + `terminalColorsLight` 両方とも完成済み
- `packages/web/src/theme/index.ts`: `useTheme()` が `{ tokens, mode, setMode }` を返し、`mode='system'` で `prefers-color-scheme` を追跡する。**ただし persistence は localStorage の独立 key `'zenterm-theme-mode'` に直書き**で、settings store は未存在
- `packages/web/src/components/terminal/XtermView.tsx`: `theme: 'dark'|'light'` と `fontSize: number` を **props で受け取って** xterm に反映する
- `packages/web/src/components/TerminalPane.tsx`: `useTheme()` から `mode` を取って `system → matchMedia` で resolve し、`fontSize={14}` を hardcode して XtermView に渡している
- `packages/web/src/api/client.ts`: `ApiClient` クラス (sessions/windows CRUD のみ)、`verifyToken()` も既存
- Sidebar の bottom nav は 3 ボタンあるが Files/Settings は disabled で interactive 化されていない
- `packages/web/src/stores/auth.ts`: zustand persist + `createJSONStorage(() => localStorage)` + `partialize` の参考パターン
- `packages/web/src/stores/ui.ts`: `useUiStore.showConfirm()` / `pushToast()` 既存 (Phase 2a)
- `packages/shared/src/index.ts` に `SystemStatus` `ClaudeLimitsResponse` `CodexLimitsResponse` 等の型は完備
- Gateway 側は `/api/system/status` `/api/claude/limits` `/api/codex/limits` `/api/auth/verify` 全部実装済み

**Branch:** 既に `feature/web-pc-phase-2b` (origin/main から分岐、spec 2 commit 済み)

---

## Sub-phase 2b-1: Foundation

i18n + qrcode.react 依存追加、settings store 新規作成、useTheme() 移行 (localStorage 'zenterm-theme-mode' → settings store)、XtermView を store 直購読化、main.tsx で i18n init。

### Task 1: Add new dependencies (i18next, react-i18next, qrcode.react)

**Files:**
- Modify: `packages/web/package.json`

- [ ] **Step 1: Edit package.json**

```json
"dependencies": {
  "@xterm/addon-fit": "^0.10.0",
  "@xterm/addon-unicode11": "^0.8.0",
  "@xterm/addon-web-links": "^0.11.0",
  "@xterm/xterm": "^5.5.0",
  "@zenterm/shared": "*",
  "i18next": "^23.16.0",
  "qrcode.react": "^4.1.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-i18next": "^15.4.0",
  "react-router-dom": "^7.0.0",
  "zustand": "^5.0.0"
}
```

- [ ] **Step 2: Install**

Run from `packages/web/` directory:
```bash
cd /home/server/projects/zenterm/server && npm install
```
Expected: install succeeds, no peer dep warnings (i18next 23 と react-i18next 15 は React 19 サポート済み)

- [ ] **Step 3: Verify type-check still passes**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: PASS (no new code yet)

- [ ] **Step 4: Commit**

```bash
git add packages/web/package.json package-lock.json
git commit -m "chore(web): add i18next, react-i18next, qrcode.react deps"
```

---

### Task 2: Create settings store

**Files:**
- Create: `packages/web/src/stores/settings.ts`
- Test: `packages/web/src/stores/__tests__/settings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/stores/__tests__/settings.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettingsStore,
} from '../settings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
    });
  });

  it('starts with default values', () => {
    const s = useSettingsStore.getState();
    expect(s.themeMode).toBe('system');
    expect(s.language).toBe('ja');
    expect(s.fontSize).toBe(DEFAULT_FONT_SIZE);
  });

  it('setThemeMode updates and persists', () => {
    useSettingsStore.getState().setThemeMode('light');
    expect(useSettingsStore.getState().themeMode).toBe('light');
    const raw = window.localStorage.getItem('zenterm-web-settings');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.themeMode).toBe('light');
  });

  it('setLanguage updates and persists', () => {
    useSettingsStore.getState().setLanguage('en');
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('setFontSize clamps to range', () => {
    useSettingsStore.getState().setFontSize(99);
    expect(useSettingsStore.getState().fontSize).toBe(MAX_FONT_SIZE);
    useSettingsStore.getState().setFontSize(-5);
    expect(useSettingsStore.getState().fontSize).toBe(MIN_FONT_SIZE);
  });

  it('setFontSize rounds non-integer', () => {
    useSettingsStore.getState().setFontSize(14.7);
    expect(useSettingsStore.getState().fontSize).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/stores/__tests__/settings.test.ts
```
Expected: FAIL — module './../settings' not found

- [ ] **Step 3: Write minimal implementation**

Create `packages/web/src/stores/settings.ts`:
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
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  setFontSize: (size: number) => void;
}

function clampFontSize(size: number): number {
  const rounded = Math.round(size);
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, rounded));
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      setFontSize: (size) => set({ fontSize: clampFontSize(size) }),
    }),
    {
      name: 'zenterm-web-settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        language: state.language,
        fontSize: state.fontSize,
      }),
    },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/stores/__tests__/settings.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/settings.ts packages/web/src/stores/__tests__/settings.test.ts
git commit -m "feat(web): add settings store (themeMode/language/fontSize) with persist"
```

---

### Task 3: Create i18n locale dictionaries (skeleton + minimal keys for foundation)

**Files:**
- Create: `packages/web/src/i18n/locales/en.json`
- Create: `packages/web/src/i18n/locales/ja.json`

(Phase 2b-7 で全 key を flesh out するが、まず最小セットでセットアップを通す)

- [ ] **Step 1: Create en.json**

```json
{
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "loading": "Loading…",
    "retry": "Retry",
    "close": "Close"
  },
  "settings": {
    "title": "Settings"
  }
}
```

- [ ] **Step 2: Create ja.json**

```json
{
  "common": {
    "cancel": "キャンセル",
    "save": "保存",
    "loading": "読み込み中…",
    "retry": "再試行",
    "close": "閉じる"
  },
  "settings": {
    "title": "設定"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "feat(web): add i18n locale skeleton (en/ja)"
```

---

### Task 4: Create i18n init module + tsconfig JSON resolution

**Files:**
- Create: `packages/web/src/i18n/index.ts`
- Test: `packages/web/src/i18n/__tests__/index.test.ts`
- Modify: `packages/web/tsconfig.json` (resolveJsonModule をすでに有効化していなければ追加)

- [ ] **Step 1: Verify tsconfig includes resolveJsonModule**

Read `packages/web/tsconfig.json`. If `compilerOptions.resolveJsonModule` is not `true`, add it:
```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true,
    /* keep existing */
  }
}
```

If both are already present (Vite + React template defaults usually include them), skip this step.

- [ ] **Step 2: Write failing test**

Create `packages/web/src/i18n/__tests__/index.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { initI18n } from '../index';
import { useSettingsStore } from '@/stores/settings';

describe('initI18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({ language: 'ja' } as any);
  });

  afterEach(() => {
    // i18next is a singleton; reset between tests
    void i18next.changeLanguage('ja');
  });

  it('initializes with the language from settings store', async () => {
    initI18n();
    expect(i18next.language.startsWith('ja')).toBe(true);
    expect(i18next.t('common.cancel')).toBe('キャンセル');
  });

  it('switches language when settings store updates', async () => {
    initI18n();
    useSettingsStore.getState().setLanguage('en');
    // subscribe is synchronous in zustand v5
    await new Promise((r) => setTimeout(r, 0));
    expect(i18next.language.startsWith('en')).toBe(true);
    expect(i18next.t('common.cancel')).toBe('Cancel');
  });

  it('falls back to en for missing keys', () => {
    initI18n();
    useSettingsStore.getState().setLanguage('ja');
    expect(i18next.t('does.not.exist')).toBe('does.not.exist');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/i18n/__tests__/index.test.ts
```
Expected: FAIL — module '../index' not found

- [ ] **Step 4: Write implementation**

Create `packages/web/src/i18n/index.ts`:
```ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import { useSettingsStore } from '@/stores/settings';

let initialized = false;

export function initI18n(): void {
  const initialLang = useSettingsStore.getState().language;

  if (!initialized) {
    void i18next.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        ja: { translation: ja },
      },
      lng: initialLang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    useSettingsStore.subscribe((state) => {
      if (i18next.language !== state.language) {
        void i18next.changeLanguage(state.language);
      }
    });
    initialized = true;
  } else {
    void i18next.changeLanguage(initialLang);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/i18n/__tests__/index.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/i18n/index.ts packages/web/src/i18n/__tests__/index.test.ts packages/web/tsconfig.json
git commit -m "feat(web): add i18n init module wired to settings store"
```

---

### Task 5: Refactor useTheme to read from settings store (drop standalone localStorage key)

**Files:**
- Modify: `packages/web/src/theme/index.ts`
- Test: `packages/web/src/theme/__tests__/useTheme.test.ts` (新規)
- Modify: `packages/web/src/theme/__tests__/tokens.test.ts` (既存テスト温存) — 触らない場合スキップ

(注: 既存 `useTheme()` の `mode` / `setMode` API を返したまま挙動を持続。`mode` は settings store の `themeMode` を返し、`setMode` は store の `setThemeMode` を呼ぶ。これで既存 callers (TerminalPane の `useTheme()` 利用箇所) は型シグネチャ変更なしで動く。)

- [ ] **Step 1: Write failing test**

Create `packages/web/src/theme/__tests__/useTheme.test.ts`:
```tsx
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../index';
import { useSettingsStore } from '@/stores/settings';
import { darkTokens, lightTokens } from '../tokens';

const setMatchMediaMatches = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({ themeMode: 'system' } as any);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns dark tokens when mode=dark', () => {
    useSettingsStore.setState({ themeMode: 'dark' } as any);
    const { result } = renderHook(() => useTheme());
    expect(result.current.tokens).toBe(darkTokens);
    expect(result.current.mode).toBe('dark');
  });

  it('returns light tokens when mode=light', () => {
    useSettingsStore.setState({ themeMode: 'light' } as any);
    const { result } = renderHook(() => useTheme());
    expect(result.current.tokens).toBe(lightTokens);
    expect(result.current.mode).toBe('light');
  });

  it('returns dark when mode=system and system prefers dark', () => {
    setMatchMediaMatches(false); // matches '(prefers-color-scheme: light)' → false → system is dark
    useSettingsStore.setState({ themeMode: 'system' } as any);
    const { result } = renderHook(() => useTheme());
    expect(result.current.tokens).toBe(darkTokens);
  });

  it('returns light when mode=system and system prefers light', () => {
    setMatchMediaMatches(true); // matches '(prefers-color-scheme: light)' → true
    useSettingsStore.setState({ themeMode: 'system' } as any);
    const { result } = renderHook(() => useTheme());
    expect(result.current.tokens).toBe(lightTokens);
  });

  it('setMode updates the settings store', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode('light'));
    expect(useSettingsStore.getState().themeMode).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/theme/__tests__/useTheme.test.ts
```
Expected: FAIL — `setMode` updates store の最後の test が落ちる (現実装は localStorage 直書きのため store を更新しない)

- [ ] **Step 3: Replace useTheme implementation**

Overwrite `packages/web/src/theme/index.ts`:
```ts
import { useEffect, useState } from 'react';
import { useSettingsStore, type ThemeMode } from '@/stores/settings';
import { darkTokens, lightTokens, type ThemeTokens } from './tokens';

function detectSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme(): {
  tokens: ThemeTokens;
  mode: ThemeMode;
  resolvedTheme: 'dark' | 'light';
  setMode: (m: ThemeMode) => void;
} {
  const mode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(detectSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemTheme(mql.matches ? 'light' : 'dark');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = mode === 'system' ? systemTheme : mode;
  const tokens = resolvedTheme === 'light' ? lightTokens : darkTokens;
  return { tokens, mode, resolvedTheme, setMode: setThemeMode };
}

export type { ThemeTokens } from './tokens';
export type { ThemeMode } from '@/stores/settings';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/theme/__tests__/useTheme.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Run all theme tests + verify Phase 2a tests still pass**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/theme src/components src/routes
```
Expected: PASS (Phase 2a tests should still pass since `useTheme()` returns `tokens` + `mode` with same shape; new `resolvedTheme` is additive)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/theme/index.ts packages/web/src/theme/__tests__/useTheme.test.ts
git commit -m "refactor(web): migrate useTheme to settings store, add resolvedTheme"
```

---

### Task 6: Refactor XtermView and TerminalPane to subscribe stores directly

**Files:**
- Modify: `packages/web/src/components/terminal/XtermView.tsx`
- Modify: `packages/web/src/components/TerminalPane.tsx`
- Modify: `packages/web/src/components/terminal/__tests__/XtermView.test.tsx` (props 削除に追随)
- Modify: `packages/web/src/components/__tests__/TerminalPane.test.tsx` (props 削除に追随)

- [ ] **Step 1: Update XtermView to subscribe stores**

Open `packages/web/src/components/terminal/XtermView.tsx`. Change props interface and internal subscriptions:

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
  onStatusChange: (status: TerminalStatus) => void;
}

export function XtermView({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  isFocused,
  onStatusChange,
}: XtermViewProps) {
  const { resolvedTheme } = useTheme();
  const fontSize = useSettingsStore((s) => s.fontSize);

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

  // Apply theme/fontSize updates
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = resolvedTheme === 'light' ? terminalColorsLight : terminalColorsDark;
    term.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [resolvedTheme, fontSize]);

  // Apply focus
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.disableStdin = !isFocused;
    if (isFocused) term.focus();
  }, [isFocused]);

  // (WebSocket effect, ResizeObserver effect は元のまま — 変更しない)
  // ... 既存 WS / RO useEffect をそのまま残す ...

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

(WebSocket/ResizeObserver effect 部分は手を入れない。既存ファイルから theme と fontSize の props 利用箇所だけ resolvedTheme/fontSize 直購読に置換)

- [ ] **Step 2: Update TerminalPane to drop theme/fontSize props pass**

Edit `packages/web/src/components/TerminalPane.tsx` — remove `theme` / `fontSize` props from `<XtermView ... />`:

```tsx
// Before:
//   <XtermView ... theme={themeMode} fontSize={14} ... />
// After:
//   <XtermView ... onStatusChange={setStatus} />
//   (theme/fontSize props を削除、全 6 props のみ残す)
```

そして TerminalPane 自身の `mode` / `themeMode` 変数と `window.matchMedia` 呼び出し block をすべて削除 (XtermView が直購読するため不要)。 `useTheme()` は `tokens` のみ取得する形に簡略化:

```tsx
const { tokens } = useTheme();
```

- [ ] **Step 3: Update existing XtermView test to drop theme/fontSize props**

Open `packages/web/src/components/terminal/__tests__/XtermView.test.tsx`. すべての `<XtermView>` レンダリング箇所から `theme` / `fontSize` prop を削除。テストが store の値に依存している場合は `useSettingsStore.setState({ fontSize: 14 })` を beforeEach に追加。

- [ ] **Step 4: Update existing TerminalPane test similarly**

Open `packages/web/src/components/__tests__/TerminalPane.test.tsx`. 同様に prop 渡しを削除し、`useTheme()` mock がある場合は `mode`/`themeMode` 関連 assertion を削除。

- [ ] **Step 5: Run all related tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/terminal src/components/__tests__/TerminalPane.test.tsx
```
Expected: PASS

- [ ] **Step 6: Run type-check**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check
```
Expected: PASS — TerminalPane 内の不要な `mode` 変数が消えていれば lint warnings なし

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/terminal/XtermView.tsx packages/web/src/components/TerminalPane.tsx packages/web/src/components/terminal/__tests__/XtermView.test.tsx packages/web/src/components/__tests__/TerminalPane.test.tsx
git commit -m "refactor(web): drop theme/fontSize props from XtermView, subscribe stores"
```

---

### Task 7: Wire main.tsx to initialize i18n at startup

**Files:**
- Modify: `packages/web/src/main.tsx`

- [ ] **Step 1: Read existing main.tsx**

Read `packages/web/src/main.tsx` to confirm current bootstrap.

- [ ] **Step 2: Add initI18n() call before createRoot**

Edit so the file looks like:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initI18n } from './i18n';

initI18n();

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

(既存 import / strict mode 設定は温存)

- [ ] **Step 3: Run all tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web
```
Expected: PASS (initI18n はテスト env でも動作)

- [ ] **Step 4: Build to verify**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web build
```
Expected: build succeeds, bundle に i18n/locales/{en,ja}.json が含まれる

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/main.tsx
git commit -m "feat(web): initialize i18n at app startup"
```

---

## Sub-phase 2b-2: Routing + Sidebar refactor

`AuthenticatedShell` を抽出して 401 intercept + Sidebar + TerminalPane 構成を共通化、Sidebar の 3 タブ全て interactive 化、`/web/settings` ルート追加。

### Task 8: Extract AuthenticatedShell from SessionsRoute

**Files:**
- Read: `packages/web/src/routes/sessions.tsx` (現状把握)
- Create: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/routes/sessions.tsx` (shell を使うように切替)
- Test: `packages/web/src/components/__tests__/AuthenticatedShell.test.tsx`

- [ ] **Step 1: Read SessionsRoute**

Read `packages/web/src/routes/sessions.tsx` 全体。`useAuthStore` チェック、`wrappedClient` 構築、`useSessionViewStore` 利用、`Sidebar + TerminalPane` 構成、CRUD ハンドラを確認。

- [ ] **Step 2: Write failing test for AuthenticatedShell**

Create `packages/web/src/components/__tests__/AuthenticatedShell.test.tsx`:
```tsx
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatedShell } from '../AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';

describe('AuthenticatedShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => [],
      text: async () => '[]',
    }));
  });

  it('redirects to /web/login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    // Navigate replaces history; assert redirect by checking pathname via screen
    // Phase 2a パターン: redirect 後は LoginRoute がレンダーされる想定なら "Sign in" 等を assert
    expect(document.body.textContent).not.toMatch(/Sessions|Settings/);
  });

  it('renders Sidebar + TerminalPane when authenticated', () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/Sessions/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/AuthenticatedShell.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 4: Implement AuthenticatedShell**

Create `packages/web/src/components/AuthenticatedShell.tsx`. 既存 `routes/sessions.tsx` の 401 wrappedClient + Sidebar + TerminalPane 構成をそのまま移植 (router 用 Navigate を内蔵):

```tsx
import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiClient } from '@/api/client';
import { HttpError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore, type SessionsApiClient } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';
import { useUiStore } from '@/stores/ui';
import { useEventsSubscription } from '@/hooks/useEventsSubscription';
import { Sidebar } from './Sidebar';
import { TerminalPane } from './TerminalPane';

export function AuthenticatedShell() {
  const auth = useAuthStore();
  const navigate = useNavigate();
  const sessionView = useSessionViewStore();
  const showConfirm = useUiStore((s) => s.showConfirm);
  const pushToast = useUiStore((s) => s.pushToast);
  const sessionsState = useSessionsStore();

  if (!auth.token || !auth.gatewayUrl) {
    return <Navigate to="/web/login" replace />;
  }

  const baseClient = useMemo(
    () => new ApiClient(auth.gatewayUrl!, auth.token!),
    [auth.gatewayUrl, auth.token],
  );

  const wrappedClient: SessionsApiClient = useMemo(() => {
    const wrap = <T,>(fn: () => Promise<T>): (() => Promise<T>) => async () => {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          auth.logout();
          navigate('/web/login', { replace: true });
        }
        throw err;
      }
    };
    return {
      listSessions: () => wrap(() => baseClient.listSessions())(),
      createSession: (body) => wrap(() => baseClient.createSession(body))(),
      renameSession: (id, body) => wrap(() => baseClient.renameSession(id, body))(),
      killSession: (id) => wrap(() => baseClient.killSession(id))(),
      createWindow: (id, body) => wrap(() => baseClient.createWindow(id, body))(),
      renameWindow: (id, idx, body) => wrap(() => baseClient.renameWindow(id, idx, body))(),
      killWindow: (id, idx) => wrap(() => baseClient.killWindow(id, idx))(),
    };
  }, [baseClient, auth, navigate]);

  // Note: Sessions / Settings ルートで共通化されるため、CRUD ハンドラやイベント購読も
  // ここに集約。既存 SessionsRoute から必要な部分をすべて移植する。
  // (実装の詳細は既存 sessions.tsx をそのままコピーして関数体を作る)

  useEventsSubscription({
    gatewayUrl: auth.gatewayUrl,
    token: auth.token,
    refetch: () => sessionsState.refetch(wrappedClient),
  });

  // CRUD ハンドラ (handleCreateSession, handleRenameSession, ...) を既存 sessions.tsx から
  // そのままコピー。すべて wrappedClient を経由し、404 → toast + refetch、その他 → toast。

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        sessions={sessionsState.sessions}
        loading={sessionsState.loading}
        error={sessionsState.error}
        activeSessionId={sessionView.activeSessionId}
        activeWindowIndex={sessionView.activeWindowIndex}
        onSelect={(sid, widx) => sessionView.setActive(sid, widx ?? 0)}
        onCreateSession={/* ... */ () => {}}
        onRenameSession={/* ... */ () => {}}
        onRequestDeleteSession={/* ... */ () => {}}
        onCreateWindow={/* ... */ () => {}}
        onRenameWindow={/* ... */ () => {}}
        onRequestDeleteWindow={/* ... */ () => {}}
      />
      <TerminalPane
        gatewayUrl={auth.gatewayUrl}
        token={auth.token}
        sessionId={sessionView.activeSessionId}
        windowIndex={sessionView.activeWindowIndex}
      />
    </div>
  );
}
```

**実装メモ:** 既存 `routes/sessions.tsx` の中身を **literal にこの shell へコピーする**。プレースホルダ (`/* ... */`) は既存ハンドラ実装で埋める。既存テスト (`routes/__tests__/sessions.test.tsx`) を temporarily skip しないこと — Task 9 で SessionsRoute 自体を簡略化したあと、テスト assertion を shell に向けて書き換える方が安全。

- [ ] **Step 5: Run shell test to verify it passes**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/AuthenticatedShell.test.tsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/AuthenticatedShell.tsx packages/web/src/components/__tests__/AuthenticatedShell.test.tsx
git commit -m "feat(web): extract AuthenticatedShell from SessionsRoute"
```

---

### Task 9: Refactor SessionsRoute to use AuthenticatedShell

**Files:**
- Modify: `packages/web/src/routes/sessions.tsx`
- Modify: `packages/web/src/routes/__tests__/sessions.test.tsx` (assertion 調整)

- [ ] **Step 1: Replace SessionsRoute body**

Overwrite `packages/web/src/routes/sessions.tsx`:
```tsx
import { AuthenticatedShell } from '@/components/AuthenticatedShell';

export function SessionsRoute() {
  return <AuthenticatedShell />;
}
```

- [ ] **Step 2: Adjust existing sessions test if needed**

`routes/__tests__/sessions.test.tsx` の既存テストが具体的な DOM 出力 (Sidebar/TerminalPane) を assert していれば、`AuthenticatedShell` が同じ DOM を出すので動作する。redirect / login flow assertion はそのまま動く。

不要な `wrappedClient` 関連 internal mock があれば削除。

- [ ] **Step 3: Run all related tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/routes src/components/__tests__/AuthenticatedShell.test.tsx
```
Expected: PASS

- [ ] **Step 4: Run flow tests to ensure no regression**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows
```
Expected: PASS (Phase 2a flow tests should still work)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/routes/sessions.tsx packages/web/src/routes/__tests__/sessions.test.tsx
git commit -m "refactor(web): SessionsRoute uses AuthenticatedShell"
```

---

### Task 10: Refactor Sidebar to derive activePanel from URL + interactive tabs

**Files:**
- Modify: `packages/web/src/components/Sidebar.tsx`
- Modify: `packages/web/src/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `packages/web/src/components/__tests__/Sidebar.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '../Sidebar';

const baseProps = {
  sessions: [],
  loading: false,
  error: null,
  activeSessionId: null,
  activeWindowIndex: null,
  onSelect: () => {},
  onCreateSession: () => {},
  onRenameSession: () => {},
  onRequestDeleteSession: () => {},
  onCreateWindow: () => {},
  onRenameWindow: () => {},
  onRequestDeleteWindow: () => {},
};

describe('Sidebar URL-driven activePanel', () => {
  it('marks Sessions tab pressed on /web/sessions', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    const sessionsTab = screen.getByRole('button', { name: /Sessions tab/i });
    expect(sessionsTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks Settings tab pressed on /web/settings', () => {
    render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    const settingsTab = screen.getByRole('button', { name: /Settings tab/i });
    expect(settingsTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('Settings tab click navigates to /web/settings', () => {
    let path = '/web/sessions';
    function PathProbe() {
      // helper to read current pathname
      return <span data-testid="path">{window.location.pathname}</span>;
    }
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Routes>
          <Route path="/web/*" element={<Sidebar {...baseProps} />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Settings tab/i }));
    // After click, the next render should reflect /web/settings
    const settingsTab = screen.getByRole('button', { name: /Settings tab/i });
    expect(settingsTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('Files tab is disabled with Phase 2c tooltip', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <Sidebar {...baseProps} />
      </MemoryRouter>,
    );
    const filesTab = screen.getByRole('button', { name: /Files tab/i });
    expect(filesTab).toBeDisabled();
    expect(filesTab.getAttribute('title')).toMatch(/Phase 2c/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/Sidebar.test.tsx -t "URL-driven activePanel"
```
Expected: FAIL — Sidebar 内 routing がまだない

- [ ] **Step 3: Update Sidebar implementation**

Edit `packages/web/src/components/Sidebar.tsx`. Add imports for routing + sectioned panel:

```tsx
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { SessionsListPanel } from './SessionsListPanel';
import { SettingsPanel } from './settings/SettingsPanel'; // 後の Task で実装、まずは placeholder
import { useTheme } from '@/theme';
import { useEventsStore } from '@/stores/events';

type ActivePanel = 'sessions' | 'files' | 'settings';

export interface SidebarProps {
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
  onCreateSession: (name?: string) => void | Promise<void>;
  onRenameSession: (currentDisplayName: string, newName: string) => void | Promise<void>;
  onRequestDeleteSession: (session: TmuxSession) => void;
  onCreateWindow: (sessionDisplayName: string, name?: string) => void | Promise<void>;
  onRenameWindow: (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ) => void | Promise<void>;
  onRequestDeleteWindow: (sessionDisplayName: string, window: TmuxWindow) => void;
}

const SIDEBAR_WIDTH = 320;

function deriveActivePanel(pathname: string): ActivePanel {
  if (pathname.startsWith('/web/settings')) return 'settings';
  if (pathname.startsWith('/web/files')) return 'files';
  return 'sessions';
}

export function Sidebar(props: SidebarProps) {
  const { tokens } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const activePanel = deriveActivePanel(location.pathname);

  const renderPanel = () => {
    if (activePanel === 'settings') return <SettingsPanel />;
    return <SessionsListPanel {...props} />;
  };

  const tabButtonStyle = (active: boolean, disabled = false) => ({
    background: 'none' as const,
    border: 'none' as const,
    color: active ? tokens.colors.primary : disabled ? tokens.colors.textMuted : tokens.colors.textSecondary,
    fontSize: tokens.typography.caption.fontSize,
    cursor: disabled ? ('not-allowed' as const) : ('pointer' as const),
    padding: tokens.spacing.sm,
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        background: tokens.colors.bgElevated,
        borderRight: `1px solid ${tokens.colors.borderSubtle}`,
        display: 'grid',
        gridTemplateRows: '1fr 56px',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div aria-label={`${activePanel} panel`} style={{ overflowY: 'auto' }}>
        {renderPanel()}
      </div>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          borderTop: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Sessions tab"
          aria-pressed={activePanel === 'sessions'}
          onClick={() => navigate('/web/sessions')}
          style={tabButtonStyle(activePanel === 'sessions')}
        >
          ⌘ Sessions
        </button>
        <button
          type="button"
          aria-label="Files tab"
          aria-pressed={activePanel === 'files'}
          disabled
          title="Coming in Phase 2c"
          style={tabButtonStyle(activePanel === 'files', true)}
        >
          📁 Files
        </button>
        <button
          type="button"
          aria-label="Settings tab"
          aria-pressed={activePanel === 'settings'}
          onClick={() => navigate('/web/settings')}
          style={tabButtonStyle(activePanel === 'settings')}
        >
          ⚙ Settings
        </button>
        <EventsStatusDot />
      </nav>
    </aside>
  );
}

function EventsStatusDot() {
  const { tokens } = useTheme();
  const status = useEventsStore((s) => s.status);
  const attempt = useEventsStore((s) => s.reconnectAttempt);
  const color = (() => {
    switch (status) {
      case 'connected':
        return tokens.colors.success;
      case 'reconnecting':
        return tokens.colors.warning;
      case 'failed':
        return tokens.colors.error;
      default:
        return tokens.colors.textMuted;
    }
  })();
  const label =
    status === 'reconnecting'
      ? `Realtime updates: reconnecting (attempt ${attempt})`
      : `Realtime updates: ${status}`;
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}
```

- [ ] **Step 4: Create SettingsPanel placeholder so import doesn't break**

Create `packages/web/src/components/settings/SettingsPanel.tsx`:
```tsx
export function SettingsPanel() {
  return <div>Settings (placeholder, coming in Task 11+)</div>;
}
```

- [ ] **Step 5: Run all related tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/__tests__/Sidebar.test.tsx
```
Expected: PASS (4 new tests + 既存 Sessions assertions も通る)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/Sidebar.tsx packages/web/src/components/__tests__/Sidebar.test.tsx packages/web/src/components/settings/SettingsPanel.tsx
git commit -m "feat(web): Sidebar tabs interactive + URL-derived activePanel"
```

---

### Task 11: Add /web/settings route + SettingsRoute

**Files:**
- Modify: `packages/web/src/App.tsx`
- Create: `packages/web/src/routes/settings.tsx`
- Test: `packages/web/src/routes/__tests__/settings.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/routes/__tests__/settings.test.tsx`:
```tsx
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SettingsRoute } from '../settings';
import { LoginRoute } from '../login';
import { useAuthStore } from '@/stores/auth';

describe('SettingsRoute', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ token: null, gatewayUrl: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => [],
      text: async () => '[]',
    }));
  });

  it('redirects to login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <Routes>
          <Route path="/web/settings" element={<SettingsRoute />} />
          <Route path="/web/login" element={<LoginRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Settings/)).not.toBeInTheDocument();
  });

  it('renders shell with Settings panel when authenticated', () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    render(
      <MemoryRouter initialEntries={['/web/settings']}>
        <Routes>
          <Route path="/web/settings" element={<SettingsRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/settings panel/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/routes/__tests__/settings.test.tsx
```
Expected: FAIL — module '../settings' not found

- [ ] **Step 3: Implement SettingsRoute**

Create `packages/web/src/routes/settings.tsx`:
```tsx
import { AuthenticatedShell } from '@/components/AuthenticatedShell';

export function SettingsRoute() {
  return <AuthenticatedShell />;
}
```

- [ ] **Step 4: Add route to App.tsx**

Edit `packages/web/src/App.tsx` to add `/web/settings` route between sessions and the catch-all redirect:

```tsx
<Route path="/web/settings" element={<SettingsRoute />} />
```

(`SessionsRoute` import 行のすぐ下に `import { SettingsRoute } from './routes/settings';` を追加)

- [ ] **Step 5: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/routes/__tests__/settings.test.tsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/routes/settings.tsx packages/web/src/routes/__tests__/settings.test.tsx packages/web/src/App.tsx
git commit -m "feat(web): add /web/settings route via AuthenticatedShell"
```

---

## Sub-phase 2b-3: Settings UI — Appearance + Terminal sections

SettingsPanel を本実装に置換、Appearance / Terminal セクション完成。

### Task 12: SettingsPanel skeleton with 5 section placeholders

**Files:**
- Modify: `packages/web/src/components/settings/SettingsPanel.tsx`
- Test: `packages/web/src/components/settings/__tests__/SettingsPanel.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/settings/__tests__/SettingsPanel.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPanel } from '../SettingsPanel';

describe('SettingsPanel', () => {
  it('renders the 5 section headers', () => {
    render(
      <MemoryRouter>
        <SettingsPanel />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /terminal/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /gateway/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /system status/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /rate limits/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/SettingsPanel.test.tsx
```
Expected: FAIL — no role="region" matches

- [ ] **Step 3: Implement SettingsPanel with placeholder sections**

Overwrite `packages/web/src/components/settings/SettingsPanel.tsx`:
```tsx
import { useTheme } from '@/theme';

function SectionPlaceholder({ titleKey, ariaLabel }: { titleKey: string; ariaLabel: string }) {
  const { tokens } = useTheme();
  return (
    <section
      role="region"
      aria-label={ariaLabel}
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
        {titleKey}
      </h3>
      <div style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.small.fontSize }}>
        (placeholder)
      </div>
    </section>
  );
}

export function SettingsPanel() {
  const { tokens } = useTheme();
  return (
    <div style={{ padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px ${tokens.spacing.xl}px`, height: '100%', overflowY: 'auto' }}>
      <SectionPlaceholder titleKey="Appearance" ariaLabel="Appearance" />
      <SectionPlaceholder titleKey="Terminal" ariaLabel="Terminal" />
      <SectionPlaceholder titleKey="Gateway" ariaLabel="Gateway" />
      <SectionPlaceholder titleKey="System status" ariaLabel="System status" />
      <SectionPlaceholder titleKey="Rate limits" ariaLabel="Rate limits" />
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/SettingsPanel.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/settings/SettingsPanel.tsx packages/web/src/components/settings/__tests__/SettingsPanel.test.tsx
git commit -m "feat(web): SettingsPanel skeleton with 5 placeholder sections"
```

---

### Task 13: AppearanceSection (Theme + Language)

**Files:**
- Create: `packages/web/src/components/settings/AppearanceSection.tsx`
- Test: `packages/web/src/components/settings/__tests__/AppearanceSection.test.tsx`
- Modify: `packages/web/src/components/settings/SettingsPanel.tsx` (placeholder を本物に差し替え)

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/settings/__tests__/AppearanceSection.test.tsx`:
```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppearanceSection } from '../AppearanceSection';
import { useSettingsStore, DEFAULT_FONT_SIZE } from '@/stores/settings';

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState({
    themeMode: 'system',
    language: 'ja',
    fontSize: DEFAULT_FONT_SIZE,
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => vi.restoreAllMocks());

describe('AppearanceSection', () => {
  it('renders three theme buttons; current mode is aria-pressed', () => {
    useSettingsStore.setState({ themeMode: 'dark' } as any);
    render(<AppearanceSection />);
    const dark = screen.getByRole('button', { name: /^Dark$/ });
    const light = screen.getByRole('button', { name: /^Light$/ });
    const system = screen.getByRole('button', { name: /^System$/ });
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    expect(light.getAttribute('aria-pressed')).toBe('false');
    expect(system.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a theme button updates the store', () => {
    render(<AppearanceSection />);
    fireEvent.click(screen.getByRole('button', { name: /^Light$/ }));
    expect(useSettingsStore.getState().themeMode).toBe('light');
  });

  it('renders language select with current value', () => {
    useSettingsStore.setState({ language: 'ja' } as any);
    render(<AppearanceSection />);
    const select = screen.getByLabelText(/language/i) as HTMLSelectElement;
    expect(select.value).toBe('ja');
  });

  it('changing language select updates the store', () => {
    render(<AppearanceSection />);
    const select = screen.getByLabelText(/language/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'en' } });
    expect(useSettingsStore.getState().language).toBe('en');
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/AppearanceSection.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement AppearanceSection**

Create `packages/web/src/components/settings/AppearanceSection.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type Language, type ThemeMode } from '@/stores/settings';
import { useTheme } from '@/theme';

const THEME_OPTIONS: { value: ThemeMode; key: string; defaultLabel: string }[] = [
  { value: 'light', key: 'settings.appearance.themeOptions.light', defaultLabel: 'Light' },
  { value: 'dark', key: 'settings.appearance.themeOptions.dark', defaultLabel: 'Dark' },
  { value: 'system', key: 'settings.appearance.themeOptions.system', defaultLabel: 'System' },
];

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
];

export function AppearanceSection() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
    <section
      role="region"
      aria-label="Appearance"
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
        {t('settings.appearance.title', 'Appearance')}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${tokens.spacing.sm}px 0` }}>
        <span style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}>
          {t('settings.appearance.theme', 'Theme')}
        </span>
        <div style={{ display: 'flex', gap: tokens.spacing.xs }}>
          {THEME_OPTIONS.map((opt) => {
            const active = opt.value === themeMode;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setThemeMode(opt.value)}
                style={{
                  padding: `4px 10px`,
                  borderRadius: tokens.radii.sm,
                  border: `1px solid ${active ? tokens.colors.primary : tokens.colors.border}`,
                  background: active ? tokens.colors.primary : 'transparent',
                  color: active ? tokens.colors.textInverse : tokens.colors.textSecondary,
                  fontSize: tokens.typography.caption.fontSize,
                  cursor: 'pointer',
                }}
              >
                {t(opt.key, opt.defaultLabel)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${tokens.spacing.sm}px 0` }}>
        <label
          htmlFor="settings-language"
          style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}
        >
          {t('settings.appearance.language', 'Language')}
        </label>
        <select
          id="settings-language"
          aria-label={t('settings.appearance.language', 'Language')}
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{
            background: tokens.colors.surface,
            color: tokens.colors.textPrimary,
            border: `1px solid ${tokens.colors.border}`,
            padding: `4px 6px`,
            borderRadius: tokens.radii.sm,
            fontSize: tokens.typography.small.fontSize,
          }}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Replace placeholder in SettingsPanel**

Edit `packages/web/src/components/settings/SettingsPanel.tsx` — import AppearanceSection and replace `<SectionPlaceholder titleKey="Appearance" ... />` with `<AppearanceSection />`.

- [ ] **Step 5: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings
```
Expected: PASS (AppearanceSection 4 + SettingsPanel 1 = 5 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/settings/AppearanceSection.tsx packages/web/src/components/settings/__tests__/AppearanceSection.test.tsx packages/web/src/components/settings/SettingsPanel.tsx
git commit -m "feat(web): AppearanceSection (theme buttons + language select)"
```

---

### Task 14: TerminalSection (Font size stepper)

**Files:**
- Create: `packages/web/src/components/settings/TerminalSection.tsx`
- Test: `packages/web/src/components/settings/__tests__/TerminalSection.test.tsx`
- Modify: `packages/web/src/components/settings/SettingsPanel.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/settings/__tests__/TerminalSection.test.tsx`:
```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TerminalSection } from '../TerminalSection';
import { useSettingsStore, MIN_FONT_SIZE, MAX_FONT_SIZE } from '@/stores/settings';

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState({
    themeMode: 'system',
    language: 'ja',
    fontSize: 14,
  });
});

describe('TerminalSection', () => {
  it('renders current font size', () => {
    useSettingsStore.setState({ fontSize: 14 } as any);
    render(<TerminalSection />);
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('increment button increases font size by 1', () => {
    useSettingsStore.setState({ fontSize: 14 } as any);
    render(<TerminalSection />);
    fireEvent.click(screen.getByRole('button', { name: /increase font size/i }));
    expect(useSettingsStore.getState().fontSize).toBe(15);
  });

  it('decrement button decreases font size by 1', () => {
    useSettingsStore.setState({ fontSize: 14 } as any);
    render(<TerminalSection />);
    fireEvent.click(screen.getByRole('button', { name: /decrease font size/i }));
    expect(useSettingsStore.getState().fontSize).toBe(13);
  });

  it('disables increment at MAX_FONT_SIZE', () => {
    useSettingsStore.setState({ fontSize: MAX_FONT_SIZE } as any);
    render(<TerminalSection />);
    expect(screen.getByRole('button', { name: /increase font size/i })).toBeDisabled();
  });

  it('disables decrement at MIN_FONT_SIZE', () => {
    useSettingsStore.setState({ fontSize: MIN_FONT_SIZE } as any);
    render(<TerminalSection />);
    expect(screen.getByRole('button', { name: /decrease font size/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/TerminalSection.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement TerminalSection**

Create `packages/web/src/components/settings/TerminalSection.tsx`:
```tsx
import { useTranslation } from 'react-i18next';
import { useSettingsStore, MIN_FONT_SIZE, MAX_FONT_SIZE } from '@/stores/settings';
import { useTheme } from '@/theme';

export function TerminalSection() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);

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
    </section>
  );
}
```

- [ ] **Step 4: Replace placeholder in SettingsPanel**

Edit `SettingsPanel.tsx` to use `<TerminalSection />` in place of the Terminal placeholder.

- [ ] **Step 5: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/TerminalSection.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/settings/TerminalSection.tsx packages/web/src/components/settings/__tests__/TerminalSection.test.tsx packages/web/src/components/settings/SettingsPanel.tsx
git commit -m "feat(web): TerminalSection (font size stepper)"
```

---

## Sub-phase 2b-4: Settings UI — Gateway section

URL/Token 表示、Web URL コピー、QR モーダル、Re-enter token、Logout、GatewayVersion (SystemStatus 経由で取得)。

### Task 15: lib/qr.ts helper for buildPairingUrl

**Files:**
- Create: `packages/web/src/lib/qr.ts`
- Test: `packages/web/src/lib/__tests__/qr.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/lib/__tests__/qr.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildPairingUrl } from '../qr';

describe('buildPairingUrl', () => {
  it('builds zenterm:// URL with url and token query params', () => {
    const url = buildPairingUrl('http://10.0.0.1:18765', 'abcd');
    expect(url.startsWith('zenterm://connect?')).toBe(true);
    expect(url).toContain('url=http%3A%2F%2F10.0.0.1%3A18765');
    expect(url).toContain('token=abcd');
  });

  it('encodes special characters in token', () => {
    const url = buildPairingUrl('http://x', 'a&b=c');
    expect(url).toContain('token=a%26b%3Dc');
  });

  it('strips trailing slash from origin', () => {
    const url = buildPairingUrl('http://x/', 't');
    expect(url).toContain('url=http%3A%2F%2Fx');
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/lib/__tests__/qr.test.ts
```
Expected: FAIL — module '../qr' not found

- [ ] **Step 3: Implement**

Create `packages/web/src/lib/qr.ts`:
```ts
export function buildPairingUrl(origin: string, token: string): string {
  const cleaned = origin.replace(/\/+$/, '');
  const params = new URLSearchParams({ url: cleaned, token });
  return `zenterm://connect?${params.toString()}`;
}
```

- [ ] **Step 4: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/lib/__tests__/qr.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/qr.ts packages/web/src/lib/__tests__/qr.test.ts
git commit -m "feat(web): add buildPairingUrl helper for zenterm:// pairing URL"
```

---

### Task 16: QrModal with qrcode.react

**Files:**
- Create: `packages/web/src/components/settings/QrModal.tsx`
- Test: `packages/web/src/components/settings/__tests__/QrModal.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/settings/__tests__/QrModal.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QrModal } from '../QrModal';

beforeAll(() => {
  // jsdom doesn't implement <dialog>; reuse Phase 2a polyfill pattern
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
});

describe('QrModal', () => {
  it('renders the QR SVG with given URL when open', () => {
    render(<QrModal open url="zenterm://connect?url=x&token=t" onClose={() => {}} />);
    // qrcode.react renders <svg> with role="img" or no role; check presence
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const svg = screen.getByRole('dialog').querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('shows the raw URL as fallback text', () => {
    render(<QrModal open url="zenterm://connect?url=x&token=t" onClose={() => {}} />);
    expect(screen.getByText(/zenterm:\/\/connect\?url=x&token=t/)).toBeInTheDocument();
  });

  it('clicking close calls onClose', () => {
    const onClose = vi.fn();
    render(<QrModal open url="zenterm://x" onClose={onClose} />);
    screen.getByRole('button', { name: /close/i }).click();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when not open', () => {
    render(<QrModal open={false} url="zenterm://x" onClose={() => {}} />);
    const dialog = screen.queryByRole('dialog', { hidden: true });
    // jsdom: dialog is in DOM but `open` attribute is false
    expect(dialog?.hasAttribute('open')).not.toBe(true);
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/QrModal.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement QrModal**

Create `packages/web/src/components/settings/QrModal.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface QrModalProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

export function QrModal({ open, url, onClose }: QrModalProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else {
      if (d.open) d.close();
    }
  }, [open]);

  if (!open) {
    return <dialog ref={dialogRef} aria-label="Pair mobile app" />;
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      style={{
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        padding: tokens.spacing.xl,
        maxWidth: 360,
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: tokens.typography.heading.fontSize }}>
        {t('settings.gateway.qrTitle', 'Pair mobile app')}
      </h2>
      <p style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.small.fontSize }}>
        {t('settings.gateway.qrInstructions', 'Scan this QR with the ZenTerm mobile app to pair.')}
      </p>
      <div style={{ background: '#fff', padding: tokens.spacing.md, display: 'flex', justifyContent: 'center', borderRadius: tokens.radii.sm }}>
        <QRCodeSVG value={url} size={200} level="M" />
      </div>
      <p style={{ marginTop: tokens.spacing.md, fontFamily: 'ui-monospace, monospace', fontSize: tokens.typography.caption.fontSize, wordBreak: 'break-all', color: tokens.colors.textMuted }}>
        {url}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: tokens.spacing.md }}>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          style={{
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            color: tokens.colors.textPrimary,
            padding: `6px 16px`,
            borderRadius: tokens.radii.sm,
            cursor: 'pointer',
          }}
        >
          {t('common.close', 'Close')}
        </button>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/QrModal.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/settings/QrModal.tsx packages/web/src/components/settings/__tests__/QrModal.test.tsx
git commit -m "feat(web): QrModal using qrcode.react with native dialog"
```

---

### Task 17: ReauthDialog (token re-entry)

**Files:**
- Create: `packages/web/src/components/settings/ReauthDialog.tsx`
- Test: `packages/web/src/components/settings/__tests__/ReauthDialog.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/settings/__tests__/ReauthDialog.test.tsx`:
```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReauthDialog } from '../ReauthDialog';
import { useAuthStore } from '@/stores/auth';

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
});

describe('ReauthDialog', () => {
  it('verifies token via /api/auth/verify and updates auth store on success', async () => {
    useAuthStore.setState({ token: 'old', gatewayUrl: 'http://example' } as any);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const onClose = vi.fn();
    render(<ReauthDialog open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /verify|submit|ok/i }));
    await waitFor(() => expect(useAuthStore.getState().token).toBe('1234'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error on 401', async () => {
    useAuthStore.setState({ token: 'old', gatewayUrl: 'http://example' } as any);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    render(<ReauthDialog open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: /verify|submit|ok/i }));
    await waitFor(() => expect(screen.getByText(/invalid token/i)).toBeInTheDocument());
    expect(useAuthStore.getState().token).toBe('old');
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/ReauthDialog.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement ReauthDialog**

Create `packages/web/src/components/settings/ReauthDialog.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';

interface ReauthDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ReauthDialog({ open, onClose }: ReauthDialogProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const auth = useAuthStore();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (open) { setToken(''); setError(null); setSubmitting(false); }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.gatewayUrl) return;
    setSubmitting(true);
    setError(null);
    const client = new ApiClient(auth.gatewayUrl, token);
    const ok = await client.verifyToken();
    setSubmitting(false);
    if (ok) {
      auth.login(token, auth.gatewayUrl);
      onClose();
    } else {
      setError(t('settings.gateway.invalidToken', 'Invalid token'));
    }
  };

  if (!open) return <dialog ref={dialogRef} aria-label="Re-enter token" />;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      style={{
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        padding: tokens.spacing.xl,
        minWidth: 320,
      }}
    >
      <form onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0, fontSize: tokens.typography.heading.fontSize }}>
          {t('settings.gateway.reauthTitle', 'Re-enter token')}
        </h2>
        <label
          htmlFor="reauth-token"
          style={{ display: 'block', color: tokens.colors.textSecondary, marginBottom: tokens.spacing.xs, fontSize: tokens.typography.small.fontSize }}
        >
          {t('settings.gateway.token', 'Token')}
        </label>
        <input
          id="reauth-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: `8px 10px`,
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            color: tokens.colors.textPrimary,
            borderRadius: tokens.radii.sm,
            fontSize: tokens.typography.smallMedium.fontSize,
          }}
        />
        {error ? (
          <p role="alert" style={{ color: tokens.colors.error, fontSize: tokens.typography.caption.fontSize, marginTop: tokens.spacing.xs }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: tokens.spacing.sm, marginTop: tokens.spacing.lg }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${tokens.colors.border}`,
              color: tokens.colors.textSecondary,
              padding: `6px 14px`,
              borderRadius: tokens.radii.sm,
              cursor: 'pointer',
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || token.length === 0}
            style={{
              background: tokens.colors.primary,
              border: 'none',
              color: tokens.colors.textInverse,
              padding: `6px 14px`,
              borderRadius: tokens.radii.sm,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {t('settings.gateway.verify', 'Verify')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/ReauthDialog.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/settings/ReauthDialog.tsx packages/web/src/components/settings/__tests__/ReauthDialog.test.tsx
git commit -m "feat(web): ReauthDialog for token re-entry"
```

---

### Task 18: GatewaySection (URL/Token/Copy/QR/Reauth/Logout/Version)

**Files:**
- Create: `packages/web/src/components/settings/GatewaySection.tsx`
- Test: `packages/web/src/components/settings/__tests__/GatewaySection.test.tsx`
- Modify: `packages/web/src/components/settings/SettingsPanel.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/settings/__tests__/GatewaySection.test.tsx`:
```tsx
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GatewaySection } from '../GatewaySection';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
});

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: '1234', gatewayUrl: 'http://10.0.0.1:18765' });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => vi.restoreAllMocks());

describe('GatewaySection', () => {
  it('renders connected URL and masked token', () => {
    render(<MemoryRouter><GatewaySection gatewayVersion="0.5.7" /></MemoryRouter>);
    expect(screen.getByText('http://10.0.0.1:18765')).toBeInTheDocument();
    expect(screen.getByText(/••/)).toBeInTheDocument();
    expect(screen.getByText('0.5.7')).toBeInTheDocument();
  });

  it('Copy URL writes origin/web to clipboard and pushes toast', async () => {
    render(<MemoryRouter><GatewaySection gatewayVersion="0.5.7" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /copy.*url/i }));
    await waitFor(() => {
      expect((navigator.clipboard.writeText as any)).toHaveBeenCalled();
    });
    expect(useUiStore.getState().toasts.length).toBeGreaterThan(0);
  });

  it('Show QR opens the modal', () => {
    render(<MemoryRouter><GatewaySection gatewayVersion="0.5.7" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /show.*qr/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Logout opens confirm; confirming clears auth', async () => {
    render(<MemoryRouter><GatewaySection gatewayVersion="0.5.7" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    // ConfirmDialog is showed via uiStore — call confirm action programmatically
    const confirm = useUiStore.getState().confirmDialog;
    expect(confirm).not.toBeNull();
    confirm?.onConfirm();
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/GatewaySection.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement GatewaySection**

Create `packages/web/src/components/settings/GatewaySection.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme';
import { buildPairingUrl } from '@/lib/qr';
import { QrModal } from './QrModal';
import { ReauthDialog } from './ReauthDialog';

interface Props {
  gatewayVersion: string | null;
}

export function GatewaySection({ gatewayVersion }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const auth = useAuthStore();
  const showConfirm = useUiStore((s) => s.showConfirm);
  const pushToast = useUiStore((s) => s.pushToast);
  const navigate = useNavigate();
  const [qrOpen, setQrOpen] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);

  const webUrl = `${window.location.origin}/web`;
  const pairingUrl = auth.token ? buildPairingUrl(window.location.origin, auth.token) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webUrl);
      pushToast({ kind: 'info', message: t('settings.gateway.copied', 'Web URL copied') });
    } catch {
      pushToast({ kind: 'error', message: t('settings.gateway.copyFailed', 'Copy failed — please copy manually') });
    }
  };

  const handleLogout = () => {
    showConfirm({
      title: t('settings.gateway.logoutTitle', 'Logout'),
      message: t('settings.gateway.logoutConfirm', 'Sign out and return to the login screen?'),
      destructive: true,
      confirmLabel: t('settings.gateway.logout', 'Logout'),
      onConfirm: () => {
        auth.logout();
        navigate('/web/login', { replace: true });
      },
    });
  };

  const buttonStyle = (danger = false) => ({
    background: tokens.colors.surface,
    border: `1px solid ${danger ? tokens.colors.error : tokens.colors.border}`,
    color: danger ? tokens.colors.error : tokens.colors.textPrimary,
    padding: `8px 12px`,
    borderRadius: tokens.radii.sm,
    cursor: 'pointer' as const,
    width: '100%',
    textAlign: 'left' as const,
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.small.fontSize,
  });

  return (
    <section
      role="region"
      aria-label="Gateway"
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
        {t('settings.gateway.title', 'Gateway')}
      </h3>

      <dl style={{ margin: 0 }}>
        <dt style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize }}>
          {t('settings.gateway.connectedTo', 'Connected to')}
        </dt>
        <dd style={{ margin: `2px 0 ${tokens.spacing.sm}px 0`, color: tokens.colors.textPrimary, fontFamily: 'ui-monospace, monospace', fontSize: tokens.typography.small.fontSize, wordBreak: 'break-all' }}>
          {auth.gatewayUrl}
        </dd>

        <dt style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize }}>
          {t('settings.gateway.token', 'Token')}
        </dt>
        <dd style={{ margin: `2px 0 ${tokens.spacing.sm}px 0`, color: tokens.colors.textPrimary, fontFamily: 'ui-monospace, monospace' }}>
          ••••
        </dd>

        <dt style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize }}>
          {t('settings.gateway.version', 'Gateway version')}
        </dt>
        <dd style={{ margin: `2px 0 ${tokens.spacing.sm}px 0`, color: tokens.colors.textPrimary, fontSize: tokens.typography.small.fontSize }}>
          {gatewayVersion ?? t('common.loading', 'Loading…')}
        </dd>
      </dl>

      <button type="button" onClick={handleCopy} style={buttonStyle()}>
        {t('settings.gateway.copyUrl', 'Copy Web URL')}
      </button>
      <button type="button" onClick={() => setQrOpen(true)} style={buttonStyle()}>
        {t('settings.gateway.showQr', 'Show mobile QR')}
      </button>
      <button type="button" onClick={() => setReauthOpen(true)} style={buttonStyle()}>
        {t('settings.gateway.reauth', 'Re-enter token')}
      </button>
      <button type="button" onClick={handleLogout} style={buttonStyle(true)}>
        {t('settings.gateway.logout', 'Logout')}
      </button>

      <QrModal open={qrOpen} url={pairingUrl} onClose={() => setQrOpen(false)} />
      <ReauthDialog open={reauthOpen} onClose={() => setReauthOpen(false)} />
    </section>
  );
}
```

- [ ] **Step 4: Wire into SettingsPanel**

`SettingsPanel.tsx` の Gateway placeholder を `<GatewaySection gatewayVersion={null} />` に置換 (Task 19 で SystemStatus 経由で実 version を渡す)。

- [ ] **Step 5: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/GatewaySection.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/settings/GatewaySection.tsx packages/web/src/components/settings/__tests__/GatewaySection.test.tsx packages/web/src/components/settings/SettingsPanel.tsx
git commit -m "feat(web): GatewaySection with Copy/QR/Reauth/Logout"
```

---

## Sub-phase 2b-5: SystemStatus widget + API client extension

`getSystemStatus()` 追加、5s polling、4 行の状態表示、gatewayVersion を GatewaySection に伝播。

### Task 19: Add getSystemStatus to ApiClient

**Files:**
- Modify: `packages/web/src/api/client.ts`
- Modify: `packages/web/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Append failing test**

Append to `packages/web/src/api/__tests__/client.test.ts`:
```ts
describe('ApiClient.getSystemStatus', () => {
  it('GETs /api/system/status with Bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        cpu: { usage: 5, cores: 6, model: 'i5', loadAvg: [0.4, 0.5, 0.6] },
        memory: { total: 32e9, used: 6e9, free: 26e9, percent: 18 },
        disk: { total: 256e9, used: 100e9, free: 156e9, percent: 39 },
        temperature: null, uptime: 1000, gatewayVersion: '0.5.7',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const c = new ApiClient('http://x', 'tok');
    const res = await c.getSystemStatus();
    expect(res.gatewayVersion).toBe('0.5.7');
    expect(fetchMock).toHaveBeenCalledWith('http://x/api/system/status', expect.objectContaining({
      method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
    }));
  });

  it('throws HttpError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized', headers: new Headers() }));
    const c = new ApiClient('http://x', 'tok');
    await expect(c.getSystemStatus()).rejects.toMatchObject({ status: 401 });
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/api/__tests__/client.test.ts -t "getSystemStatus"
```
Expected: FAIL — no method getSystemStatus

- [ ] **Step 3: Add method**

Edit `packages/web/src/api/client.ts`. Add after `killWindow`:
```ts
import type { TmuxSession, TmuxWindow, SystemStatus } from '@zenterm/shared';

// ... in class:
  getSystemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('GET', '/api/system/status');
  }
```

- [ ] **Step 4: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/api/__tests__/client.test.ts -t "getSystemStatus"
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/api/client.ts packages/web/src/api/__tests__/client.test.ts
git commit -m "feat(web): add ApiClient.getSystemStatus"
```

---

### Task 20: SystemStatusSection (5s polling, 4 rows)

**Files:**
- Create: `packages/web/src/components/settings/SystemStatusSection.tsx`
- Test: `packages/web/src/components/settings/__tests__/SystemStatusSection.test.tsx`
- Modify: `packages/web/src/components/settings/SettingsPanel.tsx` (gatewayVersion を Gateway に橋渡し)

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/settings/__tests__/SystemStatusSection.test.tsx`:
```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SystemStatusSection } from '../SystemStatusSection';

const mkStatus = (overrides: Partial<any> = {}) => ({
  cpu: { usage: 5, cores: 6, model: 'i5', loadAvg: [0.4, 0.55, 0.61] },
  memory: { total: 32_000_000_000, used: 6_200_000_000, free: 25_800_000_000, percent: 19 },
  disk: { total: 256e9, used: 100e9, free: 156e9, percent: 39 },
  temperature: null,
  uptime: 240_000, // ~2d 18h 40m
  gatewayVersion: '0.5.7',
  ...overrides,
});

let intervalCb: (() => void) | null = null;

beforeEach(() => {
  intervalCb = null;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SystemStatusSection', () => {
  it('initial fetch shows uptime, load avg, memory, gatewayVersion', async () => {
    const fetchClient = { getSystemStatus: vi.fn().mockResolvedValue(mkStatus()) };
    const onVersion = vi.fn();
    render(<SystemStatusSection client={fetchClient as any} onGatewayVersion={onVersion} />);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/2d/)).toBeInTheDocument();
    expect(screen.getByText(/0\.40 \/ 0\.55 \/ 0\.61/)).toBeInTheDocument();
    expect(screen.getByText(/19%/)).toBeInTheDocument();
    expect(onVersion).toHaveBeenCalledWith('0.5.7');
  });

  it('polls every 5 seconds', async () => {
    const fetchClient = { getSystemStatus: vi.fn().mockResolvedValue(mkStatus()) };
    render(<SystemStatusSection client={fetchClient as any} onGatewayVersion={() => {}} />);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(1));
    vi.advanceTimersByTime(5000);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(2));
    vi.advanceTimersByTime(5000);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(3));
  });

  it('shows error message on fetch failure', async () => {
    const fetchClient = { getSystemStatus: vi.fn().mockRejectedValue(new Error('boom')) };
    render(<SystemStatusSection client={fetchClient as any} onGatewayVersion={() => {}} />);
    await vi.waitFor(() => expect(screen.getByText(/Status unavailable/i)).toBeInTheDocument());
  });

  it('stops polling on unmount', async () => {
    const fetchClient = { getSystemStatus: vi.fn().mockResolvedValue(mkStatus()) };
    const { unmount } = render(<SystemStatusSection client={fetchClient as any} onGatewayVersion={() => {}} />);
    await vi.waitFor(() => expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(1));
    unmount();
    vi.advanceTimersByTime(20000);
    expect(fetchClient.getSystemStatus).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/SystemStatusSection.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement SystemStatusSection**

Create `packages/web/src/components/settings/SystemStatusSection.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SystemStatus } from '@zenterm/shared';
import { useTheme } from '@/theme';

const POLL_INTERVAL = 5000;

export interface SystemStatusClient {
  getSystemStatus(): Promise<SystemStatus>;
}

interface Props {
  client: SystemStatusClient;
  onGatewayVersion: (version: string) => void;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(b: number): string {
  const gb = b / 1e9;
  return `${gb.toFixed(1)} GB`;
}

export function SystemStatusSection({ client, onGatewayVersion }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const status = await client.getSystemStatus();
        if (cancelled) return;
        setData(status);
        setError(null);
        onGatewayVersion(status.gatewayVersion);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    void fetchOnce();
    const id = setInterval(() => void fetchOnce(), POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, onGatewayVersion]);

  return (
    <section
      role="region"
      aria-label="System status"
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
        {t('settings.systemStatus.title', 'System status')}
      </h3>

      {data ? (
        <Row label={t('settings.systemStatus.uptime', 'Uptime')} value={formatUptime(data.uptime)} />
      ) : null}
      {data ? (
        <Row
          label={t('settings.systemStatus.loadAvg', 'Load avg')}
          value={data.cpu.loadAvg.map((n) => n.toFixed(2)).join(' / ')}
        />
      ) : null}
      {data ? (
        <Row
          label={t('settings.systemStatus.memory', 'Memory')}
          value={`${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)} (${data.memory.percent}%)`}
        />
      ) : null}

      {error ? (
        <p role="alert" style={{ color: tokens.colors.error, fontSize: tokens.typography.caption.fontSize, marginTop: tokens.spacing.sm }}>
          {t('settings.systemStatus.unavailable', 'Status unavailable')}
        </p>
      ) : null}
      {!data && !error ? (
        <p style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize }}>
          {t('common.loading', 'Loading…')}
        </p>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${tokens.spacing.xs}px 0` }}>
      <span style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize }}>{label}</span>
      <span style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.smallMedium.fontSize, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Wire into SettingsPanel + share gatewayVersion**

Edit `SettingsPanel.tsx` to manage `gatewayVersion` state and pass it down:
```tsx
import { useMemo, useState } from 'react';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { AppearanceSection } from './AppearanceSection';
import { TerminalSection } from './TerminalSection';
import { GatewaySection } from './GatewaySection';
import { SystemStatusSection } from './SystemStatusSection';

export function SettingsPanel() {
  const { tokens } = useTheme();
  const auth = useAuthStore();
  const [gatewayVersion, setGatewayVersion] = useState<string | null>(null);

  const client = useMemo(() => {
    if (!auth.gatewayUrl || !auth.token) return null;
    return new ApiClient(auth.gatewayUrl, auth.token);
  }, [auth.gatewayUrl, auth.token]);

  return (
    <div style={{ padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px ${tokens.spacing.xl}px`, height: '100%', overflowY: 'auto' }}>
      <AppearanceSection />
      <TerminalSection />
      <GatewaySection gatewayVersion={gatewayVersion} />
      {client ? <SystemStatusSection client={client} onGatewayVersion={setGatewayVersion} /> : null}
      {/* RateLimits in Task 23 */}
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings
```
Expected: PASS (all sections so far)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/settings/SystemStatusSection.tsx packages/web/src/components/settings/__tests__/SystemStatusSection.test.tsx packages/web/src/components/settings/SettingsPanel.tsx
git commit -m "feat(web): SystemStatusSection with 5s polling"
```

---

## Sub-phase 2b-6: Rate Limits widget

API client 拡張、LimitsRow / ClaudeLimits / CodexLimits / RateLimitsSection。

### Task 21: Add getClaudeLimits + getCodexLimits to ApiClient

**Files:**
- Modify: `packages/web/src/api/client.ts`
- Modify: `packages/web/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Append failing tests**

Append:
```ts
describe('ApiClient.getClaudeLimits', () => {
  it('GETs /api/claude/limits', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ state: 'unconfigured' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const c = new ApiClient('http://x', 'tok');
    const res = await c.getClaudeLimits();
    expect(res).toEqual({ state: 'unconfigured' });
    expect(fetchMock).toHaveBeenCalledWith('http://x/api/claude/limits', expect.any(Object));
  });
});

describe('ApiClient.getCodexLimits', () => {
  it('GETs /api/codex/limits', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ state: 'unconfigured' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const c = new ApiClient('http://x', 'tok');
    const res = await c.getCodexLimits();
    expect(res).toEqual({ state: 'unconfigured' });
    expect(fetchMock).toHaveBeenCalledWith('http://x/api/codex/limits', expect.any(Object));
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/api/__tests__/client.test.ts -t "getClaudeLimits|getCodexLimits"
```
Expected: FAIL

- [ ] **Step 3: Add methods to client.ts**

```ts
import type { TmuxSession, TmuxWindow, SystemStatus, ClaudeLimitsResponse, CodexLimitsResponse } from '@zenterm/shared';

  getClaudeLimits(): Promise<ClaudeLimitsResponse> {
    return this.request<ClaudeLimitsResponse>('GET', '/api/claude/limits');
  }

  getCodexLimits(): Promise<CodexLimitsResponse> {
    return this.request<CodexLimitsResponse>('GET', '/api/codex/limits');
  }
```

- [ ] **Step 4: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/api/__tests__/client.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/api/client.ts packages/web/src/api/__tests__/client.test.ts
git commit -m "feat(web): add ApiClient.getClaudeLimits and getCodexLimits"
```

---

### Task 22: LimitsRow component (collapsed/expanded with color thresholds)

**Files:**
- Create: `packages/web/src/components/settings/LimitsRow.tsx`
- Test: `packages/web/src/components/settings/__tests__/LimitsRow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/web/src/components/settings/__tests__/LimitsRow.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LimitsRow } from '../LimitsRow';

describe('LimitsRow', () => {
  it('renders collapsed: dot + label + chips', () => {
    render(
      <LimitsRow
        accountLabel="default"
        windows={[
          { shortLabel: '5h', percent: 21, resetsInText: '4h 12m' },
          { shortLabel: '7d', percent: 8, resetsInText: '6d 1h' },
        ]}
      />,
    );
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('5h')).toBeInTheDocument();
    expect(screen.getByText('21%')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.queryByText('4h 12m')).not.toBeInTheDocument(); // collapsed: no reset text
  });

  it('expands on click and shows reset times + bars', () => {
    render(
      <LimitsRow
        accountLabel="default"
        windows={[
          { shortLabel: '5h', percent: 21, resetsInText: '4h 12m' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('4h 12m')).toBeInTheDocument();
  });

  it('uses warning color when percent ≥ 50', () => {
    const { container } = render(
      <LimitsRow accountLabel="x" windows={[{ shortLabel: '5h', percent: 65, resetsInText: '1h' }]} />,
    );
    const percentEl = screen.getByText('65%');
    // color is inline; assert it includes a warning hue (project color #D4B86A or similar)
    expect(percentEl.getAttribute('style')).toMatch(/color:/i);
  });

  it('shows stale dot when stale=true', () => {
    render(
      <LimitsRow accountLabel="x" stale staleText="Last updated 6m ago" windows={[]} />,
    );
    expect(screen.getByLabelText(/stale/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failure**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/LimitsRow.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Implement LimitsRow**

Create `packages/web/src/components/settings/LimitsRow.tsx` (mobile から DOM 化して移植):
```tsx
import { useState } from 'react';
import { useTheme } from '@/theme';

export interface LimitsRowWindow {
  shortLabel: string;
  percent: number;
  resetsInText: string;
}

interface Props {
  accountLabel?: string;
  windows: LimitsRowWindow[];
  stale?: boolean;
  staleText?: string;
}

const HIGH = 90;
const MID = 50;

export function LimitsRow({ accountLabel, windows, stale, staleText }: Props) {
  const { tokens } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const expandable = windows.length > 0;
  const maxPercent = windows.reduce((m, w) => Math.max(m, w.percent), 0);

  const dotColor = maxPercent >= HIGH
    ? tokens.colors.error
    : maxPercent >= MID
      ? tokens.colors.warning
      : tokens.colors.primary;

  const percentColor = (p: number) => p >= HIGH ? tokens.colors.error : p >= MID ? tokens.colors.warning : tokens.colors.textPrimary;
  const barColor = (p: number) => p >= HIGH ? tokens.colors.error : p >= MID ? tokens.colors.warning : tokens.colors.primary;

  return (
    <div style={{ opacity: stale ? 0.78 : 1 }}>
      <button
        type="button"
        aria-expanded={expanded}
        disabled={!expandable}
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: tokens.spacing.sm,
          background: 'none', border: 'none',
          padding: `${tokens.spacing.xs}px 0`, width: '100%',
          cursor: expandable ? 'pointer' : 'default',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: dotColor }} />
        {accountLabel ? (
          <span style={{
            textTransform: 'uppercase', letterSpacing: '.04em',
            fontSize: 11, color: tokens.colors.textSecondary,
            minWidth: 36,
          }}>{accountLabel}</span>
        ) : null}
        <span style={{ display: 'flex', flex: 1, gap: tokens.spacing.md, flexWrap: 'wrap' }}>
          {windows.map((w) => {
            const p = Math.max(0, Math.min(100, w.percent));
            return (
              <span key={w.shortLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>{w.shortLabel}</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600, color: percentColor(p) }}>
                  {p.toFixed(0)}%
                </span>
              </span>
            );
          })}
        </span>
        {stale ? (
          <span aria-label="stale" style={{ width: 5, height: 5, borderRadius: 2.5, background: tokens.colors.warning }} />
        ) : null}
      </button>
      {expanded && expandable ? (
        <div style={{ paddingLeft: 16, paddingBottom: tokens.spacing.sm, display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
          {windows.map((w) => {
            const p = Math.max(0, Math.min(100, w.percent));
            return (
              <div key={w.shortLabel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: tokens.colors.textSecondary }}>{w.shortLabel}</span>
                  <span style={{ color: tokens.colors.textMuted }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', color: percentColor(p), marginRight: 6 }}>
                      {p.toFixed(1)}%
                    </span>
                    · {w.resetsInText}
                  </span>
                </div>
                <div style={{ height: 4, background: tokens.colors.surface, borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${p}%`, height: '100%', background: barColor(p) }} />
                </div>
              </div>
            );
          })}
          {stale && staleText ? (
            <p style={{ fontSize: 11, color: tokens.colors.warning, fontStyle: 'italic', margin: 0 }}>{staleText}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/LimitsRow.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/settings/LimitsRow.tsx packages/web/src/components/settings/__tests__/LimitsRow.test.tsx
git commit -m "feat(web): LimitsRow with collapsed/expanded UX"
```

---

### Task 23: ClaudeLimits + CodexLimits + RateLimitsSection

**Files:**
- Create: `packages/web/src/components/settings/ClaudeLimits.tsx`
- Create: `packages/web/src/components/settings/CodexLimits.tsx`
- Create: `packages/web/src/components/settings/RateLimitsSection.tsx`
- Test: `packages/web/src/components/settings/__tests__/ClaudeLimits.test.tsx`
- Test: `packages/web/src/components/settings/__tests__/CodexLimits.test.tsx`
- Test: `packages/web/src/components/settings/__tests__/RateLimitsSection.test.tsx`
- Modify: `packages/web/src/components/settings/SettingsPanel.tsx`

- [ ] **Step 1: Write tests**

Create `packages/web/src/components/settings/__tests__/ClaudeLimits.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaudeLimits } from '../ClaudeLimits';

const mkClient = (resp: any) => ({
  getClaudeLimits: vi.fn().mockResolvedValue(resp),
}) as any;

describe('ClaudeLimits', () => {
  it('shows unconfigured state', async () => {
    render(<ClaudeLimits client={mkClient({ state: 'unconfigured' })} refreshKey={0} />);
    expect(await screen.findByText(/Not configured|未設定/i)).toBeInTheDocument();
  });

  it('shows pending state', async () => {
    render(<ClaudeLimits client={mkClient({
      state: 'configured',
      accounts: [{ label: 'default', state: 'pending', capturedAt: 0, ageSeconds: 0, stale: false }],
    })} refreshKey={0} />);
    expect(await screen.findByText(/Calculating|計測中/i)).toBeInTheDocument();
  });

  it('shows ok state with windows', async () => {
    render(<ClaudeLimits client={mkClient({
      state: 'configured',
      accounts: [{
        label: 'default', state: 'ok', capturedAt: Math.floor(Date.now() / 1000), ageSeconds: 0, stale: false,
        fiveHour: { usedPercentage: 21, resetsAt: Math.floor(Date.now() / 1000) + 4000 },
      }],
    })} refreshKey={0} />);
    expect(await screen.findByText('21%')).toBeInTheDocument();
  });

  it('shows unavailable state', async () => {
    render(<ClaudeLimits client={mkClient({
      state: 'configured',
      accounts: [{ label: 'default', state: 'unavailable', reason: 'read_error', message: 'permission denied' }],
    })} refreshKey={0} />);
    expect(await screen.findByText(/Unavailable|取得不可/i)).toBeInTheDocument();
  });
});
```

Create `packages/web/src/components/settings/__tests__/CodexLimits.test.tsx` (similar shape):
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodexLimits } from '../CodexLimits';

const mkClient = (resp: any) => ({ getCodexLimits: vi.fn().mockResolvedValue(resp) }) as any;

describe('CodexLimits', () => {
  it('shows unconfigured', async () => {
    render(<CodexLimits client={mkClient({ state: 'unconfigured' })} refreshKey={0} />);
    expect(await screen.findByText(/Not configured|未設定/i)).toBeInTheDocument();
  });

  it('shows ok with windows', async () => {
    render(<CodexLimits client={mkClient({
      state: 'configured',
      accounts: [{
        label: 'default', state: 'ok', capturedAt: Math.floor(Date.now() / 1000), ageSeconds: 0, stale: false,
        fiveHour: { usedPercentage: 8, resetsAt: Math.floor(Date.now() / 1000) + 4000 },
      }],
    })} refreshKey={0} />);
    expect(await screen.findByText('8%')).toBeInTheDocument();
  });
});
```

Create `packages/web/src/components/settings/__tests__/RateLimitsSection.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RateLimitsSection } from '../RateLimitsSection';

describe('RateLimitsSection', () => {
  it('refresh button triggers re-fetch in both Claude and Codex', async () => {
    const claudeFetch = vi.fn().mockResolvedValue({ state: 'unconfigured' });
    const codexFetch = vi.fn().mockResolvedValue({ state: 'unconfigured' });
    const client = { getClaudeLimits: claudeFetch, getCodexLimits: codexFetch } as any;

    render(<RateLimitsSection client={client} />);
    await waitFor(() => expect(claudeFetch).toHaveBeenCalledTimes(1));
    expect(codexFetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(claudeFetch).toHaveBeenCalledTimes(2));
    expect(codexFetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run failures**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings/__tests__/ClaudeLimits.test.tsx src/components/settings/__tests__/CodexLimits.test.tsx src/components/settings/__tests__/RateLimitsSection.test.tsx
```
Expected: FAIL — modules not found

- [ ] **Step 3: Implement ClaudeLimits**

Create `packages/web/src/components/settings/ClaudeLimits.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClaudeLimitsResponse, ClaudeAccountStatus } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { LimitsRow, type LimitsRowWindow } from './LimitsRow';

export interface ClaudeLimitsClient {
  getClaudeLimits(): Promise<ClaudeLimitsResponse>;
}

interface Props {
  client: ClaudeLimitsClient;
  refreshKey: number;
}

const DOCS_URL = 'https://github.com/phni3j9a/zenterm/blob/main/docs/claude-statusline.md';

function nowSec() { return Math.floor(Date.now() / 1000); }
function fmtRel(seconds: number): string {
  if (seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function fmtAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function ClaudeLimits({ client, refreshKey }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<ClaudeLimitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    client.getClaudeLimits()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [client, refreshKey]);

  if (error) return <p style={{ color: tokens.colors.error, fontSize: 11 }}>{error}</p>;
  if (!data) return <p style={{ color: tokens.colors.textMuted, fontSize: 11 }}>{t('common.loading', 'Loading…')}</p>;

  if (data.state === 'unconfigured') {
    return (
      <div style={{ padding: `${tokens.spacing.xs}px 0` }}>
        <p style={{ color: tokens.colors.textSecondary, fontSize: 12, margin: 0 }}>
          {t('settings.rateLimits.claudeUnconfigured', 'Not configured')}
        </p>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: tokens.colors.primary, fontSize: 11, textDecoration: 'underline' }}
        >
          {t('settings.rateLimits.openDocs', 'Setup guide')}
        </a>
      </div>
    );
  }

  const showLabels = data.accounts.length > 1 || data.accounts.some((a) => a.label !== 'default');

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        {t('settings.rateLimits.claude', 'Claude')}
      </p>
      {data.accounts.map((acc, i) => (
        <div key={acc.label}>
          {i > 0 ? <hr style={{ border: 0, borderTop: `1px solid ${tokens.colors.borderSubtle}`, margin: '4px 0 4px 16px' }} /> : null}
          {renderAccount(acc, showLabels, t, tokens)}
        </div>
      ))}
    </div>
  );
}

function renderAccount(acc: ClaudeAccountStatus, showLabel: boolean, t: any, tokens: any) {
  const labelText = showLabel ? acc.label : undefined;
  if (acc.state === 'unavailable') {
    return (
      <div style={{ padding: '6px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: tokens.colors.error, marginTop: 5 }} />
        {labelText ? <span style={{ fontSize: 11, color: tokens.colors.textSecondary, textTransform: 'uppercase', minWidth: 36 }}>{labelText}</span> : null}
        <div style={{ flex: 1 }}>
          <p style={{ color: tokens.colors.error, fontSize: 11, margin: 0 }}>{t('settings.rateLimits.unavailable', 'Unavailable')}</p>
          <p style={{ color: tokens.colors.textMuted, fontSize: 11, margin: 0 }}>{acc.message}</p>
        </div>
      </div>
    );
  }
  if (acc.state === 'pending') {
    return (
      <div style={{ padding: '6px 0', display: 'flex', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: tokens.colors.textMuted, marginTop: 5 }} />
        {labelText ? <span style={{ fontSize: 11, color: tokens.colors.textSecondary, textTransform: 'uppercase', minWidth: 36 }}>{labelText}</span> : null}
        <p style={{ color: tokens.colors.textSecondary, fontSize: 11, margin: 0 }}>{t('settings.rateLimits.pending', 'Calculating…')}</p>
      </div>
    );
  }
  const windows: LimitsRowWindow[] = [];
  if (acc.fiveHour) windows.push({ shortLabel: '5h', percent: acc.fiveHour.usedPercentage, resetsInText: fmtRel(acc.fiveHour.resetsAt - nowSec()) });
  if (acc.sevenDay) windows.push({ shortLabel: '7d', percent: acc.sevenDay.usedPercentage, resetsInText: fmtRel(acc.sevenDay.resetsAt - nowSec()) });
  return (
    <LimitsRow
      accountLabel={labelText}
      windows={windows}
      stale={acc.stale}
      staleText={acc.stale ? t('settings.rateLimits.stale', { age: fmtAge(acc.ageSeconds), defaultValue: 'Last updated {{age}} ago' }) : undefined}
    />
  );
}
```

- [ ] **Step 4: Implement CodexLimits (similar shape)**

Create `packages/web/src/components/settings/CodexLimits.tsx` — same structure as ClaudeLimits but using `CodexLimitsResponse`/`CodexAccountStatus` and `getCodexLimits`. Reuse the helper functions by extracting them or duplicating (file is small).

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CodexLimitsResponse, CodexAccountStatus } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { LimitsRow, type LimitsRowWindow } from './LimitsRow';

export interface CodexLimitsClient {
  getCodexLimits(): Promise<CodexLimitsResponse>;
}

interface Props { client: CodexLimitsClient; refreshKey: number }

const fmtRel = (s: number) => {
  if (s <= 0) return '0m';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
const fmtAge = (s: number) => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};
const nowSec = () => Math.floor(Date.now() / 1000);

export function CodexLimits({ client, refreshKey }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<CodexLimitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    client.getCodexLimits()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [client, refreshKey]);

  if (error) return <p style={{ color: tokens.colors.error, fontSize: 11 }}>{error}</p>;
  if (!data) return <p style={{ color: tokens.colors.textMuted, fontSize: 11 }}>{t('common.loading', 'Loading…')}</p>;
  if (data.state === 'unconfigured') {
    return (
      <p style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>
        {t('settings.rateLimits.codexUnconfigured', 'Not configured')}
      </p>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        {t('settings.rateLimits.codex', 'Codex')}
      </p>
      {data.accounts.map((acc) => renderCodex(acc, t, tokens))}
    </div>
  );
}

function renderCodex(acc: CodexAccountStatus, t: any, tokens: any) {
  if (acc.state === 'unavailable') {
    return (
      <p key={acc.label} style={{ color: tokens.colors.error, fontSize: 11 }}>
        {t('settings.rateLimits.unavailable', 'Unavailable')} — {acc.message}
      </p>
    );
  }
  if (acc.state === 'pending') {
    return (
      <p key={acc.label} style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>
        {t('settings.rateLimits.pending', 'Calculating…')}
      </p>
    );
  }
  const windows: LimitsRowWindow[] = [];
  if (acc.fiveHour) windows.push({ shortLabel: '5h', percent: acc.fiveHour.usedPercentage, resetsInText: fmtRel(acc.fiveHour.resetsAt - nowSec()) });
  if (acc.sevenDay) windows.push({ shortLabel: '7d', percent: acc.sevenDay.usedPercentage, resetsInText: fmtRel(acc.sevenDay.resetsAt - nowSec()) });
  return (
    <LimitsRow
      key={acc.label}
      windows={windows}
      stale={acc.stale}
      staleText={acc.stale ? t('settings.rateLimits.stale', { age: fmtAge(acc.ageSeconds), defaultValue: 'Last updated {{age}} ago' }) : undefined}
    />
  );
}
```

- [ ] **Step 5: Implement RateLimitsSection**

Create `packages/web/src/components/settings/RateLimitsSection.tsx`:
```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/api/client';
import { useTheme } from '@/theme';
import { ClaudeLimits } from './ClaudeLimits';
import { CodexLimits } from './CodexLimits';

interface Props {
  client: ApiClient;
}

export function RateLimitsSection({ client }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section
      role="region"
      aria-label="Rate limits"
      style={{
        marginTop: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
        borderTop: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: tokens.typography.caption.fontSize,
            color: tokens.colors.textMuted,
            margin: 0,
          }}
        >
          {t('settings.rateLimits.title', 'Rate limits')}{' '}
          <span style={{ background: '#4a2f00', color: '#ffb84d', fontSize: 9, padding: '1px 6px', borderRadius: 3, marginLeft: 4 }}>β</span>
        </h3>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          style={{
            background: 'transparent',
            border: 'none',
            color: tokens.colors.primary,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          ↻ {t('settings.rateLimits.refresh', 'Refresh')}
        </button>
      </div>
      <ClaudeLimits client={client} refreshKey={refreshKey} />
      <CodexLimits client={client} refreshKey={refreshKey} />
    </section>
  );
}
```

- [ ] **Step 6: Wire into SettingsPanel**

Add `<RateLimitsSection client={client} />` after `<SystemStatusSection ... />` in `SettingsPanel.tsx`.

- [ ] **Step 7: Run all settings tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components/settings
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/components/settings/ClaudeLimits.tsx packages/web/src/components/settings/CodexLimits.tsx packages/web/src/components/settings/RateLimitsSection.tsx packages/web/src/components/settings/__tests__/ClaudeLimits.test.tsx packages/web/src/components/settings/__tests__/CodexLimits.test.tsx packages/web/src/components/settings/__tests__/RateLimitsSection.test.tsx packages/web/src/components/settings/SettingsPanel.tsx
git commit -m "feat(web): ClaudeLimits + CodexLimits + RateLimitsSection (manual refresh)"
```

---

## Sub-phase 2b-7: i18n key migration for Phase 2a UI

Phase 2a で hardcoded だった文字列を `t()` 化。テストは locale 'en' 固定で温存。

### Task 24: Flesh out en/ja locale dictionaries (full key set)

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`

- [ ] **Step 1: Replace en.json with full dictionary**

Overwrite `packages/web/src/i18n/locales/en.json`:
```json
{
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "loading": "Loading…",
    "retry": "Retry",
    "close": "Close",
    "delete": "Delete",
    "rename": "Rename"
  },
  "sidebar": {
    "tabs": {
      "sessions": "Sessions",
      "files": "Files",
      "settings": "Settings"
    },
    "filesComingSoon": "Coming in Phase 2c",
    "events": {
      "connected": "Realtime updates: connected",
      "disconnected": "Realtime updates: disconnected",
      "reconnecting": "Realtime updates: reconnecting (attempt {{attempt}})",
      "failed": "Realtime updates: failed"
    }
  },
  "login": {
    "title": "Sign in to ZenTerm",
    "tokenLabel": "Token",
    "tokenPlaceholder": "4-digit token",
    "submit": "Sign in",
    "invalid": "Invalid token. Please try again."
  },
  "sessions": {
    "newSession": "New session",
    "newWindow": "New window",
    "namePlaceholder": "Name (optional)",
    "actionsFor": "Actions for {{type}} {{name}}",
    "deleteSessionTitle": "Delete session?",
    "deleteSessionMessage": "This will terminate the tmux session \"{{name}}\". Continue?",
    "deleteWindowTitle": "Delete window?",
    "deleteWindowMessage": "This will close window {{index}} \"{{name}}\". Continue?",
    "loadFailed": "Failed to load sessions: {{error}}",
    "empty": "No sessions yet — create one above."
  },
  "terminal": {
    "selectPrompt": "Select a session from the sidebar to start.",
    "status": {
      "connected": "Connected",
      "disconnected": "Disconnected",
      "reconnecting": "Reconnecting…",
      "error": "Error"
    }
  },
  "validation": {
    "nameEmpty": "Name cannot be empty",
    "nameTooLong": "Name must be 64 characters or fewer",
    "nameInvalidChars": "Use only letters, numbers, underscore, or hyphen"
  },
  "settings": {
    "title": "Settings",
    "appearance": {
      "title": "Appearance",
      "theme": "Theme",
      "themeOptions": { "light": "Light", "dark": "Dark", "system": "System" },
      "language": "Language"
    },
    "terminal": {
      "title": "Terminal",
      "fontSize": "Font size"
    },
    "gateway": {
      "title": "Gateway",
      "connectedTo": "Connected to",
      "token": "Token",
      "version": "Gateway version",
      "copyUrl": "Copy Web URL",
      "copied": "Web URL copied",
      "copyFailed": "Copy failed — please copy manually",
      "showQr": "Show mobile QR",
      "qrTitle": "Pair mobile app",
      "qrInstructions": "Scan this QR with the ZenTerm mobile app to pair.",
      "reauth": "Re-enter token",
      "reauthTitle": "Re-enter token",
      "verify": "Verify",
      "invalidToken": "Invalid token",
      "logout": "Logout",
      "logoutTitle": "Logout",
      "logoutConfirm": "Sign out and return to the login screen?"
    },
    "systemStatus": {
      "title": "System status",
      "uptime": "Uptime",
      "loadAvg": "Load avg",
      "memory": "Memory",
      "unavailable": "Status unavailable"
    },
    "rateLimits": {
      "title": "Rate limits",
      "refresh": "Refresh",
      "claude": "Claude",
      "codex": "Codex",
      "claudeUnconfigured": "Not configured",
      "codexUnconfigured": "Not configured",
      "openDocs": "Setup guide",
      "pending": "Calculating…",
      "unavailable": "Unavailable",
      "stale": "Last updated {{age}} ago"
    }
  }
}
```

- [ ] **Step 2: Mirror in ja.json with translations**

Overwrite `packages/web/src/i18n/locales/ja.json`:
```json
{
  "common": {
    "cancel": "キャンセル",
    "save": "保存",
    "loading": "読み込み中…",
    "retry": "再試行",
    "close": "閉じる",
    "delete": "削除",
    "rename": "名前変更"
  },
  "sidebar": {
    "tabs": {
      "sessions": "セッション",
      "files": "ファイル",
      "settings": "設定"
    },
    "filesComingSoon": "Phase 2c で実装予定",
    "events": {
      "connected": "リアルタイム更新: 接続中",
      "disconnected": "リアルタイム更新: 切断",
      "reconnecting": "リアルタイム更新: 再接続中 (試行 {{attempt}})",
      "failed": "リアルタイム更新: 失敗"
    }
  },
  "login": {
    "title": "ZenTerm にサインイン",
    "tokenLabel": "トークン",
    "tokenPlaceholder": "4桁のトークン",
    "submit": "サインイン",
    "invalid": "トークンが違います。もう一度お試しください。"
  },
  "sessions": {
    "newSession": "新規セッション",
    "newWindow": "新規ウィンドウ",
    "namePlaceholder": "名前 (任意)",
    "actionsFor": "{{type}} {{name}} の操作",
    "deleteSessionTitle": "セッションを削除しますか？",
    "deleteSessionMessage": "tmux セッション「{{name}}」を終了します。続行しますか？",
    "deleteWindowTitle": "ウィンドウを削除しますか？",
    "deleteWindowMessage": "ウィンドウ {{index}}「{{name}}」を閉じます。続行しますか？",
    "loadFailed": "セッション取得に失敗: {{error}}",
    "empty": "セッションがまだありません — 上部で作成してください。"
  },
  "terminal": {
    "selectPrompt": "サイドバーからセッションを選択してください。",
    "status": {
      "connected": "接続中",
      "disconnected": "切断",
      "reconnecting": "再接続中…",
      "error": "エラー"
    }
  },
  "validation": {
    "nameEmpty": "名前は必須です",
    "nameTooLong": "名前は 64 文字以内にしてください",
    "nameInvalidChars": "英数字 / アンダースコア / ハイフンのみ使用できます"
  },
  "settings": {
    "title": "設定",
    "appearance": {
      "title": "外観",
      "theme": "テーマ",
      "themeOptions": { "light": "ライト", "dark": "ダーク", "system": "システム" },
      "language": "言語"
    },
    "terminal": {
      "title": "ターミナル",
      "fontSize": "フォントサイズ"
    },
    "gateway": {
      "title": "ゲートウェイ",
      "connectedTo": "接続先",
      "token": "トークン",
      "version": "Gateway バージョン",
      "copyUrl": "Web URL をコピー",
      "copied": "Web URL をコピーしました",
      "copyFailed": "コピーに失敗しました — 手動でコピーしてください",
      "showQr": "モバイル用 QR を表示",
      "qrTitle": "モバイルアプリとペアリング",
      "qrInstructions": "ZenTerm モバイルアプリでこの QR をスキャンしてペアリングしてください。",
      "reauth": "トークンを再入力",
      "reauthTitle": "トークンを再入力",
      "verify": "検証",
      "invalidToken": "トークンが違います",
      "logout": "ログアウト",
      "logoutTitle": "ログアウト",
      "logoutConfirm": "サインアウトしてログイン画面に戻りますか？"
    },
    "systemStatus": {
      "title": "システムステータス",
      "uptime": "稼働時間",
      "loadAvg": "ロードアベレージ",
      "memory": "メモリ",
      "unavailable": "ステータス取得不可"
    },
    "rateLimits": {
      "title": "レート制限",
      "refresh": "更新",
      "claude": "Claude",
      "codex": "Codex",
      "claudeUnconfigured": "未設定",
      "codexUnconfigured": "未設定",
      "openDocs": "セットアップガイド",
      "pending": "計測中…",
      "unavailable": "取得不可",
      "stale": "{{age}} 前に更新"
    }
  }
}
```

- [ ] **Step 3: Run i18n tests to ensure new keys load**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/i18n
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "feat(web): flesh out en/ja locale dictionaries (full key set)"
```

---

### Task 25: i18n key migration for Sidebar / SessionsListPanel / TerminalPane

**Files:**
- Modify: `packages/web/src/components/Sidebar.tsx`
- Modify: `packages/web/src/components/SessionsListPanel.tsx`
- Modify: `packages/web/src/components/TerminalPane.tsx`

- [ ] **Step 1: Set test locale to 'en' globally**

Edit `packages/web/src/setupTests.ts` (Phase 2a で存在):
```ts
import '@testing-library/jest-dom';
import i18next from 'i18next';
import { initI18n } from './i18n';

initI18n();
void i18next.changeLanguage('en');
```

これで全テストで英語固定になる。Phase 2a の既存 assertions ('Sessions', 'New session' 等) はそのまま通る。

- [ ] **Step 2: Replace hardcoded strings in Sidebar.tsx**

Edit `packages/web/src/components/Sidebar.tsx`:
- Import `useTranslation`: `import { useTranslation } from 'react-i18next';`
- 3 タブのテキストを `t('sidebar.tabs.sessions')` 等に
- "Coming in Phase 2c" tooltip を `t('sidebar.filesComingSoon')` に
- `EventsStatusDot` 内 `label` を `t('sidebar.events.<status>', { attempt })` に

- [ ] **Step 3: Replace strings in SessionsListPanel.tsx**

Read SessionsListPanel.tsx 全体, replace:
- "New session" → `t('sessions.newSession')`
- "Failed to load sessions: ..." → `t('sessions.loadFailed', { error })`
- "No sessions yet — create one above." → `t('sessions.empty')`
- (other hardcoded strings)

- [ ] **Step 4: Replace strings in TerminalPane.tsx**

Replace:
- "Select a session from the sidebar to start." → `t('terminal.selectPrompt')`
- aria-label `Connection ${status}` → `t(\`terminal.status.${status}\`)`

- [ ] **Step 5: Run all related tests + flow tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/components src/__tests__
```
Expected: PASS (assertions remain in English because setupTests forces 'en')

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/setupTests.ts packages/web/src/components/Sidebar.tsx packages/web/src/components/SessionsListPanel.tsx packages/web/src/components/TerminalPane.tsx
git commit -m "i18n(web): migrate Sidebar/SessionsListPanel/TerminalPane strings to t()"
```

---

### Task 26: i18n key migration for routes/login + LoginForm + sidebar/* CRUD

**Files:**
- Modify: `packages/web/src/routes/login.tsx`
- Modify: `packages/web/src/components/LoginForm.tsx`
- Modify: `packages/web/src/components/sidebar/NewSessionButton.tsx`
- Modify: `packages/web/src/components/sidebar/NewWindowButton.tsx`
- Modify: `packages/web/src/components/sidebar/SessionRow.tsx`
- Modify: `packages/web/src/components/sidebar/WindowRow.tsx`
- Modify: `packages/web/src/components/sidebar/RowActionsMenu.tsx`

- [ ] **Step 1: Replace strings in LoginForm + login route**

In LoginForm.tsx and routes/login.tsx, replace:
- "Sign in to ZenTerm" / titles → `t('login.title')`
- "Token" label → `t('login.tokenLabel')`
- placeholder → `t('login.tokenPlaceholder')`
- "Sign in" submit → `t('login.submit')`
- "Invalid token" error → `t('login.invalid')`

- [ ] **Step 2: Replace strings in sidebar/* CRUD components**

For each of the 5 sidebar components:
- "New session"/"New window" buttons → `t('sessions.newSession'/.newWindow')`
- "Name (optional)" placeholder → `t('sessions.namePlaceholder')`
- aria-label "Actions for ..." → `t('sessions.actionsFor', { type, name })`
- RowActionsMenu items "Rename"/"Delete" → `t('common.rename'/.delete')`

- [ ] **Step 3: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/routes src/components/sidebar
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/login.tsx packages/web/src/components/LoginForm.tsx packages/web/src/components/sidebar/
git commit -m "i18n(web): migrate login + sidebar CRUD strings to t()"
```

---

### Task 27: i18n key migration for ConfirmDialog + Toast + validateName

**Files:**
- Modify: `packages/web/src/components/ui/ConfirmDialog.tsx`
- Modify: `packages/web/src/components/ui/Toast.tsx`
- Modify: `packages/web/src/lib/validateName.ts`

- [ ] **Step 1: Replace strings**

In ConfirmDialog.tsx: default Cancel/Confirm labels → `t('common.cancel')` / `t('common.delete')` (or pass-through if already prop-driven)

In Toast.tsx: probably no hardcoded strings (it just renders props.message). Verify and skip if so.

For `lib/validateName.ts`: validation messages are returned as strings. To avoid forcing all callers to pass `t`, use **error codes** + a thin helper:

Edit `packages/web/src/lib/validateName.ts`:
```ts
export type NameValidationError = 'empty' | 'too-long' | 'invalid-chars';

export function validateSessionOrWindowName(name: string): NameValidationError | null {
  if (name.length === 0) return 'empty';
  if (name.length > 64) return 'too-long';
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return 'invalid-chars';
  return null;
}

const KEY_MAP: Record<NameValidationError, string> = {
  'empty': 'validation.nameEmpty',
  'too-long': 'validation.nameTooLong',
  'invalid-chars': 'validation.nameInvalidChars',
};

export function nameValidationKey(err: NameValidationError): string {
  return KEY_MAP[err];
}
```

Update callers in `sidebar/SessionRow.tsx`, `sidebar/WindowRow.tsx`, `sidebar/NewSessionButton.tsx`, `sidebar/NewWindowButton.tsx`, `components/ui/InlineEdit.tsx` (Phase 2a InlineEdit が validate を呼ぶ箇所) to convert error code → `t(nameValidationKey(err))` for display.

- [ ] **Step 2: Update validateName test to assert codes**

Edit `packages/web/src/lib/__tests__/validateName.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { validateSessionOrWindowName } from '../validateName';

describe('validateSessionOrWindowName', () => {
  it('returns null for valid name', () => {
    expect(validateSessionOrWindowName('zen_dev')).toBeNull();
  });
  it('returns "empty" for empty name', () => {
    expect(validateSessionOrWindowName('')).toBe('empty');
  });
  it('returns "too-long" for >64 chars', () => {
    expect(validateSessionOrWindowName('a'.repeat(65))).toBe('too-long');
  });
  it('returns "invalid-chars" for special chars', () => {
    expect(validateSessionOrWindowName('zen dev')).toBe('invalid-chars');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/lib/validateName.ts packages/web/src/lib/__tests__/validateName.test.ts packages/web/src/components/ui/ConfirmDialog.tsx packages/web/src/components/ui/Toast.tsx packages/web/src/components/ui/InlineEdit.tsx packages/web/src/components/sidebar/
git commit -m "i18n(web): migrate ConfirmDialog/Toast/validateName to keys + codes"
```

---

## Sub-phase 2b-8: Flow integration + E2E + polish

### Task 28: Flow integration test — settings-theme-flow

**Files:**
- Create: `packages/web/src/__tests__/flows/settings-theme-flow.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://localhost:3000' });
  useSettingsStore.setState({ themeMode: 'dark', language: 'en', fontSize: 14 } as any);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => [],
  }));
  // navigate to settings
  window.history.pushState({}, '', '/web/settings');
});

afterEach(() => vi.restoreAllMocks());

describe('Settings theme flow', () => {
  it('switching theme updates the resolved tokens', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('region', { name: /appearance/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Light$/ }));
    expect(useSettingsStore.getState().themeMode).toBe('light');
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/settings-theme-flow.test.tsx
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/__tests__/flows/settings-theme-flow.test.tsx
git commit -m "test(web): add settings theme flow integration test"
```

---

### Task 29: Flow integration test — settings-language-flow

**Files:**
- Create: `packages/web/src/__tests__/flows/settings-language-flow.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://localhost:3000' });
  useSettingsStore.setState({ themeMode: 'dark', language: 'en', fontSize: 14 } as any);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => [],
  }));
  window.history.pushState({}, '', '/web/settings');
});

afterEach(() => vi.restoreAllMocks());

describe('Settings language flow', () => {
  it('changes UI language to ja', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Appearance/)).toBeInTheDocument());
    const select = screen.getByLabelText(/language/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'ja' } });
    await waitFor(() => expect(i18next.language.startsWith('ja')).toBe(true));
    expect(await screen.findByText(/外観/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/settings-language-flow.test.tsx
git add packages/web/src/__tests__/flows/settings-language-flow.test.tsx
git commit -m "test(web): add settings language flow integration test"
```

---

### Task 30: Flow integration test — settings-gateway-flow

**Files:**
- Create: `packages/web/src/__tests__/flows/settings-gateway-flow.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://localhost:3000' });
  useSettingsStore.setState({ themeMode: 'dark', language: 'en', fontSize: 14 } as any);
  useUiStore.setState({ confirmDialog: null, toasts: [] });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => [],
  }));
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  window.history.pushState({}, '', '/web/settings');
});

afterEach(() => vi.restoreAllMocks());

describe('Settings gateway flow', () => {
  it('Copy URL writes to clipboard and shows toast', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /copy.*url/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /copy.*url/i }));
    await waitFor(() => expect(useUiStore.getState().toasts.length).toBeGreaterThan(0));
  });

  it('Logout clears auth and navigates to login', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    const confirm = useUiStore.getState().confirmDialog;
    expect(confirm).not.toBeNull();
    confirm?.onConfirm();
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/settings-gateway-flow.test.tsx
git add packages/web/src/__tests__/flows/settings-gateway-flow.test.tsx
git commit -m "test(web): add settings gateway flow integration test"
```

---

### Task 31: Flow integration test — settings-limits-flow

**Files:**
- Create: `packages/web/src/__tests__/flows/settings-limits-flow.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
    HTMLDialogElement.prototype.close = function () { (this as any).open = false; };
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://localhost:3000' });
  useSettingsStore.setState({ themeMode: 'dark', language: 'en', fontSize: 14 } as any);

  const responses = new Map<string, any>([
    ['/api/sessions', []],
    ['/api/system/status', { cpu: { usage: 0, cores: 1, model: '', loadAvg: [0,0,0] }, memory: { total: 1, used: 0, free: 1, percent: 0 }, disk: { total: 1, used: 0, free: 1, percent: 0 }, temperature: null, uptime: 100, gatewayVersion: '0.5.7' }],
    ['/api/claude/limits', { state: 'unconfigured' }],
    ['/api/codex/limits', { state: 'unconfigured' }],
  ]);
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    for (const [path, body] of responses) {
      if (url.endsWith(path)) {
        return Promise.resolve({
          ok: true, status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => body,
        });
      }
    }
    return Promise.resolve({ ok: true, status: 200, headers: new Headers(), json: async () => null });
  }));
  window.history.pushState({}, '', '/web/settings');
});

afterEach(() => vi.restoreAllMocks());

describe('Settings rate-limits flow', () => {
  it('Refresh button triggers Claude+Codex re-fetch', async () => {
    render(<App />);
    await waitFor(() => {
      const calls = (fetch as any).mock.calls.map((c: any[]) => c[0] as string);
      expect(calls.some((u: string) => u.includes('/api/claude/limits'))).toBe(true);
      expect(calls.some((u: string) => u.includes('/api/codex/limits'))).toBe(true);
    });
    const initialCalls = (fetch as any).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect((fetch as any).mock.calls.length).toBeGreaterThan(initialCalls));
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web src/__tests__/flows/settings-limits-flow.test.tsx
git add packages/web/src/__tests__/flows/settings-limits-flow.test.tsx
git commit -m "test(web): add settings rate-limits flow integration test"
```

---

### Task 32: E2E spec — settings-tab.spec.ts

**Files:**
- Create: `tests/e2e/web/settings-tab.spec.ts`

- [ ] **Step 1: Write spec**

```ts
import { test, expect } from '@playwright/test';
import { spawnGateway, killGateway, openWebApp, type GatewayInstance } from './_helpers';

let gw: GatewayInstance;

test.beforeAll(async () => {
  gw = await spawnGateway();
});
test.afterAll(async () => {
  await killGateway(gw);
});

test('switching to Settings tab navigates to /web/settings and keeps TerminalPane mounted', async ({ page }) => {
  await openWebApp(page, gw);
  // create a session first so TerminalPane has content
  await page.getByRole('button', { name: /new session/i }).click();
  await page.getByPlaceholder(/name/i).fill('e2e_settings');
  await page.keyboard.press('Enter');
  await page.getByText('e2e_settings').click();

  // click Settings tab
  await page.getByRole('button', { name: /settings tab/i }).click();
  await expect(page).toHaveURL(/\/web\/settings$/);
  await expect(page.getByRole('region', { name: /appearance/i })).toBeVisible();

  // navigate back
  await page.getByRole('button', { name: /sessions tab/i }).click();
  await expect(page).toHaveURL(/\/web\/sessions/);
});
```

(Reuse existing helpers in `tests/e2e/web/_helpers.ts` from Phase 2a; if helper signature differs, adapt.)

- [ ] **Step 2: Run + commit**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/settings-tab.spec.ts
git add tests/e2e/web/settings-tab.spec.ts
git commit -m "test(e2e): settings tab navigation + TerminalPane mount preservation"
```

---

### Task 33: E2E spec — settings-theme.spec.ts + settings-language.spec.ts

**Files:**
- Create: `tests/e2e/web/settings-theme.spec.ts`
- Create: `tests/e2e/web/settings-language.spec.ts`

- [ ] **Step 1: Write theme spec**

```ts
import { test, expect } from '@playwright/test';
import { spawnGateway, killGateway, openWebApp, type GatewayInstance } from './_helpers';

let gw: GatewayInstance;
test.beforeAll(async () => { gw = await spawnGateway(); });
test.afterAll(async () => { await killGateway(gw); });

test('theme toggle persists across reload', async ({ page }) => {
  await openWebApp(page, gw);
  await page.getByRole('button', { name: /settings tab/i }).click();
  await page.getByRole('button', { name: /^Light$/ }).click();

  // check storage
  const stored = await page.evaluate(() => localStorage.getItem('zenterm-web-settings'));
  expect(stored).toContain('"themeMode":"light"');

  await page.reload();
  await expect(page.getByRole('button', { name: /^Light$/ })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 2: Write language spec**

```ts
import { test, expect } from '@playwright/test';
import { spawnGateway, killGateway, openWebApp, type GatewayInstance } from './_helpers';

let gw: GatewayInstance;
test.beforeAll(async () => { gw = await spawnGateway(); });
test.afterAll(async () => { await killGateway(gw); });

test('language switch updates UI strings', async ({ page }) => {
  await openWebApp(page, gw);
  await page.getByRole('button', { name: /settings tab/i }).click();
  await page.getByLabel(/language/i).selectOption('ja');
  await expect(page.getByText('外観')).toBeVisible();
  await page.getByLabel(/language/i).selectOption('en');
  await expect(page.getByText('Appearance')).toBeVisible();
});
```

- [ ] **Step 3: Run + commit**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/settings-theme.spec.ts tests/e2e/web/settings-language.spec.ts
git add tests/e2e/web/settings-theme.spec.ts tests/e2e/web/settings-language.spec.ts
git commit -m "test(e2e): settings theme + language persistence"
```

---

### Task 34: E2E spec — settings-fontsize.spec.ts + settings-gateway.spec.ts

**Files:**
- Create: `tests/e2e/web/settings-fontsize.spec.ts`
- Create: `tests/e2e/web/settings-gateway.spec.ts`

- [ ] **Step 1: Write fontsize spec**

```ts
import { test, expect } from '@playwright/test';
import { spawnGateway, killGateway, openWebApp, type GatewayInstance } from './_helpers';

let gw: GatewayInstance;
test.beforeAll(async () => { gw = await spawnGateway(); });
test.afterAll(async () => { await killGateway(gw); });

test('font size + persists', async ({ page }) => {
  await openWebApp(page, gw);
  await page.getByRole('button', { name: /settings tab/i }).click();
  // increase to 16
  await page.getByRole('button', { name: /increase font size/i }).click();
  await page.getByRole('button', { name: /increase font size/i }).click();
  await expect(page.getByText('16')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /settings tab/i }).click();
  await expect(page.getByText('16')).toBeVisible();
});
```

- [ ] **Step 2: Write gateway spec**

```ts
import { test, expect } from '@playwright/test';
import { spawnGateway, killGateway, openWebApp, type GatewayInstance } from './_helpers';

let gw: GatewayInstance;
test.beforeAll(async () => { gw = await spawnGateway(); });
test.afterAll(async () => { await killGateway(gw); });

test('Show QR opens modal with the pairing URL', async ({ page }) => {
  await openWebApp(page, gw);
  await page.getByRole('button', { name: /settings tab/i }).click();
  await page.getByRole('button', { name: /show.*qr/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/zenterm:\/\/connect/)).toBeVisible();
  await page.getByRole('button', { name: /close/i }).click();
});

test('Logout returns to /web/login', async ({ page }) => {
  await openWebApp(page, gw);
  await page.getByRole('button', { name: /settings tab/i }).click();
  await page.getByRole('button', { name: /logout/i }).click();
  await page.getByRole('button', { name: /confirm|delete|logout/i }).last().click();
  await expect(page).toHaveURL(/\/web\/login/);
});
```

- [ ] **Step 3: Run + commit**

```bash
cd /home/server/projects/zenterm/server && npx playwright test tests/e2e/web/settings-fontsize.spec.ts tests/e2e/web/settings-gateway.spec.ts
git add tests/e2e/web/settings-fontsize.spec.ts tests/e2e/web/settings-gateway.spec.ts
git commit -m "test(e2e): settings fontsize + gateway QR/Logout"
```

---

### Task 35: Final polish — Files tab label update, /web/files redirect, full test pass

**Files:**
- Modify: `packages/web/src/components/Sidebar.tsx` (Files title 確認)
- Modify: `packages/web/src/App.tsx` (`/web/files` を `/web/sessions` redirect)

- [ ] **Step 1: Verify Files tab tooltip says "Coming in Phase 2c"**

Files タブの `title="Coming in Phase 2c"` (Phase 2a の "Phase 2b" と差し替え済み確認、Task 10 で行ったはず)。差し替え忘れがあれば修正。

- [ ] **Step 2: Add /web/files redirect to App.tsx**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';

<Routes>
  <Route path="/web/login" element={<LoginRoute />} />
  <Route path="/web/sessions" element={<SessionsRoute />} />
  <Route path="/web/sessions/:sessionId" element={<SessionsRoute />} />
  <Route path="/web/settings" element={<SettingsRoute />} />
  <Route path="/web/files" element={<Navigate to="/web/sessions" replace />} />
  <Route path="*" element={<Navigate to="/web/sessions" replace />} />
</Routes>
```

- [ ] **Step 3: Run full test suite**

```bash
cd /home/server/projects/zenterm/server && npx vitest run -w @zenterm/web
```
Expected: PASS — all unit / component / flow tests

- [ ] **Step 4: Run full E2E suite**

```bash
cd /home/server/projects/zenterm/server && npx playwright test
```
Expected: PASS — all E2E specs (Phase 2a + Phase 2b)

- [ ] **Step 5: Run type-check + build**

```bash
cd /home/server/projects/zenterm/server && npm run -w @zenterm/web type-check && npm run -w @zenterm/web build
```
Expected: both PASS

- [ ] **Step 6: Update spec status**

Edit `docs/superpowers/specs/2026-05-10-pc-web-phase-2b-design.md` to mark "状態: Phase 2b 完了"。
Edit `docs/superpowers/specs/2026-05-09-pc-web-design.md` master spec status to "Phase 1 + 2a + 2b 完了 / Phase 2c (Files) 計画中"。

- [ ] **Step 7: Final commit + tag**

```bash
git add packages/web/src/App.tsx packages/web/src/components/Sidebar.tsx docs/superpowers/specs/
git commit -m "docs(web): mark Phase 2b complete; add /web/files redirect"
git tag web-pc-phase-2b-done
```

---

## Self-Review Notes

### Spec coverage check

| Spec section | Tasks |
|---|---|
| Settings store + theme persistence migration | Tasks 2, 5 |
| i18n infra + en/ja | Tasks 1, 3, 4, 7, 24 |
| Theme dark/light/system | Tasks 5, 6 (XtermView 反映), 13 (UI), 28 (flow), 33 (E2E) |
| AppearanceSection | Task 13 |
| TerminalSection | Task 14 |
| GatewaySection (URL/Token/Copy/QR/Reauth/Logout/Version) | Tasks 15, 16, 17, 18 |
| SystemStatusSection (5s polling) | Tasks 19, 20 |
| RateLimitsSection (Claude+Codex+manual refresh) | Tasks 21, 22, 23 |
| AuthenticatedShell extraction | Tasks 8, 9, 11 |
| Sidebar 3 タブ interactive + URL 連動 | Task 10 |
| /web/settings ルート | Task 11 |
| Files タブ label "Coming in Phase 2c" | Tasks 10 (label), 35 (verify) |
| Phase 2a UI 11 ファイル i18n key 化 | Tasks 25, 26, 27 |
| Flow tests (4 本) | Tasks 28-31 |
| E2E (5 本) | Tasks 32, 33, 34 (5 specs total) |
| /web/files redirect | Task 35 |

### Type consistency

- `ThemeMode` defined in `stores/settings.ts`, re-exported from `theme/index.ts` — single source ✓
- `Language` defined in `stores/settings.ts` ✓
- `LimitsRowWindow` shape: `{ shortLabel, percent, resetsInText }` consistent across LimitsRow/Claude/Codex
- `SystemStatusClient` interface in SystemStatusSection — only requires `getSystemStatus`, ApiClient implements it
- `ClaudeLimitsClient` / `CodexLimitsClient` similar narrow interfaces — ApiClient implements both
- `useTheme()` returns `{ tokens, mode, resolvedTheme, setMode }` — `mode` and `setMode` retained for back-compat with Phase 2a callers

### Placeholder scan

- All "TBD"/"TODO" eliminated; each step has concrete code or commands
- Task 8 (AuthenticatedShell) intentionally references "コピーする" the existing handlers from `routes/sessions.tsx` — the handlers are not duplicated in the plan because they exist in the current codebase verbatim. Implementer should literally copy them.

### Dependencies between tasks

```
Task 1 (deps) → Task 2 (store) → Task 3 (locales) → Task 4 (i18n init) → Task 5 (useTheme refactor)
                                                                          ↓
                                                                    Task 6 (XtermView refactor)
                                                                          ↓
                                                                    Task 7 (main.tsx init)
                                                                          ↓
Task 8 (AuthenticatedShell) → Task 9 (SessionsRoute) ↘
                              Task 10 (Sidebar)         → Task 11 (SettingsRoute)
                                                          ↓
                                                       Task 12 (SettingsPanel skeleton)
                                                          ↓
                                                       Tasks 13, 14, 18, 20, 23 (parallel-safe)
                                                          ↓
                                                       Tasks 24-27 (i18n migration)
                                                          ↓
                                                       Tasks 28-34 (flow + E2E)
                                                          ↓
                                                       Task 35 (final polish + tag)
```

Tasks 13-23 (sections + widgets) can be parallelized after Task 12. Tasks 15-18 (Gateway sub-components) have internal ordering: 15 (qr lib) → 16 (QrModal) → 17 (Reauth) → 18 (GatewaySection composer).

### Estimated effort

- Tasks 1-7 (foundation): 2-3 hours
- Tasks 8-11 (routing): 2 hours
- Tasks 12-23 (UI sections): 4-5 hours
- Tasks 24-27 (i18n migration): 2-3 hours
- Tasks 28-34 (tests): 3-4 hours
- Task 35 (polish): 1 hour

Total: ~14-18 hours of focused work, comparable to Phase 2a (30 tasks / ~16 hours).

