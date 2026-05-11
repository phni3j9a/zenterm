# PC Web Phase 4a (キーボード系) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC ブラウザ版に「キーボード中心の操作」をもたらす Phase 4a。tooltip / グローバルショートカット (⌘T/W/1-9/[/]/\\/K/F/B/,) / Command Palette / xterm 内検索 を導入する。Phase 4b の「マウス/URL 系 (右クリック・サイドバー幅・D&D・deep link)」とは独立。

**Architecture:**
- グローバル keydown は `useShortcuts` を **AuthenticatedShell に 1 つだけ mount** し、`window.addEventListener('keydown', h, true)` の capture phase で奪う (xterm の attachCustomKeyEventHandler よりも先に動く)。
- 既存 `useSettingsStore` には触らず、新規 `useLayoutStore` を作って `sidebarCollapsed` / `paletteOpen` / `layoutMenuOpen` を集約 (Phase 4b の splitter 比率もここに追加する想定)。
- `LayoutSelector` は外部から `open()` できる必要があるので「open state を `useLayoutStore.layoutMenuOpen` に逃がす」リファクタを最小限で行う。
- Command Palette は overlay + fuse.js fuzzy。アクションは静的カタログ (定型) + 動的セッション/window (sessions store から派生)。
- xterm 内検索は `@xterm/addon-search` を装着。focused TerminalPane 上部に sticky な検索バーを描画し、検索 API は React 経由で SearchAddon メソッド呼び出し。

**Tech Stack:** React 19 + zustand v5 (persist) + react-router 7 + xterm.js v5 + `@xterm/addon-search` + `fuse.js` + i18next + Vitest 4 + @testing-library/react + Playwright

---

## File Structure

### New files
| Path | 責務 |
|---|---|
| `packages/web/src/lib/platform.ts` | OS 判定 (`isMac()`)、modifier label (`⌘` / `Ctrl`) |
| `packages/web/src/lib/keymap.ts` | `matchShortcut(ev, spec)` ヘルパー、登録形のショートカット ID 列挙 |
| `packages/web/src/stores/layout.ts` | `useLayoutStore` (`sidebarCollapsed`, `paletteOpen`, `layoutMenuOpen`) + persist |
| `packages/web/src/hooks/useShortcuts.ts` | capture-phase global keydown → action dispatch |
| `packages/web/src/components/ui/Tooltip.tsx` | 500ms 遅延 + `aria-describedby` + Portal なし position 計算 |
| `packages/web/src/components/terminal/TerminalSearch.tsx` | xterm SearchAddon ラッパ UI (input + Next/Prev + opts) |
| `packages/web/src/components/CommandPalette.tsx` | overlay + input + result list + アクション実行 |
| `packages/web/src/lib/commandPaletteActions.ts` | 静的アクションカタログ + sessions/windows 派生コマンド組立 |
| `packages/web/src/lib/__tests__/platform.test.ts` | OS 判定 |
| `packages/web/src/lib/__tests__/keymap.test.ts` | shortcut match |
| `packages/web/src/stores/__tests__/layout.test.ts` | layout store |
| `packages/web/src/hooks/__tests__/useShortcuts.test.tsx` | hook 単体 |
| `packages/web/src/components/ui/__tests__/Tooltip.test.tsx` | tooltip |
| `packages/web/src/components/terminal/__tests__/TerminalSearch.test.tsx` | search UI |
| `packages/web/src/components/__tests__/CommandPalette.test.tsx` | palette |
| `packages/web/src/lib/__tests__/commandPaletteActions.test.ts` | カタログ |
| `tests/e2e/web/shortcuts.spec.ts` | E2E ⌘B / ⌘K / ⌘F のスモーク |

### Modified files
| Path | 変更 |
|---|---|
| `packages/web/package.json` | `@xterm/addon-search`, `fuse.js` を依存に追加 |
| `packages/web/src/components/Sidebar.tsx` | `sidebarCollapsed` を読んで `width: 0` / `display: none` で折りたたみ |
| `packages/web/src/components/AuthenticatedShell.tsx` | `useShortcuts()` mount + `<CommandPalette />` mount |
| `packages/web/src/components/terminal/LayoutSelector.tsx` | open state を `useLayoutStore.layoutMenuOpen` に外出し |
| `packages/web/src/components/terminal/XtermView.tsx` | SearchAddon 装着 + `onSearchReady` callback で `search/findNext/findPrev` API を上層に渡す |
| `packages/web/src/components/TerminalPane.tsx` | focused 時に `<TerminalSearch />` を sticky 描画 + ⌘F で `searchOpen` を `useLayoutStore` から制御 |
| `packages/web/src/components/terminal/TerminalHeader.tsx` | `<Tooltip>` でアイコンボタンをラップ (ID / zoom / reconnect) |
| `packages/web/src/i18n/locales/en.json` + `ja.json` | `shortcuts.*`, `palette.*`, `terminal.search.*`, `tooltips.*` キー追加 |
| `packages/gateway/public/web/index.html` | bundle hash 差し替え (最後の task で実施) |

---

## Task 1: Tooltip コンポーネント

**Files:**
- Create: `packages/web/src/components/ui/Tooltip.tsx`
- Test: `packages/web/src/components/ui/__tests__/Tooltip.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/components/ui/__tests__/Tooltip.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the trigger child immediately', () => {
    render(
      <Tooltip label="hello">
        <button>btn</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'btn' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the tooltip after 500ms hover and links via aria-describedby', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Tooltip label="hello">
        <button>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'btn' });
    await user.hover(btn);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('hello');
    expect(btn).toHaveAttribute('aria-describedby', tip.id);
  });

  it('hides on unhover before delay elapses', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Tooltip label="hello">
        <button>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'btn' });
    await user.hover(btn);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await user.unhover(btn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('hides on Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Tooltip label="hello">
        <button>btn</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'btn' });
    await user.hover(btn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=@zenterm/web test -- src/components/ui/__tests__/Tooltip.test.tsx`
Expected: FAIL — "Cannot find module '../Tooltip'".

- [ ] **Step 3: Implement Tooltip**

```tsx
// packages/web/src/components/ui/Tooltip.tsx
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useTheme } from '@/theme';

const DELAY_MS = 500;

export interface TooltipProps {
  label: string;
  children: ReactNode;
  /** Optional override (defaults to "top"). */
  placement?: 'top' | 'bottom';
}

export function Tooltip({ label, children, placement = 'top' }: TooltipProps) {
  const { tokens } = useTheme();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const handleEnter = () => {
    clearTimer();
    timerRef.current = window.setTimeout(() => setVisible(true), DELAY_MS);
  };
  const handleLeave = () => {
    clearTimer();
    setVisible(false);
  };

  if (!isValidElement(children)) return <>{children}</>;
  type DOMProps = {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    'aria-describedby'?: string;
  };
  const childProps = (children as ReactElement<DOMProps>).props;
  const trigger = cloneElement(children as ReactElement<DOMProps>, {
    onMouseEnter: (ev: React.MouseEvent) => {
      childProps.onMouseEnter?.(ev);
      handleEnter();
    },
    onMouseLeave: (ev: React.MouseEvent) => {
      childProps.onMouseLeave?.(ev);
      handleLeave();
    },
    onFocus: (ev: React.FocusEvent) => {
      childProps.onFocus?.(ev);
      handleEnter();
    },
    onBlur: (ev: React.FocusEvent) => {
      childProps.onBlur?.(ev);
      handleLeave();
    },
    'aria-describedby': visible ? id : childProps['aria-describedby'],
  });

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {visible && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            ...(placement === 'top'
              ? { bottom: 'calc(100% + 4px)' }
              : { top: 'calc(100% + 4px)' }),
            left: '50%',
            transform: 'translateX(-50%)',
            background: tokens.colors.surface,
            color: tokens.colors.textPrimary,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radii.sm,
            padding: '2px 6px',
            fontSize: tokens.typography.caption.fontSize,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --workspace=@zenterm/web test -- src/components/ui/__tests__/Tooltip.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 5: Type-check**

Run: `npm --workspace=@zenterm/web run type-check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/ui/Tooltip.tsx \
        packages/web/src/components/ui/__tests__/Tooltip.test.tsx
git commit -m "feat(web): Tooltip component (500ms delay, aria-describedby, Escape close)"
```

---

## Task 2: プラットフォーム + キーマップ ユーティリティ

**Files:**
- Create: `packages/web/src/lib/platform.ts`
- Create: `packages/web/src/lib/keymap.ts`
- Test: `packages/web/src/lib/__tests__/platform.test.ts`
- Test: `packages/web/src/lib/__tests__/keymap.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/web/src/lib/__tests__/platform.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { isMac, modifierLabel } from '../platform';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform', () => {
  it('detects macOS via navigator.platform', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    expect(isMac()).toBe(true);
    expect(modifierLabel()).toBe('⌘');
  });

  it('detects macOS via userAgent fallback', () => {
    vi.stubGlobal('navigator', { platform: '', userAgent: 'Mozilla/5.0 (Macintosh)' });
    expect(isMac()).toBe(true);
  });

  it('returns Ctrl on other platforms', () => {
    vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'Linux' });
    expect(isMac()).toBe(false);
    expect(modifierLabel()).toBe('Ctrl');
  });
});
```

```ts
// packages/web/src/lib/__tests__/keymap.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { matchShortcut, type ShortcutSpec } from '../keymap';

afterEach(() => {
  vi.unstubAllGlobals();
});

function ev(init: Partial<KeyboardEvent>): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('matchShortcut', () => {
  it('matches ⌘K on mac', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    const spec: ShortcutSpec = { key: 'k', mod: true };
    expect(matchShortcut(ev({ key: 'k', metaKey: true }), spec)).toBe(true);
    expect(matchShortcut(ev({ key: 'k', ctrlKey: true }), spec)).toBe(false);
  });

  it('matches Ctrl+K on non-mac', () => {
    vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'Linux' });
    const spec: ShortcutSpec = { key: 'k', mod: true };
    expect(matchShortcut(ev({ key: 'k', ctrlKey: true }), spec)).toBe(true);
    expect(matchShortcut(ev({ key: 'k', metaKey: true }), spec)).toBe(false);
  });

  it('matches digits and is case-insensitive on letters', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    expect(matchShortcut(ev({ key: '3', metaKey: true }), { key: '3', mod: true })).toBe(true);
    expect(matchShortcut(ev({ key: 'F', metaKey: true }), { key: 'f', mod: true })).toBe(true);
  });

  it('rejects when shift required but absent', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    const spec: ShortcutSpec = { key: 'p', mod: true, shift: true };
    expect(matchShortcut(ev({ key: 'p', metaKey: true }), spec)).toBe(false);
    expect(matchShortcut(ev({ key: 'p', metaKey: true, shiftKey: true }), spec)).toBe(true);
  });

  it('rejects extra modifiers when not requested', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    const spec: ShortcutSpec = { key: 'k', mod: true };
    expect(matchShortcut(ev({ key: 'k', metaKey: true, altKey: true }), spec)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=@zenterm/web test -- src/lib/__tests__/platform.test.ts src/lib/__tests__/keymap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/web/src/lib/platform.ts
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const plat = navigator.platform ?? '';
  if (/Mac/i.test(plat)) return true;
  const ua = navigator.userAgent ?? '';
  return /Macintosh|Mac OS X/i.test(ua);
}

export function modifierLabel(): '⌘' | 'Ctrl' {
  return isMac() ? '⌘' : 'Ctrl';
}
```

```ts
// packages/web/src/lib/keymap.ts
import { isMac } from './platform';

export interface ShortcutSpec {
  /** Lowercase key name (e.g. 'k', 'f', 'arrowleft', '['). */
  key: string;
  /** Cmd on mac, Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

function normalizeKey(k: string): string {
  return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
}

export function matchShortcut(ev: KeyboardEvent, spec: ShortcutSpec): boolean {
  if (normalizeKey(ev.key) !== normalizeKey(spec.key)) return false;
  const mac = isMac();
  const modPressed = mac ? ev.metaKey : ev.ctrlKey;
  const wrongModPressed = mac ? ev.ctrlKey : ev.metaKey;
  if (!!spec.mod !== modPressed) return false;
  if (wrongModPressed) return false;
  if (!!spec.shift !== ev.shiftKey) return false;
  if (!!spec.alt !== ev.altKey) return false;
  return true;
}
```

- [ ] **Step 4: Run tests**

Run: `npm --workspace=@zenterm/web test -- src/lib/__tests__/platform.test.ts src/lib/__tests__/keymap.test.ts`
Expected: PASS (8/8 total).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/platform.ts \
        packages/web/src/lib/keymap.ts \
        packages/web/src/lib/__tests__/platform.test.ts \
        packages/web/src/lib/__tests__/keymap.test.ts
git commit -m "feat(web): platform detection + keymap matcher (⌘ on mac, Ctrl elsewhere)"
```

---

## Task 3: `useLayoutStore` + Sidebar 折りたたみ

**Files:**
- Create: `packages/web/src/stores/layout.ts`
- Test: `packages/web/src/stores/__tests__/layout.test.ts`
- Modify: `packages/web/src/components/Sidebar.tsx`

- [ ] **Step 1: Write the failing test (store)**

```ts
// packages/web/src/stores/__tests__/layout.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../layout';

describe('useLayoutStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({
      sidebarCollapsed: false,
      paletteOpen: false,
      layoutMenuOpen: false,
    });
  });

  it('has sane defaults', () => {
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(false);
  });

  it('toggles sidebarCollapsed', () => {
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
  });

  it('opens and closes the palette', () => {
    useLayoutStore.getState().openPalette();
    expect(useLayoutStore.getState().paletteOpen).toBe(true);
    useLayoutStore.getState().closePalette();
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
  });

  it('opens and closes the layout menu', () => {
    useLayoutStore.getState().openLayoutMenu();
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(true);
    useLayoutStore.getState().closeLayoutMenu();
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(false);
  });

  it('persists sidebarCollapsed only (not transient open flags)', () => {
    useLayoutStore.getState().toggleSidebar();
    useLayoutStore.getState().openPalette();
    const raw = localStorage.getItem('zenterm-web-layout');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { state: Record<string, unknown> };
    expect(parsed.state.sidebarCollapsed).toBe(true);
    expect(parsed.state.paletteOpen).toBeUndefined();
    expect(parsed.state.layoutMenuOpen).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npm --workspace=@zenterm/web test -- src/stores/__tests__/layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement layout store**

```ts
// packages/web/src/stores/layout.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface LayoutState {
  sidebarCollapsed: boolean;
  paletteOpen: boolean;
  layoutMenuOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  openLayoutMenu: () => void;
  closeLayoutMenu: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      paletteOpen: false,
      layoutMenuOpen: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      openPalette: () => set({ paletteOpen: true }),
      closePalette: () => set({ paletteOpen: false }),
      openLayoutMenu: () => set({ layoutMenuOpen: true }),
      closeLayoutMenu: () => set({ layoutMenuOpen: false }),
    }),
    {
      name: 'zenterm-web-layout',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
```

- [ ] **Step 4: Run — pass**

Run: `npm --workspace=@zenterm/web test -- src/stores/__tests__/layout.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Write failing Sidebar test**

```tsx
// packages/web/src/components/__tests__/Sidebar.collapse.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { useLayoutStore } from '@/stores/layout';

function renderSidebar(collapsed: boolean) {
  useLayoutStore.setState({ sidebarCollapsed: collapsed });
  return render(
    <MemoryRouter initialEntries={['/web/sessions']}>
      <Sidebar
        sessions={[]}
        loading={false}
        error={null}
        activeSessionId={null}
        activeWindowIndex={null}
        onSelect={() => undefined}
        onCreateSession={() => undefined}
        onRenameSession={() => undefined}
        onRequestDeleteSession={() => undefined}
        onCreateWindow={() => undefined}
        onRenameWindow={() => undefined}
        onRequestDeleteWindow={() => undefined}
      />
    </MemoryRouter>,
  );
}

describe('Sidebar collapse', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarCollapsed: false });
  });

  it('renders at full width when not collapsed', () => {
    renderSidebar(false);
    const aside = screen.getByRole('complementary');
    expect(aside.getAttribute('aria-hidden')).not.toBe('true');
    const style = window.getComputedStyle(aside);
    // width set as inline px > 0
    expect(parseInt(style.width, 10)).toBeGreaterThan(0);
  });

  it('hides itself when collapsed', () => {
    renderSidebar(true);
    const aside = screen.getByRole('complementary', { hidden: true });
    expect(aside).toHaveAttribute('aria-hidden', 'true');
    const style = window.getComputedStyle(aside);
    expect(parseInt(style.width, 10)).toBe(0);
  });
});
```

- [ ] **Step 6: Run — should fail (no aria-hidden / no width:0 path)**

Run: `npm --workspace=@zenterm/web test -- src/components/__tests__/Sidebar.collapse.test.tsx`
Expected: FAIL.

- [ ] **Step 7: Modify Sidebar to respect collapsed state**

Open `packages/web/src/components/Sidebar.tsx`. At the top add the layout-store import, derive `collapsed`, and apply it to `<aside>`:

```tsx
// near other imports:
import { useLayoutStore } from '@/stores/layout';

// inside Sidebar() near other hooks:
const collapsed = useLayoutStore((s) => s.sidebarCollapsed);

// when rendering <aside>:
return (
  <aside
    role="complementary"
    aria-hidden={collapsed || undefined}
    style={{
      width: collapsed ? 0 : SIDEBAR_WIDTH,
      flexShrink: 0,
      background: tokens.colors.bgElevated,
      borderRight: collapsed ? 'none' : `1px solid ${tokens.colors.borderSubtle}`,
      display: 'grid',
      gridTemplateRows: '1fr 56px',
      height: '100vh',
      overflow: 'hidden',
      boxSizing: 'border-box',
      // …rest unchanged
    }}
  >
    {collapsed ? null : (
      <>
        {/* existing tabbed-panel + tab row */}
      </>
    )}
  </aside>
);
```

(Keep everything else inside the existing `<aside>` body unchanged — only its width / hidden state and a `null` short-circuit for content when collapsed.)

- [ ] **Step 8: Run all web tests**

Run: `npm --workspace=@zenterm/web test`
Expected: All previously-passing tests still pass + new ones pass.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/stores/layout.ts \
        packages/web/src/stores/__tests__/layout.test.ts \
        packages/web/src/components/Sidebar.tsx \
        packages/web/src/components/__tests__/Sidebar.collapse.test.tsx
git commit -m "feat(web): useLayoutStore (sidebarCollapsed/paletteOpen/layoutMenuOpen) + Sidebar collapse"
```

---

## Task 4: `useShortcuts` hook 基盤 + ⌘B / ⌘,

**Files:**
- Create: `packages/web/src/hooks/useShortcuts.ts`
- Test: `packages/web/src/hooks/__tests__/useShortcuts.test.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/hooks/__tests__/useShortcuts.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShortcuts, type ShortcutHandlers } from '../useShortcuts';

function dispatch(ev: Partial<KeyboardEvent>) {
  // capture-phase listeners see the event; we dispatch on window.
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...ev });
  window.dispatchEvent(event);
  return event;
}

describe('useShortcuts', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires toggleSidebar on ⌘B and prevents default', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    renderHook(() => useShortcuts(handlers));
    const ev = dispatch({ key: 'b', metaKey: true });
    expect(handlers.toggleSidebar).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('fires openSettings on ⌘,', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    renderHook(() => useShortcuts(handlers));
    dispatch({ key: ',', metaKey: true });
    expect(handlers.openSettings).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated keys', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    renderHook(() => useShortcuts(handlers));
    dispatch({ key: 'b' });
    expect(handlers.toggleSidebar).not.toHaveBeenCalled();
  });

  it('does not re-register on identical handler refs across re-renders', () => {
    const handlers: ShortcutHandlers = {
      toggleSidebar: vi.fn(),
      openPalette: vi.fn(),
      openSettings: vi.fn(),
      jumpToWindow: vi.fn(),
      newWindow: vi.fn(),
      closeWindow: vi.fn(),
      focusNextPane: vi.fn(),
      focusPrevPane: vi.fn(),
      openLayoutMenu: vi.fn(),
      openSearch: vi.fn(),
    };
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { rerender } = renderHook(() => useShortcuts(handlers));
    const initialCalls = addSpy.mock.calls.filter((c) => c[0] === 'keydown').length;
    rerender();
    rerender();
    const afterCalls = addSpy.mock.calls.filter((c) => c[0] === 'keydown').length;
    expect(afterCalls).toBe(initialCalls);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm --workspace=@zenterm/web test -- src/hooks/__tests__/useShortcuts.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `useShortcuts`**

```ts
// packages/web/src/hooks/useShortcuts.ts
import { useEffect, useRef } from 'react';
import { matchShortcut, type ShortcutSpec } from '@/lib/keymap';

export interface ShortcutHandlers {
  toggleSidebar: () => void;
  openPalette: () => void;
  openSettings: () => void;
  /** windowOffset is 1..9 (matches ⌘1..⌘9). */
  jumpToWindow: (windowOffset: number) => void;
  newWindow: () => void;
  closeWindow: () => void;
  focusNextPane: () => void;
  focusPrevPane: () => void;
  openLayoutMenu: () => void;
  openSearch: () => void;
}

interface Binding {
  spec: ShortcutSpec;
  run: (ev: KeyboardEvent, handlers: ShortcutHandlers) => void;
}

const BINDINGS: Binding[] = [
  { spec: { key: 'b', mod: true }, run: (_e, h) => h.toggleSidebar() },
  { spec: { key: ',', mod: true }, run: (_e, h) => h.openSettings() },
  { spec: { key: 'k', mod: true }, run: (_e, h) => h.openPalette() },
  { spec: { key: 'f', mod: true }, run: (_e, h) => h.openSearch() },
  { spec: { key: '\\', mod: true }, run: (_e, h) => h.openLayoutMenu() },
  { spec: { key: 't', mod: true }, run: (_e, h) => h.newWindow() },
  { spec: { key: 'w', mod: true }, run: (_e, h) => h.closeWindow() },
  { spec: { key: '[', mod: true }, run: (_e, h) => h.focusPrevPane() },
  { spec: { key: ']', mod: true }, run: (_e, h) => h.focusNextPane() },
  ...['1','2','3','4','5','6','7','8','9'].map<Binding>((d) => ({
    spec: { key: d, mod: true },
    run: (_e, h) => h.jumpToWindow(Number(d)),
  })),
];

export function useShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      for (const b of BINDINGS) {
        if (matchShortcut(ev, b.spec)) {
          ev.preventDefault();
          ev.stopPropagation();
          b.run(ev, handlersRef.current);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}
```

- [ ] **Step 4: Run — pass**

Run: `npm --workspace=@zenterm/web test -- src/hooks/__tests__/useShortcuts.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 5: Wire ⌘B and ⌘, into AuthenticatedShell**

Open `packages/web/src/components/AuthenticatedShell.tsx`. Add imports + `useShortcuts` mount. We stub the not-yet-wired actions with `() => undefined` so the build stays green; later tasks fill them in.

```tsx
// new imports at top:
import { useLayoutStore } from '@/stores/layout';
import { useShortcuts } from '@/hooks/useShortcuts';

// inside AuthenticatedShell() near other hooks (BEFORE the early `if (!token …) return`):
const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
const openPalette = useLayoutStore((s) => s.openPalette);
const openLayoutMenu = useLayoutStore((s) => s.openLayoutMenu);

useShortcuts({
  toggleSidebar,
  openPalette,
  openSettings: () => navigate('/web/settings'),
  jumpToWindow: () => undefined,
  newWindow: () => undefined,
  closeWindow: () => undefined,
  focusNextPane: () => undefined,
  focusPrevPane: () => undefined,
  openLayoutMenu,
  openSearch: () => undefined,
});
```

- [ ] **Step 6: Smoke run typecheck + tests**

Run: `npm --workspace=@zenterm/web run type-check && npm --workspace=@zenterm/web test`
Expected: clean + all green.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/hooks/useShortcuts.ts \
        packages/web/src/hooks/__tests__/useShortcuts.test.tsx \
        packages/web/src/components/AuthenticatedShell.tsx
git commit -m "feat(web): useShortcuts hook + wire ⌘B / ⌘, / ⌘K / ⌘\\\\ (capture phase)"
```

---

## Task 5: ⌘1-9 / ⌘T / ⌘W ショートカット配線

**Files:**
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Test: `packages/web/src/components/__tests__/AuthenticatedShell.shortcuts.test.tsx`

- [ ] **Step 1: Write the failing integration test**

```tsx
// packages/web/src/components/__tests__/AuthenticatedShell.shortcuts.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatedShell } from '../AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';
import { usePaneStore } from '@/stores/pane';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';
import { useLayoutStore } from '@/stores/layout';

function setup() {
  useAuthStore.setState({ token: 't', gatewayUrl: 'http://x' } as never);
  useSessionsStore.setState({
    sessions: [
      { id: 'sX', displayName: 's', windows: [
        { index: 0, name: 'w0' },
        { index: 1, name: 'w1' },
        { index: 2, name: 'w2' },
      ] },
    ],
    loading: false,
    error: null,
  } as never);
  usePaneStore.setState({
    layout: 'single',
    panes: [{ sessionId: 'sX', windowIndex: 0 }, null, null, null],
    focusedIndex: 0,
    ratios: { single: [], 'cols-2': [0.5], 'cols-3': [0.5, 0.5], 'grid-2x2': [0.5], 'main-side-2': [0.6, 0.5] },
    savedLayout: null,
  } as never);
  useLayoutStore.setState({ sidebarCollapsed: false, paletteOpen: false, layoutMenuOpen: false });
  useUiStore.setState({ confirmDialog: null, toasts: [] });
}

function dispatch(ev: Partial<KeyboardEvent>) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...ev }));
}

describe('AuthenticatedShell shortcuts', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    setup();
  });

  it('⌘2 sets focused pane window to index 1', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: '2', metaKey: true }));
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'sX', windowIndex: 1 });
  });

  it('⌘5 is no-op when target window does not exist', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: '5', metaKey: true }));
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'sX', windowIndex: 0 });
  });

  it('⌘W shows a confirm dialog (does not delete unconfirmed)', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: 'w', metaKey: true }));
    expect(useUiStore.getState().confirmDialog).not.toBeNull();
    expect(useUiStore.getState().confirmDialog?.destructive).toBe(true);
  });

  it('⌘T is a no-op when no pane is focused with a session', () => {
    usePaneStore.setState({
      ...usePaneStore.getState(),
      panes: [null, null, null, null],
    } as never);
    const spy = vi.spyOn(useSessionsStore.getState(), 'createWindow').mockResolvedValue();
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: 't', metaKey: true }));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm --workspace=@zenterm/web test -- src/components/__tests__/AuthenticatedShell.shortcuts.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Wire the three actions in AuthenticatedShell**

In `AuthenticatedShell.tsx`, replace the three `() => undefined` stubs added in Task 4:

```tsx
const jumpToWindow = (n: number) => {
  // n is 1-based ⌘1..⌘9; map to 0-based window index inside focused pane.
  const state = usePaneStore.getState();
  const focused = state.panes[state.focusedIndex];
  if (!focused) return;
  const session = useSessionsStore.getState().sessions.find((s) => s.id === focused.sessionId);
  if (!session) return;
  const target = session.windows.find((w) => w.index === n - 1);
  if (!target) return;
  state.assignPane(state.focusedIndex, { sessionId: focused.sessionId, windowIndex: n - 1 });
};

const newWindow = () => {
  const state = usePaneStore.getState();
  const focused = state.panes[state.focusedIndex];
  if (!focused) return;
  const session = useSessionsStore.getState().sessions.find((s) => s.id === focused.sessionId);
  if (!session) return;
  void handleCreateWindow(session.displayName);
};

const closeWindow = () => {
  const state = usePaneStore.getState();
  const focused = state.panes[state.focusedIndex];
  if (!focused) return;
  const session = useSessionsStore.getState().sessions.find((s) => s.id === focused.sessionId);
  if (!session) return;
  const window = session.windows.find((w) => w.index === focused.windowIndex);
  if (!window) return;
  handleRequestDeleteWindow(session.displayName, window);
};
```

Then update the `useShortcuts({...})` call site to pass these three:

```tsx
useShortcuts({
  toggleSidebar,
  openPalette,
  openSettings: () => navigate('/web/settings'),
  jumpToWindow,
  newWindow,
  closeWindow,
  focusNextPane: () => undefined,
  focusPrevPane: () => undefined,
  openLayoutMenu,
  openSearch: () => undefined,
});
```

NOTE: place the `jumpToWindow / newWindow / closeWindow` declarations **after** `handleCreateWindow` and `handleRequestDeleteWindow` are defined in the component body.

- [ ] **Step 4: Run — pass**

Run: `npm --workspace=@zenterm/web test -- src/components/__tests__/AuthenticatedShell.shortcuts.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm --workspace=@zenterm/web run type-check && npm --workspace=@zenterm/web test`
Expected: clean + green.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/AuthenticatedShell.tsx \
        packages/web/src/components/__tests__/AuthenticatedShell.shortcuts.test.tsx
git commit -m "feat(web): wire ⌘1-9 / ⌘T / ⌘W in AuthenticatedShell (focus-pane scoped)"
```

---

## Task 6: ⌘[ / ⌘] / ⌘\\ ペイン操作

**Files:**
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/components/terminal/LayoutSelector.tsx`
- Test: `packages/web/src/components/__tests__/AuthenticatedShell.paneShortcuts.test.tsx`
- Test: `packages/web/src/components/terminal/__tests__/LayoutSelector.externalOpen.test.tsx`

- [ ] **Step 1: Failing test for ⌘[ / ⌘]**

```tsx
// packages/web/src/components/__tests__/AuthenticatedShell.paneShortcuts.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatedShell } from '../AuthenticatedShell';
import { useAuthStore } from '@/stores/auth';
import { usePaneStore } from '@/stores/pane';
import { useSessionsStore } from '@/stores/sessions';
import { useLayoutStore } from '@/stores/layout';

function dispatch(ev: Partial<KeyboardEvent>) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...ev }));
}

describe('Pane focus shortcuts', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    useAuthStore.setState({ token: 't', gatewayUrl: 'http://x' } as never);
    useSessionsStore.setState({ sessions: [], loading: false, error: null } as never);
    useLayoutStore.setState({ sidebarCollapsed: false, paletteOpen: false, layoutMenuOpen: false });
    usePaneStore.setState({
      layout: 'cols-2',
      panes: [
        { sessionId: 'a', windowIndex: 0 },
        { sessionId: 'b', windowIndex: 0 },
        null, null,
      ],
      focusedIndex: 0,
      ratios: { single: [], 'cols-2': [0.5], 'cols-3': [0.5, 0.5], 'grid-2x2': [0.5], 'main-side-2': [0.6, 0.5] },
      savedLayout: null,
    } as never);
  });

  it('⌘] advances focus through occupied slots only', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: ']', metaKey: true }));
    expect(usePaneStore.getState().focusedIndex).toBe(1);
    act(() => dispatch({ key: ']', metaKey: true }));
    // wraps back to 0
    expect(usePaneStore.getState().focusedIndex).toBe(0);
  });

  it('⌘[ moves focus backward', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    act(() => dispatch({ key: '[', metaKey: true }));
    expect(usePaneStore.getState().focusedIndex).toBe(1);
  });

  it('⌘\\ opens the layout menu', () => {
    render(
      <MemoryRouter initialEntries={['/web/sessions']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(false);
    act(() => dispatch({ key: '\\', metaKey: true }));
    expect(useLayoutStore.getState().layoutMenuOpen).toBe(true);
  });
});
```

- [ ] **Step 2: Failing test for LayoutSelector external open**

```tsx
// packages/web/src/components/terminal/__tests__/LayoutSelector.externalOpen.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LayoutSelector } from '../LayoutSelector';
import { useLayoutStore } from '@/stores/layout';

describe('LayoutSelector external open', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarCollapsed: false, paletteOpen: false, layoutMenuOpen: false });
  });
  it('opens the menu when useLayoutStore.layoutMenuOpen flips to true', () => {
    render(<LayoutSelector />);
    expect(screen.queryByRole('menuitemradio', { name: /single/i })).toBeNull();
    act(() => useLayoutStore.getState().openLayoutMenu());
    expect(screen.getByRole('menuitemradio', { name: /single/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `npm --workspace=@zenterm/web test -- src/components/__tests__/AuthenticatedShell.paneShortcuts.test.tsx src/components/terminal/__tests__/LayoutSelector.externalOpen.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement focus cycling + Layout menu external open**

In `AuthenticatedShell.tsx`, add:

```tsx
const focusNextPane = () => {
  const { panes, focusedIndex, layout, setFocusedIndex } = usePaneStore.getState();
  const { SLOT_COUNT } = require('@/lib/paneLayout') as typeof import('@/lib/paneLayout');
  // Build a list of occupied indices in the current layout's slot range.
  // Use named import via static module to avoid require:
  // (replace the dynamic require above with the static import shown at top of file)
};
```

Actually do it properly — replace the snippet above with this complete approach:

At the top of `AuthenticatedShell.tsx`, add:

```tsx
import { SLOT_COUNT } from '@/lib/paneLayout';
```

Then inside the component body:

```tsx
const cyclePane = (dir: 1 | -1) => {
  const { panes, focusedIndex, layout, setFocusedIndex } = usePaneStore.getState();
  const slotCount = SLOT_COUNT[layout];
  const occupied: number[] = [];
  for (let i = 0; i < slotCount; i++) if (panes[i]) occupied.push(i);
  if (occupied.length === 0) return;
  const here = occupied.indexOf(focusedIndex);
  // If focused index isn't in occupied (e.g. it was nulled), jump to first.
  const startPos = here === -1 ? 0 : here;
  const len = occupied.length;
  const nextPos = (startPos + dir + len) % len;
  setFocusedIndex(occupied[nextPos]);
};
const focusNextPane = () => cyclePane(1);
const focusPrevPane = () => cyclePane(-1);
```

Pass them to `useShortcuts({...})`.

In `LayoutSelector.tsx`, replace the **local** `const [open, setOpen] = useState(false);` with `useLayoutStore`-driven open state:

```tsx
import { useLayoutStore } from '@/stores/layout';

// inside the component:
const open = useLayoutStore((s) => s.layoutMenuOpen);
const openMenu = useLayoutStore((s) => s.openLayoutMenu);
const closeMenu = useLayoutStore((s) => s.closeLayoutMenu);

// Replace setOpen(true) calls with openMenu(); setOpen(false) with closeMenu(); etc.
// Toolbar button onClick: () => (open ? closeMenu() : openMenu())
```

Make sure outside-click / Escape handlers call `closeMenu()` instead of the old `setOpen(false)`.

- [ ] **Step 5: Run — pass**

Run: `npm --workspace=@zenterm/web test -- src/components/__tests__/AuthenticatedShell.paneShortcuts.test.tsx src/components/terminal/__tests__/LayoutSelector.externalOpen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck**

Run: `npm --workspace=@zenterm/web run type-check && npm --workspace=@zenterm/web test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/AuthenticatedShell.tsx \
        packages/web/src/components/terminal/LayoutSelector.tsx \
        packages/web/src/components/__tests__/AuthenticatedShell.paneShortcuts.test.tsx \
        packages/web/src/components/terminal/__tests__/LayoutSelector.externalOpen.test.tsx
git commit -m "feat(web): ⌘[/⌘] pane cycling + ⌘\\\\ opens LayoutSelector via useLayoutStore"
```

---

## Task 7: xterm SearchAddon + TerminalSearch UI + ⌘F

**Files:**
- Modify: `packages/web/package.json` (+ `@xterm/addon-search`)
- Modify: `packages/web/src/components/terminal/XtermView.tsx`
- Create: `packages/web/src/components/terminal/TerminalSearch.tsx`
- Modify: `packages/web/src/components/TerminalPane.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx` (wire `openSearch`)
- Modify: `packages/web/src/stores/layout.ts` (add `searchOpen`)
- Test: `packages/web/src/components/terminal/__tests__/TerminalSearch.test.tsx`

- [ ] **Step 1: Install dependency**

```bash
npm --workspace=@zenterm/web install @xterm/addon-search@^0.16.0
```

Expected: package.json updated, no security errors.

- [ ] **Step 2: Extend layout store with `searchOpen`**

Edit `packages/web/src/stores/layout.ts`:

```ts
// add to LayoutState:
searchOpen: boolean;
openSearch: () => void;
closeSearch: () => void;

// add to the store body:
searchOpen: false,
openSearch: () => set({ searchOpen: true }),
closeSearch: () => set({ searchOpen: false }),
```

Update the existing `layout.test.ts` to assert `searchOpen` default is false and that `openSearch/closeSearch` toggle it; do NOT add it to `partialize` (transient).

- [ ] **Step 3: Failing test for TerminalSearch UI**

```tsx
// packages/web/src/components/terminal/__tests__/TerminalSearch.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalSearch, type TerminalSearchApi } from '../TerminalSearch';

function makeApi(): TerminalSearchApi {
  return {
    findNext: vi.fn(() => true),
    findPrevious: vi.fn(() => true),
    clearDecorations: vi.fn(),
  };
}

describe('TerminalSearch', () => {
  beforeEach(() => undefined);

  it('renders an input and calls findNext on Enter', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    const onClose = vi.fn();
    render(<TerminalSearch open api={api} onClose={onClose} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'hello{Enter}');
    expect(api.findNext).toHaveBeenCalledWith('hello', expect.any(Object));
  });

  it('Shift+Enter calls findPrevious', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<TerminalSearch open api={api} onClose={vi.fn()} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'hi');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(api.findPrevious).toHaveBeenCalledWith('hi', expect.any(Object));
  });

  it('Escape clears decorations and calls onClose', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    const onClose = vi.fn();
    render(<TerminalSearch open api={api} onClose={onClose} />);
    await user.type(screen.getByRole('searchbox'), '{Escape}');
    expect(api.clearDecorations).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null when closed', () => {
    const api = makeApi();
    const { container } = render(<TerminalSearch open={false} api={api} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('toggles case sensitivity', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<TerminalSearch open api={api} onClose={vi.fn()} />);
    await user.type(screen.getByRole('searchbox'), 'X');
    await user.click(screen.getByRole('button', { name: /case sensitive/i }));
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(api.findNext).toHaveBeenCalledWith('X', expect.objectContaining({ caseSensitive: true }));
  });
});
```

- [ ] **Step 4: Run — fail**

Run: `npm --workspace=@zenterm/web test -- src/components/terminal/__tests__/TerminalSearch.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement TerminalSearch**

```tsx
// packages/web/src/components/terminal/TerminalSearch.tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

export interface TerminalSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface TerminalSearchApi {
  findNext: (query: string, opts: TerminalSearchOptions) => boolean;
  findPrevious: (query: string, opts: TerminalSearchOptions) => boolean;
  clearDecorations: () => void;
}

export interface TerminalSearchProps {
  open: boolean;
  api: TerminalSearchApi;
  onClose: () => void;
}

export function TerminalSearch({ open, api, onClose }: TerminalSearchProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const opts: TerminalSearchOptions = { caseSensitive, wholeWord, regex };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (!query) return;
      if (ev.shiftKey) api.findPrevious(query, opts);
      else api.findNext(query, opts);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      api.clearDecorations();
      onClose();
    }
  };

  const toggleBtn = (active: boolean, onClick: () => void, label: string, glyph: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        background: active ? tokens.colors.primarySubtle : 'transparent',
        border: `1px solid ${active ? tokens.colors.primary : tokens.colors.borderSubtle}`,
        color: active ? tokens.colors.primary : tokens.colors.textSecondary,
        padding: '2px 6px',
        borderRadius: tokens.radii.sm,
        cursor: 'pointer',
        fontSize: tokens.typography.caption.fontSize,
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        gap: tokens.spacing.xs,
        alignItems: 'center',
        padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        background: tokens.colors.bgElevated,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('terminal.search.placeholder')}
        style={{
          flex: 1,
          background: tokens.colors.surface,
          border: `1px solid ${tokens.colors.borderSubtle}`,
          color: tokens.colors.textPrimary,
          padding: `2px 6px`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.caption.fontSize,
        }}
      />
      {toggleBtn(caseSensitive, () => setCaseSensitive((v) => !v), t('terminal.search.caseSensitive'), 'Aa')}
      {toggleBtn(wholeWord, () => setWholeWord((v) => !v), t('terminal.search.wholeWord'), 'W')}
      {toggleBtn(regex, () => setRegex((v) => !v), t('terminal.search.regex'), '.*')}
      <button
        type="button"
        aria-label={t('terminal.search.findPrev')}
        onClick={() => query && api.findPrevious(query, opts)}
        style={{ background: 'transparent', border: 'none', color: tokens.colors.textSecondary, cursor: 'pointer' }}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={t('terminal.search.findNext')}
        onClick={() => query && api.findNext(query, opts)}
        style={{ background: 'transparent', border: 'none', color: tokens.colors.textSecondary, cursor: 'pointer' }}
      >
        ↓
      </button>
      <button
        type="button"
        aria-label={t('terminal.search.close')}
        onClick={() => {
          api.clearDecorations();
          onClose();
        }}
        style={{ background: 'transparent', border: 'none', color: tokens.colors.textSecondary, cursor: 'pointer' }}
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Wire SearchAddon into XtermView**

Edit `packages/web/src/components/terminal/XtermView.tsx`:

```tsx
// add import:
import { SearchAddon } from '@xterm/addon-search';

// extend XtermViewProps:
onSearchReady?: (api: TerminalSearchApi) => void;

// Add searchRef + load addon in the mount effect, near fitRef:
const searchRef = useRef<SearchAddon | null>(null);

// inside the mount effect, after term.loadAddon(new WebLinksAddon()):
const search = new SearchAddon();
term.loadAddon(search);
searchRef.current = search;

// after creating `actions`:
const searchApi: TerminalSearchApi = {
  findNext: (q, opts) => search.findNext(q, opts),
  findPrevious: (q, opts) => search.findPrevious(q, opts),
  clearDecorations: () => search.clearDecorations(),
};
onSearchReady?.(searchApi);

// in cleanup:
searchRef.current = null;
```

(Import `type TerminalSearchApi` from `./TerminalSearch` at the top.)

- [ ] **Step 7: Wire `<TerminalSearch>` into TerminalPane**

In `packages/web/src/components/TerminalPane.tsx`:

```tsx
// new imports:
import { useState } from 'react';
import { useLayoutStore } from '@/stores/layout';
import { TerminalSearch, type TerminalSearchApi } from '@/components/terminal/TerminalSearch';

// inside the component body:
const [searchApi, setSearchApi] = useState<TerminalSearchApi | null>(null);
const searchOpen = useLayoutStore((s) => s.searchOpen);
const closeSearch = useLayoutStore((s) => s.closeSearch);

// Pass onSearchReady={setSearchApi} to <XtermView>.
// Render <TerminalSearch open={searchOpen && isFocused && !!searchApi} api={searchApi!} onClose={closeSearch} /> above the XtermView.
```

Make sure the search bar appears **above** the XtermView container inside the pane. Wrap them in a `<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>`.

- [ ] **Step 8: Wire `openSearch` in AuthenticatedShell**

Replace `openSearch: () => undefined` with:

```tsx
openSearch: useLayoutStore.getState().openSearch,
```

(Or define `const openSearch = useLayoutStore((s) => s.openSearch);` near the other layout-store reads.)

- [ ] **Step 9: Run all web tests + typecheck**

Run: `npm --workspace=@zenterm/web run type-check && npm --workspace=@zenterm/web test`
Expected: green.

- [ ] **Step 10: Commit**

```bash
git add packages/web/package.json packages/web/package-lock.json \
        packages/web/src/stores/layout.ts \
        packages/web/src/stores/__tests__/layout.test.ts \
        packages/web/src/components/terminal/XtermView.tsx \
        packages/web/src/components/terminal/TerminalSearch.tsx \
        packages/web/src/components/terminal/__tests__/TerminalSearch.test.tsx \
        packages/web/src/components/TerminalPane.tsx \
        packages/web/src/components/AuthenticatedShell.tsx
git commit -m "feat(web): xterm SearchAddon + TerminalSearch UI + ⌘F (focused pane)"
```

---

## Task 8: Command Palette (⌘K)

**Files:**
- Modify: `packages/web/package.json` (+ `fuse.js`)
- Create: `packages/web/src/lib/commandPaletteActions.ts`
- Create: `packages/web/src/lib/__tests__/commandPaletteActions.test.ts`
- Create: `packages/web/src/components/CommandPalette.tsx`
- Create: `packages/web/src/components/__tests__/CommandPalette.test.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx` (mount `<CommandPalette />`)

- [ ] **Step 1: Install fuse.js**

```bash
npm --workspace=@zenterm/web install fuse.js@^7.0.0
```

- [ ] **Step 2: Failing tests for action catalog**

```ts
// packages/web/src/lib/__tests__/commandPaletteActions.test.ts
import { describe, it, expect } from 'vitest';
import { buildCommandPaletteActions } from '../commandPaletteActions';

describe('buildCommandPaletteActions', () => {
  const sessions = [
    { id: 's1', displayName: 'work', windows: [
      { index: 0, name: 'editor' },
      { index: 1, name: 'shell' },
    ] },
    { id: 's2', displayName: 'play', windows: [{ index: 0, name: '0' }] },
  ];

  it('includes static actions: create session / layouts / theme / settings / files / sessions', () => {
    const actions = buildCommandPaletteActions({
      sessions,
      navigate: () => undefined,
      paneActions: { setLayout: () => undefined },
      settingsActions: { setThemeMode: () => undefined },
      sessionsActions: { createSession: () => undefined },
    });
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('action:create-session');
    expect(ids).toContain('action:layout:single');
    expect(ids).toContain('action:layout:cols-2');
    expect(ids).toContain('action:layout:cols-3');
    expect(ids).toContain('action:layout:grid-2x2');
    expect(ids).toContain('action:layout:main-side-2');
    expect(ids).toContain('action:theme:light');
    expect(ids).toContain('action:theme:dark');
    expect(ids).toContain('action:theme:system');
    expect(ids).toContain('action:nav:settings');
    expect(ids).toContain('action:nav:files');
    expect(ids).toContain('action:nav:sessions');
  });

  it('includes one entry per session window', () => {
    const actions = buildCommandPaletteActions({
      sessions,
      navigate: () => undefined,
      paneActions: { setLayout: () => undefined },
      settingsActions: { setThemeMode: () => undefined },
      sessionsActions: { createSession: () => undefined },
    });
    const sessionEntries = actions.filter((a) => a.id.startsWith('jump:'));
    expect(sessionEntries).toHaveLength(3);
    expect(sessionEntries.map((a) => a.label).sort()).toEqual([
      'Open work / editor',
      'Open work / shell',
      'Open play / 0',
    ].sort());
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `npm --workspace=@zenterm/web test -- src/lib/__tests__/commandPaletteActions.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement action catalog**

```ts
// packages/web/src/lib/commandPaletteActions.ts
import type { TmuxSession } from '@zenterm/shared';
import type { LayoutMode } from './paneLayout';
import type { ThemeMode } from '@/stores/settings';

export interface PaletteAction {
  id: string;
  label: string;
  keywords?: string;
  run: () => void;
}

interface BuildArgs {
  sessions: TmuxSession[];
  navigate: (path: string) => void;
  paneActions: {
    setLayout: (mode: LayoutMode) => void;
  };
  settingsActions: {
    setThemeMode: (m: ThemeMode) => void;
  };
  sessionsActions: {
    createSession: () => void;
  };
}

const LAYOUTS: { mode: LayoutMode; label: string }[] = [
  { mode: 'single', label: 'Single' },
  { mode: 'cols-2', label: '2 columns' },
  { mode: 'cols-3', label: '3 columns' },
  { mode: 'grid-2x2', label: '2x2 grid' },
  { mode: 'main-side-2', label: 'Main + 2 side' },
];

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

export function buildCommandPaletteActions(args: BuildArgs): PaletteAction[] {
  const out: PaletteAction[] = [];

  out.push({
    id: 'action:create-session',
    label: 'Create new session',
    keywords: 'new tmux',
    run: () => args.sessionsActions.createSession(),
  });

  for (const l of LAYOUTS) {
    out.push({
      id: `action:layout:${l.mode}`,
      label: `Layout: ${l.label}`,
      keywords: 'split pane',
      run: () => args.paneActions.setLayout(l.mode),
    });
  }
  for (const t of THEMES) {
    out.push({
      id: `action:theme:${t.mode}`,
      label: `Theme: ${t.label}`,
      keywords: 'color',
      run: () => args.settingsActions.setThemeMode(t.mode),
    });
  }
  out.push({ id: 'action:nav:settings', label: 'Open settings', run: () => args.navigate('/web/settings') });
  out.push({ id: 'action:nav:files', label: 'Open files', run: () => args.navigate('/web/files') });
  out.push({ id: 'action:nav:sessions', label: 'Open sessions', run: () => args.navigate('/web/sessions') });

  for (const s of args.sessions) {
    for (const w of s.windows) {
      out.push({
        id: `jump:${s.id}:${w.index}`,
        label: `Open ${s.displayName} / ${w.name}`,
        keywords: `session window ${s.id}`,
        run: () => {
          /* concrete jump action is wired by the palette consumer; left as runtime hook. */
          /* We'll let the consumer post-process or override `run` to call paneStore.openInFocusedPane. */
          args.navigate(`/web/sessions`); /* fallback */
        },
      });
    }
  }
  return out;
}
```

NOTE: the "jump:" runs are intentionally minimal — the palette consumer will override their `run` to call `paneStore.openInFocusedPane` directly. We expose the parsed identity via the `id` (`jump:<sessionId>:<windowIndex>`).

- [ ] **Step 5: Run — pass**

Run: `npm --workspace=@zenterm/web test -- src/lib/__tests__/commandPaletteActions.test.ts`
Expected: PASS.

- [ ] **Step 6: Failing tests for CommandPalette**

```tsx
// packages/web/src/components/__tests__/CommandPalette.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../CommandPalette';
import { useLayoutStore } from '@/stores/layout';
import { useSessionsStore } from '@/stores/sessions';
import { useSettingsStore } from '@/stores/settings';
import { usePaneStore } from '@/stores/pane';

describe('CommandPalette', () => {
  beforeEach(() => {
    useLayoutStore.setState({ paletteOpen: false, sidebarCollapsed: false, layoutMenuOpen: false, searchOpen: false });
    useSessionsStore.setState({ sessions: [], loading: false, error: null } as never);
    useSettingsStore.setState({ themeMode: 'system' } as never);
    usePaneStore.setState({
      layout: 'single',
      panes: [null, null, null, null],
      focusedIndex: 0,
      ratios: { single: [], 'cols-2': [0.5], 'cols-3': [0.5, 0.5], 'grid-2x2': [0.5], 'main-side-2': [0.6, 0.5] },
      savedLayout: null,
    } as never);
  });

  it('renders nothing when paletteOpen is false', () => {
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shows actions when opened and filters by query', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => useLayoutStore.getState().openPalette());
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), 'theme');
    const items = screen.getAllByRole('option');
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) expect(it.textContent?.toLowerCase()).toContain('theme');
  });

  it('Enter runs the highlighted action and closes the palette', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => useLayoutStore.getState().openPalette());
    await user.type(screen.getByRole('combobox'), 'dark theme');
    await user.keyboard('{Enter}');
    expect(useSettingsStore.getState().themeMode).toBe('dark');
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
  });

  it('Escape closes the palette without running anything', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => useLayoutStore.getState().openPalette());
    await user.keyboard('{Escape}');
    expect(useLayoutStore.getState().paletteOpen).toBe(false);
  });

  it('"jump:" actions call paneStore.openInFocusedPane', async () => {
    useSessionsStore.setState({
      sessions: [{
        id: 'sZ', displayName: 'zztop',
        windows: [{ index: 0, name: 'main' }],
      }],
      loading: false, error: null,
    } as never);
    const user = userEvent.setup();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    act(() => useLayoutStore.getState().openPalette());
    await user.type(screen.getByRole('combobox'), 'zztop');
    await user.keyboard('{Enter}');
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'sZ', windowIndex: 0 });
  });
});
```

- [ ] **Step 7: Run — fail**

Run: `npm --workspace=@zenterm/web test -- src/components/__tests__/CommandPalette.test.tsx`
Expected: FAIL.

- [ ] **Step 8: Implement CommandPalette**

```tsx
// packages/web/src/components/CommandPalette.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { useLayoutStore } from '@/stores/layout';
import { useSessionsStore } from '@/stores/sessions';
import { useSettingsStore } from '@/stores/settings';
import { usePaneStore } from '@/stores/pane';
import { buildCommandPaletteActions, type PaletteAction } from '@/lib/commandPaletteActions';

export function CommandPalette() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const open = useLayoutStore((s) => s.paletteOpen);
  const closePalette = useLayoutStore((s) => s.closePalette);
  const navigate = useNavigate();
  const sessions = useSessionsStore((s) => s.sessions);

  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHighlight(0);
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  const actions = useMemo<PaletteAction[]>(() => {
    const built = buildCommandPaletteActions({
      sessions,
      navigate,
      paneActions: { setLayout: (m) => usePaneStore.getState().setLayout(m) },
      settingsActions: { setThemeMode: (m) => useSettingsStore.getState().setThemeMode(m) },
      sessionsActions: {
        createSession: () => {
          // Defer to the caller; we just navigate to sessions and let the user click "New session".
          navigate('/web/sessions');
        },
      },
    });
    // Override "jump:" actions to actually open the target in the focused pane.
    return built.map((a) => {
      if (!a.id.startsWith('jump:')) return a;
      const [, sessionId, windowIndexRaw] = a.id.split(':');
      const windowIndex = Number(windowIndexRaw);
      return {
        ...a,
        run: () => {
          usePaneStore.getState().openInFocusedPane({ sessionId, windowIndex });
        },
      };
    });
  }, [sessions, navigate]);

  const filtered = useMemo<PaletteAction[]>(() => {
    if (!query.trim()) return actions;
    const fuse = new Fuse(actions, {
      keys: ['label', 'keywords'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    return fuse.search(query).map((r) => r.item);
  }, [actions, query]);

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  if (!open) return null;

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      closePalette();
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const target = filtered[highlight];
      if (!target) return;
      target.run();
      closePalette();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('palette.title')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 200,
      }}
    >
      <div
        style={{
          width: 'min(640px, 90vw)',
          background: tokens.colors.bgElevated,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radii.md,
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-listbox"
          aria-autocomplete="list"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('palette.placeholder')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
            color: tokens.colors.textPrimary,
            padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
            fontSize: tokens.typography.bodyMedium.fontSize,
            outline: 'none',
          }}
        />
        <ul
          id="palette-listbox"
          role="listbox"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            overflow: 'auto',
          }}
        >
          {filtered.map((a, i) => {
            const active = i === highlight;
            return (
              <li
                key={a.id}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  a.run();
                  closePalette();
                }}
                style={{
                  padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
                  background: active ? tokens.colors.surfaceHover : 'transparent',
                  color: tokens.colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: tokens.typography.smallMedium.fontSize,
                }}
              >
                {a.label}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li
              role="option"
              aria-selected={false}
              style={{
                padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
                color: tokens.colors.textMuted,
                fontSize: tokens.typography.caption.fontSize,
              }}
            >
              {t('palette.noResults')}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Mount in AuthenticatedShell**

In `AuthenticatedShell.tsx`, add at the top of the JSX (sibling of `<div>` root, like `<ConfirmDialogHost />`):

```tsx
return (
  <>
    <div style={{ display: 'flex', height: '100vh', background: tokens.colors.bg }}>
      {/* … existing children … */}
    </div>
    <CommandPalette />
  </>
);
```

(Add `import { CommandPalette } from './CommandPalette';` at the top.)

- [ ] **Step 10: Run — pass**

Run: `npm --workspace=@zenterm/web test -- src/components/__tests__/CommandPalette.test.tsx`
Expected: PASS.

- [ ] **Step 11: Full suite**

Run: `npm --workspace=@zenterm/web run type-check && npm --workspace=@zenterm/web test`
Expected: green.

- [ ] **Step 12: Commit**

```bash
git add packages/web/package.json packages/web/package-lock.json \
        packages/web/src/lib/commandPaletteActions.ts \
        packages/web/src/lib/__tests__/commandPaletteActions.test.ts \
        packages/web/src/components/CommandPalette.tsx \
        packages/web/src/components/__tests__/CommandPalette.test.tsx \
        packages/web/src/components/AuthenticatedShell.tsx
git commit -m "feat(web): Command Palette (⌘K) with fuse.js + static catalog + session jumps"
```

---

## Task 9: Tooltip ロールアウト (アイコンボタン)

**Files:**
- Modify: `packages/web/src/components/terminal/TerminalHeader.tsx`
- Modify: `packages/web/src/components/sidebar/RowActionsMenu.tsx` (kebab トリガに tooltip — 既存があれば確認)
- Modify: `packages/web/src/components/Sidebar.tsx` (tab ボタンに tooltip)
- Test: `packages/web/src/components/terminal/__tests__/TerminalHeader.tooltip.test.tsx`

- [ ] **Step 1: Failing test for TerminalHeader tooltip**

```tsx
// packages/web/src/components/terminal/__tests__/TerminalHeader.tooltip.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalHeader } from '../TerminalHeader';

const baseProps = {
  sessionId: 'sX',
  windowIndex: 0,
  displayName: 'demo',
  windowName: 'w',
  status: 'connected' as const,
  reconnectInfo: null,
  fontSize: 14,
  onReconnect: () => undefined,
  onCopySessionId: () => undefined,
  onZoomIn: () => undefined,
  onZoomOut: () => undefined,
  onZoomReset: () => undefined,
};

describe('TerminalHeader tooltips', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows tooltip when hovering the ID button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TerminalHeader {...baseProps} />);
    const idBtn = screen.getByRole('button', { name: /copy session id/i });
    await user.hover(idBtn);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('tooltip')).toHaveTextContent(/copy session id/i);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `npm --workspace=@zenterm/web test -- src/components/terminal/__tests__/TerminalHeader.tooltip.test.tsx`
Expected: FAIL (no tooltip rendered).

- [ ] **Step 3: Wrap selected buttons in Tooltip**

In `TerminalHeader.tsx`:
- import `{ Tooltip } from '@/components/ui/Tooltip'`.
- Wrap the **ID button** in `<Tooltip label={t('terminal.copySessionId')}>…</Tooltip>`.
- Wrap **zoom in / zoom out / zoom reset** with their respective i18n labels.
- Wrap the **reconnect button** in a Tooltip with `t('terminal.reconnect')`.

In `Sidebar.tsx`:
- Wrap each tab button (sessions / files / settings) in `<Tooltip label={t('sidebar.tabs.' + key)}>` (the visible label can already be there; tooltip is fine even when icon-only).

- [ ] **Step 4: Run all tests**

Run: `npm --workspace=@zenterm/web run type-check && npm --workspace=@zenterm/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/terminal/TerminalHeader.tsx \
        packages/web/src/components/terminal/__tests__/TerminalHeader.tooltip.test.tsx \
        packages/web/src/components/Sidebar.tsx
git commit -m "feat(web): wrap header + sidebar tab buttons in Tooltip"
```

---

## Task 10: i18n キー追加 + E2E + バンドル差し替え

**Files:**
- Modify: `packages/web/src/i18n/locales/en.json`
- Modify: `packages/web/src/i18n/locales/ja.json`
- Create: `tests/e2e/web/shortcuts.spec.ts`
- Modify: `packages/gateway/public/web/index.html`

- [ ] **Step 1: Add i18n keys**

Add the following structures to **both** `en.json` and `ja.json`. EN values are shown; JA values follow in `[brackets]`.

```json
"palette": {
  "title": "Command Palette",     // ["コマンドパレット"]
  "placeholder": "Type a command or session name…",  // ["コマンドかセッション名を入力…"]
  "noResults": "No matches"        // ["該当なし"]
},
"terminal": {
  /* … existing keys … */
  "search": {
    "placeholder": "Search…",       // ["検索…"]
    "caseSensitive": "Case sensitive", // ["大文字小文字区別"]
    "wholeWord": "Whole word",      // ["単語単位"]
    "regex": "Regular expression",  // ["正規表現"]
    "findNext": "Find next",        // ["次へ"]
    "findPrev": "Find previous",    // ["前へ"]
    "close": "Close search"         // ["検索を閉じる"]
  }
}
```

(Insert "search" inside the existing `terminal` object — do **not** create a second `terminal` key.)

- [ ] **Step 2: Run i18n parity test**

Run: `npm --workspace=@zenterm/web test -- src/i18n/__tests__`
Expected: PASS (keys match across locales).

- [ ] **Step 3: Failing E2E test**

```ts
// tests/e2e/web/shortcuts.spec.ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4812';
const PORT = 18812;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-shortcuts-'));
  mkdirSync(join(home, '.config', 'zenterm'), { recursive: true });
  writeFileSync(
    join(home, '.config', 'zenterm', '.env'),
    `AUTH_TOKEN=${TOKEN}\nPORT=${PORT}\nHOST=127.0.0.1\n`,
  );
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
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch { /* ignore */ }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  gateway?.kill();
});

test('⌘K opens Command Palette; Escape closes', async ({ page }) => {
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByLabel(/Sessions panel/i)).toBeVisible({ timeout: 5000 });

  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('combobox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox')).toBeHidden();
});

test('⌘B toggles sidebar', async ({ page }) => {
  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  const aside = page.getByRole('complementary');
  await expect(aside).toBeVisible();
  await page.keyboard.press('Meta+b');
  await expect(aside).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Meta+b');
  await expect(aside).not.toHaveAttribute('aria-hidden', 'true');
});
```

- [ ] **Step 4: Build the web bundle and update bundle ref**

Run: `npm --workspace=@zenterm/web run build`
Expected: writes a new hashed file into `packages/gateway/public/web/assets/index-<hash>.js`.

Then update `packages/gateway/public/web/index.html`:
- replace the existing `<script type="module" src="/web/assets/index-<OLD>.js">` line with the new hash from the build output.

- [ ] **Step 5: Build the gateway**

Run: `npm --workspace=@zenterm/gateway run build`
Expected: clean.

- [ ] **Step 6: Run E2E**

Run: `npm test -- tests/e2e/web/shortcuts.spec.ts` (or whatever the project's existing e2e runner command is — match Phase 3 conventions).
Expected: 2/2 PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/i18n/locales/en.json \
        packages/web/src/i18n/locales/ja.json \
        packages/gateway/public/web/index.html \
        tests/e2e/web/shortcuts.spec.ts
git commit -m "feat(web): i18n keys + bundle ref + e2e shortcuts spec"
```

---

## Task 11: Final review + 完成タグ作業 (実行スキル側で実施)

After all 10 tasks pass, the executing skill (`superpowers:subagent-driven-development`) dispatches a final code reviewer and then hands off to `superpowers:finishing-a-development-branch` to:
1. Run the full test suite on the merged branch
2. Merge `feature/web-pc-phase-4a` to `main` with `--no-ff`
3. Tag `web-pc-phase-4a-done`
4. Push both refs

This task has no implementation steps — it is the wrap-up handoff.

---

## Cross-cutting notes for implementers

- **Capture phase**: `useShortcuts` uses `addEventListener('keydown', ..., true)` so it runs **before** xterm's `attachCustomKeyEventHandler`. Verify with the unit test that ⌘ events have `defaultPrevented === true` after the hook fires.
- **No window-index 1-based confusion**: tmux windows in this codebase are 0-indexed (`index: 0`). The ⌘1..⌘9 binding maps the **digit** to a **1-based slot** and converts to 0-based via `digit - 1`. Code: see Task 5 `jumpToWindow`.
- **⌘\\ menu opening**: `LayoutSelector` previously kept its `open` flag in local state. We migrate it to `useLayoutStore.layoutMenuOpen`. Outside-click/Escape must call `closeLayoutMenu` (not the removed local setter).
- **TerminalSearch sits inside the focused pane**: it must render even when there is no `searchApi` yet → guard with `searchApi != null` (gate the entire `<TerminalSearch>` render, not just the prop).
- **Search API stability**: `XtermView` calls `onSearchReady` only once on mount. If parent re-renders, the callback identity must be stable (use `setSearchApi` directly; do not wrap in another ref).
- **fuse.js threshold tuning**: 0.4 is a sensible middle ground; tweak only if reviewer says results are too fuzzy/strict.
- **i18n parity**: the existing test file `packages/web/src/i18n/__tests__/parity.test.ts` (or equivalent) compares EN/JA key sets — every new key must be added to both files at the same time or this test fails.
- **No persisted `paletteOpen` / `layoutMenuOpen` / `searchOpen`**: they're transient. The persist `partialize` only emits `sidebarCollapsed`.
