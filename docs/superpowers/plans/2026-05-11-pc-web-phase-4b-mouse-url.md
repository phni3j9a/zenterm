# Phase 4b (マウス / URL 系) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC web に右クリックメニュー拡張、Sidebar 幅ドラッグ可変、ターミナル領域への D&D ファイルアップロード、URL ディープリンクを追加し、spec の Phase 4 マウス / URL 系 4 項目 (#3 / #4 / #5 / #6) を完了する。

**Architecture:**
- 既存 ContextMenu 基盤 (RowActionsMenu / TerminalContextMenu) を **拡張** する方針 (新規 ContextMenu 共通コンポーネントは作らない)。
- Sidebar 幅は `useLayoutStore.sidebarWidth: number` を新規追加し、ドラッグ中は `requestAnimationFrame` で batching、commit 時に persist (240-480 でクランプ)。
- ターミナル D&D は `TerminalDropZone` コンポーネント (focused pane の上だけにオーバーレイ) + `ApiClient.uploadFile(file, session.cwd)`。
- URL ディープリンクは `/web/sessions/:id?` + `/web/sessions/:id/window/:index?` を追加し、URL → `usePaneStore.openInFocusedPane` 一方向同期 (focused pane 変化 → URL は本フェーズでは行わない)。

**Tech Stack:**
- React 19 / Zustand 5 (persist) / react-router-dom 7 / xterm.js (既存) / Fastify multipart (既存)
- TypeScript / Vitest 4 + @testing-library/react / Playwright (既存 E2E)

**Phase 4a からの継続事項:**
- ⌘B (Sidebar 折りたたみ) / ⌘K (Palette) / ⌘F (検索) / ⌘1-9 (window 切替) / ⌘[ ⌘] (pane focus 巡回) などのキーは触らない。
- Phase 4a の `useLayoutStore` 既存フィールド (sidebarCollapsed / paletteOpen / layoutMenuOpen / searchOpen) は維持。

**Phase 4b で扱わないもの (Phase 5 polish へ送る):**
- ペイン状態の URL fragment 圧縮 (long URL 問題は対応しない)
- 全 ContextMenu の共通化リファクタ
- WindowRow の open-in-pane アイコン化等 UX 最適化
- Tooltip / aria-describedby clobber 問題 (Phase 4a 引継ぎ)

---

## ファイル構造

### 新規ファイル

```
packages/web/src/
├── components/
│   ├── sidebar/
│   │   └── SidebarResizer.tsx              (Sidebar 右端の drag handle)
│   └── terminal/
│       └── TerminalDropZone.tsx            (focused pane 上の overlay)
├── hooks/
│   └── useUploadProgress.ts                 (進捗トースト state hook)
└── lib/
    └── urlSync.ts                           (URL params <-> paneStore 同期 helper)
```

### 既存ファイル変更

```
packages/web/src/
├── stores/
│   └── layout.ts                            (+ sidebarWidth / setSidebarWidth / persist)
├── components/
│   ├── Sidebar.tsx                          (固定 320 → store.sidebarWidth, Resizer 統合)
│   ├── sidebar/
│   │   └── SessionRow.tsx                   (open-in-pane menu 追加)
│   ├── terminal/
│   │   └── TerminalContextMenu.tsx          (search / new pane 追加)
│   ├── TerminalPane.tsx                     (TerminalDropZone 統合 + onSearch/onNewPane)
│   └── AuthenticatedShell.tsx               (handler 配線 + URL 同期)
├── App.tsx                                  (route 追加)
├── i18n/locales/{en,ja}.json                (新 i18n キー追加)
└── packages/gateway/public/web/index.html   (bundle hash 更新)
```

### E2E
```
tests/e2e/web/
└── phase4b.spec.ts                          (sidebar resize / terminal drop / deep link)
```

---

## Task 1: useLayoutStore に sidebarWidth + persist 追加

**Files:**
- Modify: `packages/web/src/stores/layout.ts`
- Test: `packages/web/src/stores/__tests__/layout.test.ts`

**Context:** Phase 4a で既に `useLayoutStore` は `persist` + `partialize` で `{ sidebarCollapsed }` だけ persist している。これに `sidebarWidth: number` を追加する。デフォルト 320、min 240、max 480 (spec line 450)。

- [ ] **Step 1: 既存テストファイルの import / 設定を確認**

`packages/web/src/stores/__tests__/layout.test.ts` の現状を読み、既存パターンを踏襲。

- [ ] **Step 2: 失敗するテストを追加**

```typescript
// packages/web/src/stores/__tests__/layout.test.ts に追加

describe('sidebarWidth', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarWidth: 320 });
  });

  it('defaults to 320', () => {
    expect(useLayoutStore.getState().sidebarWidth).toBe(320);
  });

  it('setSidebarWidth clamps to 240..480', () => {
    useLayoutStore.getState().setSidebarWidth(100);
    expect(useLayoutStore.getState().sidebarWidth).toBe(240);
    useLayoutStore.getState().setSidebarWidth(600);
    expect(useLayoutStore.getState().sidebarWidth).toBe(480);
    useLayoutStore.getState().setSidebarWidth(350);
    expect(useLayoutStore.getState().sidebarWidth).toBe(350);
  });

  it('setSidebarWidth handles non-finite gracefully', () => {
    const before = useLayoutStore.getState().sidebarWidth;
    useLayoutStore.getState().setSidebarWidth(NaN);
    expect(useLayoutStore.getState().sidebarWidth).toBe(before);
    useLayoutStore.getState().setSidebarWidth(Infinity);
    expect(useLayoutStore.getState().sidebarWidth).toBe(480);
  });

  it('persists sidebarWidth in partialize', () => {
    // Sanity: state shape matches partialize subset
    const s = useLayoutStore.getState();
    expect(typeof s.sidebarWidth).toBe('number');
  });
});
```

- [ ] **Step 3: 実装**

```typescript
// packages/web/src/stores/layout.ts (抜粋・主要変更)

export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 480;
export const SIDEBAR_WIDTH_DEFAULT = 320;

interface LayoutState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;                 // NEW
  paletteOpen: boolean;
  layoutMenuOpen: boolean;
  searchOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;   // NEW
  openPalette: () => void;
  closePalette: () => void;
  openLayoutMenu: () => void;
  closeLayoutMenu: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

// create((set) => ...) 内
sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
setSidebarWidth: (width) =>
  set((state) => {
    if (!Number.isFinite(width)) return state;
    const clamped = Math.max(
      SIDEBAR_WIDTH_MIN,
      Math.min(SIDEBAR_WIDTH_MAX, Math.round(width)),
    );
    return { sidebarWidth: clamped };
  }),

// partialize に追加:
partialize: (state) => ({
  sidebarCollapsed: state.sidebarCollapsed,
  sidebarWidth: state.sidebarWidth,
}),

// persist の version: 1 → 2 にアップ + migrate で旧 state に width 注入
version: 2,
migrate: (persistedState, version) => {
  const ps = (persistedState ?? {}) as Partial<LayoutState>;
  if (version < 2) {
    return {
      ...ps,
      sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
    } as LayoutState;
  }
  return ps as LayoutState;
},
```

注意: zustand persist の Infinity は JSON.stringify で `null` になるため "非有限値は無視" のテスト動作と一致させるには上の `if (!Number.isFinite) return state;` で OK。`Infinity` 入力時はクランプ後 480 にする (Math.min(480, Infinity) = 480)。

- [ ] **Step 4: テスト実行**

```bash
npm test -w @zenterm/web -- --run src/stores/__tests__/layout.test.ts
```

期待: 既存 + 新規 4 テスト all PASS。

- [ ] **Step 5: コミット**

```bash
git add packages/web/src/stores/layout.ts packages/web/src/stores/__tests__/layout.test.ts
git commit -m "feat(web): add sidebarWidth (240-480) to useLayoutStore with persist v2 migrate"
```

---

## Task 2: SidebarResizer コンポーネント

**Files:**
- Create: `packages/web/src/components/sidebar/SidebarResizer.tsx`
- Test: `packages/web/src/components/sidebar/__tests__/SidebarResizer.test.tsx`

**Context:** Sidebar の右端に 6px 幅の縦縞 drag handle を置く。pointerdown で capture → pointermove で `currentX - sidebarLeft` を `requestAnimationFrame` 経由で store に commit (Phase 3 の SplitPane と同じ batching パターン)。

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// packages/web/src/components/sidebar/__tests__/SidebarResizer.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarResizer } from '../SidebarResizer';
import { useLayoutStore } from '@/stores/layout';

describe('SidebarResizer', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarWidth: 320, sidebarCollapsed: false });
  });

  it('renders a separator with aria-orientation vertical', () => {
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuemin', '240');
    expect(handle).toHaveAttribute('aria-valuemax', '480');
    expect(handle).toHaveAttribute('aria-valuenow', '320');
  });

  it('updates sidebarWidth on pointer drag', () => {
    // requestAnimationFrame を即時実行に
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1 as unknown as number;
    });
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 400 });
    fireEvent.pointerUp(window, { clientX: 400 });
    expect(useLayoutStore.getState().sidebarWidth).toBe(400);
  });

  it('clamps drag below min', () => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1 as unknown as number;
    });
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 100 });
    fireEvent.pointerUp(window, { clientX: 100 });
    expect(useLayoutStore.getState().sidebarWidth).toBe(240);
  });

  it('supports keyboard Left/Right to adjust by 16px', () => {
    render(<SidebarResizer />);
    const handle = screen.getByRole('separator');
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(useLayoutStore.getState().sidebarWidth).toBe(336);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(useLayoutStore.getState().sidebarWidth).toBe(304);
  });
});
```

- [ ] **Step 2: テスト実行 (失敗確認)**

```bash
npm test -w @zenterm/web -- --run src/components/sidebar/__tests__/SidebarResizer.test.tsx
```

期待: 「SidebarResizer not exported」「component not found」で FAIL。

- [ ] **Step 3: 実装**

```typescript
// packages/web/src/components/sidebar/SidebarResizer.tsx

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import {
  useLayoutStore,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from '@/stores/layout';

const KEYBOARD_STEP = 16;

export function SidebarResizer() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth);

  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const commit = useCallback(() => {
    rafRef.current = null;
    if (pendingRef.current !== null) {
      setSidebarWidth(pendingRef.current);
      pendingRef.current = null;
    }
  }, [setSidebarWidth]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      pendingRef.current = e.clientX;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(commit);
      }
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      commit();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [commit]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      pendingRef.current = ev.clientX;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(commit);
      }
    };
    const onUp = () => {
      draggingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      commit();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth(sidebarWidth - KEYBOARD_STEP);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth(sidebarWidth + KEYBOARD_STEP);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      aria-valuenow={sidebarWidth}
      aria-label={t('sidebar.resize')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        top: 0,
        right: -3,
        width: 6,
        height: '100%',
        cursor: 'col-resize',
        background: 'transparent',
        zIndex: 10,
        touchAction: 'none',
      }}
    />
  );
}
```

- [ ] **Step 4: テスト実行**

```bash
npm test -w @zenterm/web -- --run src/components/sidebar/__tests__/SidebarResizer.test.tsx
```

期待: 4 テスト all PASS。

- [ ] **Step 5: i18n キー追加**

`packages/web/src/i18n/locales/en.json`:
```json
"sidebar": {
  ...
  "resize": "Resize sidebar"
}
```

`packages/web/src/i18n/locales/ja.json`:
```json
"sidebar": {
  ...
  "resize": "サイドバー幅変更"
}
```

(既存 sidebar 名前空間がなければ新規追加)

- [ ] **Step 6: コミット**

```bash
git add packages/web/src/components/sidebar/SidebarResizer.tsx \
        packages/web/src/components/sidebar/__tests__/SidebarResizer.test.tsx \
        packages/web/src/i18n/locales/en.json \
        packages/web/src/i18n/locales/ja.json
git commit -m "feat(web): SidebarResizer (drag+keyboard) for sidebar width 240-480"
```

---

## Task 3: Sidebar.tsx に SidebarResizer 統合 + 幅を store から読む

**Files:**
- Modify: `packages/web/src/components/Sidebar.tsx`
- Test: `packages/web/src/components/__tests__/Sidebar.test.tsx`

**Context:** 現状 `Sidebar.tsx:35` の `const SIDEBAR_WIDTH = 320` を削除し、`useLayoutStore((s) => s.sidebarWidth)` から取得。`collapsed` 時は width=0 のまま (既存挙動維持)。Resizer は `collapsed === false` の時のみ表示。

- [ ] **Step 1: 既存 Sidebar.test.tsx を確認しテスト追加**

```typescript
// 既存 Sidebar.test.tsx に追加

describe('sidebar width store integration', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarWidth: 320, sidebarCollapsed: false });
  });

  it('renders at store width when not collapsed', () => {
    useLayoutStore.setState({ sidebarWidth: 400 });
    const { container } = render(/* ... existing wrapper ... */);
    const aside = container.querySelector('aside[role="complementary"]');
    expect((aside as HTMLElement).style.width).toBe('400px');
  });

  it('renders SidebarResizer when not collapsed', () => {
    render(/* ... */);
    expect(screen.getByRole('separator', { name: /resize/i })).toBeInTheDocument();
  });

  it('does not render SidebarResizer when collapsed', () => {
    useLayoutStore.setState({ sidebarCollapsed: true });
    render(/* ... */);
    expect(screen.queryByRole('separator', { name: /resize/i })).toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行 (失敗確認)**

```bash
npm test -w @zenterm/web -- --run src/components/__tests__/Sidebar.test.tsx
```

- [ ] **Step 3: 実装**

```typescript
// packages/web/src/components/Sidebar.tsx (該当箇所の変更)

// 削除:
// const SIDEBAR_WIDTH = 320;

// 追加:
import { SidebarResizer } from './sidebar/SidebarResizer';

// component 内:
const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);

// style の width 部分:
width: collapsed ? 0 : sidebarWidth,
position: 'relative', // resizer の absolute 配置基準
// ... 他は同じ

// children の最後あたりに:
{!collapsed && <SidebarResizer />}
```

注意:
- 既存の `position` 設定が `'relative'` でない場合は追加 (Resizer の `absolute` 配置のため)
- `collapsed` 時に Resizer が描画されないことで TAB フォーカス事故を防ぐ

- [ ] **Step 4: テスト実行**

```bash
npm test -w @zenterm/web -- --run src/components/__tests__/Sidebar.test.tsx
```

期待: 既存 + 新規 3 テスト all PASS。

- [ ] **Step 5: 全体 unit テスト実行 (リグレッション確認)**

```bash
npm test -w @zenterm/web
```

期待: 既存テスト全部 PASS (Phase 4a 完了時 568 + Task 1 4 + Task 2 4 + Task 3 3 = 579)。

- [ ] **Step 6: コミット**

```bash
git add packages/web/src/components/Sidebar.tsx \
        packages/web/src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(web): Sidebar reads width from store + integrates SidebarResizer"
```

---

## Task 4: TerminalContextMenu に search / new pane 項目追加

**Files:**
- Modify: `packages/web/src/components/terminal/TerminalContextMenu.tsx`
- Modify: `packages/web/src/components/TerminalPane.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/components/terminal/__tests__/TerminalContextMenu.test.tsx`
- Modify: `packages/web/src/i18n/locales/{en,ja}.json`

**Context:** spec line 445 `ターミナルエリア (copy / paste / search / new pane …)` のうち `search` と `new pane` を追加。
- `search`: useLayoutStore.openSearch() を呼ぶだけ
- `new pane`: 「現在の layout が `single` なら `2col` に切り替えてから空きペインを focus」する shell action

「new pane」が複雑なので、Phase 4b では **シンプル化**: `single` → `2col`, `2col` → `3col`, `3col` → `2x2`, `2x2`/`mainSide` → 何もしない (max reached) という簡易ロジック。新規に focus を渡すペインは「空き slot の最小 index」を選ぶ。

- [ ] **Step 1: TerminalContextMenu に props と menuitem を追加 (失敗テスト)**

```typescript
// packages/web/src/components/terminal/__tests__/TerminalContextMenu.test.tsx に追加

it('calls onSearch when Search menuitem is clicked', () => {
  const onSearch = vi.fn();
  render(
    <TerminalContextMenu
      open
      x={10}
      y={10}
      hasSelection={false}
      onCopy={vi.fn()}
      onPaste={vi.fn()}
      onClear={vi.fn()}
      onReconnect={vi.fn()}
      onSearch={onSearch}
      onNewPane={vi.fn()}
      canCreateNewPane={true}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('menuitem', { name: /search/i }));
  expect(onSearch).toHaveBeenCalled();
});

it('disables New Pane when canCreateNewPane is false', () => {
  render(
    <TerminalContextMenu
      open
      x={10}
      y={10}
      hasSelection={false}
      onCopy={vi.fn()}
      onPaste={vi.fn()}
      onClear={vi.fn()}
      onReconnect={vi.fn()}
      onSearch={vi.fn()}
      onNewPane={vi.fn()}
      canCreateNewPane={false}
      onClose={vi.fn()}
    />,
  );
  const btn = screen.getByRole('menuitem', { name: /new pane/i });
  expect(btn).toHaveAttribute('aria-disabled', 'true');
});

it('calls onNewPane when New Pane menuitem is clicked', () => {
  const onNewPane = vi.fn();
  render(
    <TerminalContextMenu
      open
      x={10}
      y={10}
      hasSelection={false}
      onCopy={vi.fn()}
      onPaste={vi.fn()}
      onClear={vi.fn()}
      onReconnect={vi.fn()}
      onSearch={vi.fn()}
      onNewPane={onNewPane}
      canCreateNewPane
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('menuitem', { name: /new pane/i }));
  expect(onNewPane).toHaveBeenCalled();
});
```

- [ ] **Step 2: 実装 (TerminalContextMenu)**

```typescript
// TerminalContextMenuProps に追加:
onSearch: () => void;
onNewPane: () => void;
canCreateNewPane: boolean;

// render 内、onClear と onReconnect の間に search を、onReconnect の後に new pane を:
<button
  type="button"
  role="menuitem"
  onClick={handleClick(onSearch)}
  style={itemStyle(false)}
>
  {t('terminal.menu.search')}
</button>
<button
  type="button"
  role="menuitem"
  aria-disabled={!canCreateNewPane}
  disabled={!canCreateNewPane}
  onClick={canCreateNewPane ? handleClick(onNewPane) : undefined}
  style={itemStyle(!canCreateNewPane)}
>
  {t('terminal.menu.newPane')}
</button>
```

- [ ] **Step 3: i18n キー追加**

en.json:
```json
"terminal": {
  "menu": {
    ...,
    "search": "Search",
    "newPane": "New pane"
  }
}
```

ja.json:
```json
"terminal": {
  "menu": {
    ...,
    "search": "検索",
    "newPane": "新しいペイン"
  }
}
```

- [ ] **Step 4: TerminalPane / AuthenticatedShell の wiring**

TerminalPane.tsx に prop 追加:
```typescript
interface TerminalPaneProps {
  ...
  onSearch?: () => void;
  onNewPane?: () => void;
  canCreateNewPane?: boolean;
}
```
TerminalContextMenu レンダ時に渡す。

AuthenticatedShell.tsx に handler 追加:
```typescript
// Phase 3 の SLOT_COUNT を import 済
const layout = usePaneStore((s) => s.layout);
const setLayout = usePaneStore((s) => s.setLayout);
const panes = usePaneStore((s) => s.panes);
const focusPane = usePaneStore((s) => s.focusPane);
const focusedIndex = usePaneStore((s) => s.focusedIndex);

const upgradeLayout = (current: LayoutMode): LayoutMode | null => {
  if (current === 'single') return '2col';
  if (current === '2col') return '3col';
  if (current === '3col') return '2x2';
  return null;
};

const canCreateNewPane = upgradeLayout(layout) !== null;

const newPane = () => {
  const next = upgradeLayout(layout);
  if (!next) return;
  setLayout(next);
  // 空き slot の最小 index を focus
  const slotCount = SLOT_COUNT[next];
  for (let i = 0; i < slotCount; i++) {
    if (!panes[i]) {
      focusPane(i);
      return;
    }
  }
};

const openSearch = useLayoutStore.getState().openSearch;
```

useShortcuts や TerminalPane へ:
```typescript
<TerminalPane
  ...
  onSearch={() => useLayoutStore.getState().openSearch()}
  onNewPane={newPane}
  canCreateNewPane={canCreateNewPane}
/>
```

注: TerminalContextMenu は TerminalPane 内で描画されてるので、TerminalPane が props を受け取って渡す形になる。

- [ ] **Step 5: テスト実行**

```bash
npm test -w @zenterm/web -- --run src/components/terminal/__tests__/TerminalContextMenu.test.tsx
npm test -w @zenterm/web -- --run src/components/__tests__/AuthenticatedShell.test.tsx
```

期待: 新規 3 テスト + 既存テスト all PASS。

- [ ] **Step 6: コミット**

```bash
git add packages/web/src/components/terminal/TerminalContextMenu.tsx \
        packages/web/src/components/terminal/__tests__/TerminalContextMenu.test.tsx \
        packages/web/src/components/TerminalPane.tsx \
        packages/web/src/components/AuthenticatedShell.tsx \
        packages/web/src/i18n/locales/en.json \
        packages/web/src/i18n/locales/ja.json
git commit -m "feat(web): TerminalContextMenu adds Search + New pane (layout upgrade)"
```

---

## Task 5: SessionRow に open-in-pane menu 追加

**Files:**
- Modify: `packages/web/src/components/sidebar/SessionRow.tsx`
- Modify: `packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx`
- Modify: `packages/web/src/components/Sidebar.tsx` (SessionRow に渡す prop 追加)
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`

**Context:** spec line 445 「Sidebar 全行 (rename / delete / open in pane …)」を満たすため、SessionRow にも「最初の window を別ペインで開く」項目を追加。WindowRow と同じく `openInPaneOptions: number[]` を受け取り、各 pane index を選択肢として並べる。SessionRow から open する場合は **window index = 0 を target** とする (= デフォルト動作と同じ first window)。

- [ ] **Step 1: 失敗テスト**

```typescript
// SessionRow.test.tsx に追加

it('shows openInPane menu items when openInPaneOptions provided', () => {
  const onOpenInPane = vi.fn();
  render(
    <SessionRow
      session={mockSession()}
      isActive={false}
      isExpanded={false}
      openInPaneOptions={[0, 1]}
      onSelect={vi.fn()}
      onToggleExpand={vi.fn()}
      onRename={vi.fn()}
      onRequestDelete={vi.fn()}
      onOpenInPane={onOpenInPane}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /actions for session/i }));
  fireEvent.click(screen.getByRole('menuitem', { name: /open in pane 1/i }));
  expect(onOpenInPane).toHaveBeenCalledWith(0);
});

it('hides openInPane items when openInPaneOptions is empty', () => {
  render(
    <SessionRow
      session={mockSession()}
      isActive={false}
      isExpanded={false}
      openInPaneOptions={[]}
      onSelect={vi.fn()}
      onToggleExpand={vi.fn()}
      onRename={vi.fn()}
      onRequestDelete={vi.fn()}
      onOpenInPane={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /actions for session/i }));
  expect(screen.queryByRole('menuitem', { name: /open in pane/i })).toBeNull();
});
```

- [ ] **Step 2: 実装 (SessionRow)**

```typescript
// SessionRowProps に追加:
openInPaneOptions: number[];
onOpenInPane: (paneIndex: number) => void;

// component 内 (WindowRow と同じパターン):
const openInItems = openInPaneOptions.map((idx) => ({
  label: t('sessions.openInPane.label', { pane: idx + 1 }),
  onClick: () => onOpenInPane(idx),
}));
const baseItems = [
  { label: t('common.rename'), onClick: () => setMode('editing-name') },
  { label: t('common.delete'), onClick: () => onRequestDelete(session), destructive: true },
];

<RowActionsMenu
  open={menuOpen}
  anchorEl={kebabRef.current}
  items={[...openInItems, ...baseItems]}
  onClose={() => setMenuOpen(false)}
/>
```

- [ ] **Step 3: Sidebar.tsx / AuthenticatedShell.tsx の wiring**

Sidebar から `openInPaneOptions` (= 全 pane index 一覧から **focused 以外** か **空き** だけ) を渡し、`onOpenInPane(paneIdx)` で `assignPane(paneIdx, { sessionId: session.displayName, windowIndex: 0 })` を呼ぶ。WindowRow 側と同じ shape の handler を新設 (`handleOpenSessionInPane`)。

```typescript
// AuthenticatedShell.tsx 抜粋
const handleOpenSessionInPane = (session: TmuxSession, paneIndex: number) => {
  usePaneStore.getState().assignPane(paneIndex, {
    sessionId: session.displayName,
    windowIndex: 0,
  });
};

// Sidebar 経由で渡す
<Sidebar
  ...
  onOpenSessionInPane={handleOpenSessionInPane}
/>
```

`openInPaneOptions` の生成は WindowRow と同じ helper を流用 (Sidebar.tsx に既にあるはず)。

- [ ] **Step 4: テスト実行**

```bash
npm test -w @zenterm/web -- --run src/components/sidebar/
```

期待: 新規 2 + 既存 all PASS。

- [ ] **Step 5: コミット**

```bash
git add packages/web/src/components/sidebar/SessionRow.tsx \
        packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx \
        packages/web/src/components/Sidebar.tsx \
        packages/web/src/components/AuthenticatedShell.tsx
git commit -m "feat(web): SessionRow exposes open-in-pane menu (window 0 target)"
```

---

## Task 6: TerminalDropZone + ApiClient 配線

**Files:**
- Create: `packages/web/src/components/terminal/TerminalDropZone.tsx`
- Create: `packages/web/src/hooks/useUploadProgress.ts`
- Test: `packages/web/src/components/terminal/__tests__/TerminalDropZone.test.tsx`
- Test: `packages/web/src/hooks/__tests__/useUploadProgress.test.ts`
- Modify: `packages/web/src/components/TerminalPane.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/i18n/locales/{en,ja}.json`

**Context:**
- focused pane の上だけにオーバーレイ。ファイルが window に dragenter してきたら表示 (FilesUploadDropZone の counter パターンを踏襲)、ただしルートは TerminalPane 内に閉じる。
- onDrop で `files.forEach(file => uploadFile(file, session.cwd))` を逐次実行。並列にしないのは Gateway 側で書き込みコンフリクト避けるため。
- 進捗は `useUploadProgress` で `{ active: boolean, currentFile?: string, completed: number, total: number, error?: string }` を保持し、Toast 風 banner で TerminalPane 上部に重ねる (`position: absolute, top: 0`)。
- session.cwd は `TmuxSession.cwd` から取得 (paneStore の focused pane から sessionId → sessions list を引いて cwd)。

- [ ] **Step 1: useUploadProgress 失敗テスト**

```typescript
// packages/web/src/hooks/__tests__/useUploadProgress.test.ts

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUploadProgress } from '../useUploadProgress';

describe('useUploadProgress', () => {
  it('starts inactive', () => {
    const { result } = renderHook(() => useUploadProgress());
    expect(result.current.active).toBe(false);
    expect(result.current.completed).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it('begin(n) activates with total = n', () => {
    const { result } = renderHook(() => useUploadProgress());
    act(() => result.current.begin(3));
    expect(result.current.active).toBe(true);
    expect(result.current.total).toBe(3);
    expect(result.current.completed).toBe(0);
  });

  it('progress increments completed and updates currentFile', () => {
    const { result } = renderHook(() => useUploadProgress());
    act(() => result.current.begin(2));
    act(() => result.current.markStart('a.txt'));
    expect(result.current.currentFile).toBe('a.txt');
    act(() => result.current.markDone());
    expect(result.current.completed).toBe(1);
  });

  it('finish resets all state', () => {
    const { result } = renderHook(() => useUploadProgress());
    act(() => result.current.begin(1));
    act(() => result.current.markDone());
    act(() => result.current.finish());
    expect(result.current.active).toBe(false);
    expect(result.current.completed).toBe(0);
  });

  it('fail sets error and keeps active=true until finish', () => {
    const { result } = renderHook(() => useUploadProgress());
    act(() => result.current.begin(2));
    act(() => result.current.fail('disk full'));
    expect(result.current.error).toBe('disk full');
    expect(result.current.active).toBe(true);
  });
});
```

- [ ] **Step 2: useUploadProgress 実装**

```typescript
// packages/web/src/hooks/useUploadProgress.ts

import { useCallback, useState } from 'react';

export interface UploadProgressState {
  active: boolean;
  total: number;
  completed: number;
  currentFile?: string;
  error?: string;
}

export interface UploadProgressApi extends UploadProgressState {
  begin: (total: number) => void;
  markStart: (filename: string) => void;
  markDone: () => void;
  fail: (msg: string) => void;
  finish: () => void;
}

const INITIAL: UploadProgressState = {
  active: false,
  total: 0,
  completed: 0,
  currentFile: undefined,
  error: undefined,
};

export function useUploadProgress(): UploadProgressApi {
  const [state, setState] = useState<UploadProgressState>(INITIAL);
  const begin = useCallback((total: number) => {
    setState({ active: true, total, completed: 0, currentFile: undefined, error: undefined });
  }, []);
  const markStart = useCallback((filename: string) => {
    setState((s) => ({ ...s, currentFile: filename }));
  }, []);
  const markDone = useCallback(() => {
    setState((s) => ({ ...s, completed: s.completed + 1 }));
  }, []);
  const fail = useCallback((msg: string) => {
    setState((s) => ({ ...s, error: msg }));
  }, []);
  const finish = useCallback(() => setState(INITIAL), []);
  return { ...state, begin, markStart, markDone, fail, finish };
}
```

- [ ] **Step 3: テスト実行 (useUploadProgress)**

```bash
npm test -w @zenterm/web -- --run src/hooks/__tests__/useUploadProgress.test.ts
```

期待: 5 テスト all PASS。

- [ ] **Step 4: TerminalDropZone 失敗テスト**

```typescript
// packages/web/src/components/terminal/__tests__/TerminalDropZone.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalDropZone } from '../TerminalDropZone';

describe('TerminalDropZone', () => {
  it('hidden when not active', () => {
    render(<TerminalDropZone cwd="/home/me" onFiles={vi.fn()} />);
    expect(screen.queryByRole('region', { name: /drop/i })).toBeNull();
  });

  it('activates on window dragenter with Files types', () => {
    render(<TerminalDropZone cwd="/home/me" onFiles={vi.fn()} />);
    const dragEnter = new Event('dragenter', { bubbles: true }) as DragEvent;
    Object.defineProperty(dragEnter, 'dataTransfer', { value: { types: ['Files'] } });
    fireEvent(window, dragEnter);
    expect(screen.getByRole('region', { name: /drop/i })).toBeInTheDocument();
  });

  it('calls onFiles with cwd on drop', () => {
    const onFiles = vi.fn();
    render(<TerminalDropZone cwd="/srv/work" onFiles={onFiles} />);
    const dragEnter = new Event('dragenter', { bubbles: true }) as DragEvent;
    Object.defineProperty(dragEnter, 'dataTransfer', { value: { types: ['Files'] } });
    fireEvent(window, dragEnter);
    const file = new File(['hi'], 'hi.txt', { type: 'text/plain' });
    const overlay = screen.getByRole('region', { name: /drop/i });
    fireEvent.drop(overlay, { dataTransfer: { files: [file], types: ['Files'] } });
    expect(onFiles).toHaveBeenCalledWith([file], '/srv/work');
  });
});
```

- [ ] **Step 5: TerminalDropZone 実装**

```typescript
// packages/web/src/components/terminal/TerminalDropZone.tsx

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface Props {
  cwd: string;
  onFiles: (files: File[], cwd: string) => void;
}

export function TerminalDropZone({ cwd, onFiles }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    let counter = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      counter++;
      setActive(true);
    };
    const leave = () => {
      counter = Math.max(0, counter - 1);
      if (counter === 0) setActive(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      role="region"
      aria-label={t('terminal.dropHint')}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        setActive(false);
        if (files.length > 0) onFiles(files, cwd);
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        color: tokens.colors.textPrimary,
        fontSize: tokens.typography.heading.fontSize,
        pointerEvents: 'auto',
        border: `2px dashed ${tokens.colors.primary}`,
      }}
    >
      {t('terminal.dropHint')} → {cwd}
    </div>
  );
}
```

- [ ] **Step 6: i18n キー追加**

en.json:
```json
"terminal": {
  ...,
  "dropHint": "Drop files to upload to session cwd",
  "uploadProgress": "Uploading {{current}} ({{completed}}/{{total}})",
  "uploadDone": "Uploaded {{count}} file(s)",
  "uploadError": "Upload failed: {{message}}"
}
```

ja.json:
```json
"terminal": {
  ...,
  "dropHint": "ファイルをドロップしてセッション cwd にアップロード",
  "uploadProgress": "アップロード中 {{current}} ({{completed}}/{{total}})",
  "uploadDone": "{{count}} ファイルをアップロードしました",
  "uploadError": "アップロード失敗: {{message}}"
}
```

- [ ] **Step 7: TerminalPane / AuthenticatedShell 配線**

TerminalPane.tsx: focused pane で `<TerminalDropZone cwd={sessionCwd} onFiles={onFiles} />` を `<XtermView>` の隣に配置 (`position: 'relative'` の wrapper 内)。
**focused pane のみ** に出す: `isFocused && sessionCwd && <TerminalDropZone .../>`

AuthenticatedShell.tsx に handler:
```typescript
const uploadProgress = useUploadProgress();

const handleTerminalDrop = async (files: File[], cwd: string) => {
  if (!wrappedClient) return;
  uploadProgress.begin(files.length);
  for (const file of files) {
    uploadProgress.markStart(file.name);
    try {
      await wrappedClient.uploadFile(file, cwd);
      uploadProgress.markDone();
    } catch (e) {
      uploadProgress.fail((e as Error).message);
      return;
    }
  }
  // 短い遅延を入れて 「Done」を見せてから消す
  setTimeout(() => uploadProgress.finish(), 1500);
};
```

進捗バナーは TerminalPane 上部に absolute で表示:
```typescript
{uploadProgress.active && (
  <div role="status" aria-live="polite" style={{
    position: 'absolute', top: 0, left: 0, right: 0,
    padding: tokens.spacing.sm, background: tokens.colors.surface, zIndex: 60,
  }}>
    {uploadProgress.error
      ? t('terminal.uploadError', { message: uploadProgress.error })
      : uploadProgress.completed < uploadProgress.total
        ? t('terminal.uploadProgress', {
            current: uploadProgress.currentFile,
            completed: uploadProgress.completed,
            total: uploadProgress.total,
          })
        : t('terminal.uploadDone', { count: uploadProgress.total })}
  </div>
)}
```

sessionCwd は `sessions.find(s => s.displayName === focused.sessionId)?.cwd` で取得。focused pane が存在しなかったり cwd 未取得時は drop を無視。

- [ ] **Step 8: テスト実行**

```bash
npm test -w @zenterm/web
```

期待: 既存 + 新規 (useUploadProgress 5, TerminalDropZone 3) all PASS。

- [ ] **Step 9: コミット**

```bash
git add packages/web/src/components/terminal/TerminalDropZone.tsx \
        packages/web/src/components/terminal/__tests__/TerminalDropZone.test.tsx \
        packages/web/src/hooks/useUploadProgress.ts \
        packages/web/src/hooks/__tests__/useUploadProgress.test.ts \
        packages/web/src/components/TerminalPane.tsx \
        packages/web/src/components/AuthenticatedShell.tsx \
        packages/web/src/i18n/locales/en.json \
        packages/web/src/i18n/locales/ja.json
git commit -m "feat(web): terminal pane D&D upload to session.cwd with progress banner"
```

---

## Task 7: URL deep link route 追加 + URL → focused pane sync

**Files:**
- Create: `packages/web/src/lib/urlSync.ts`
- Test: `packages/web/src/lib/__tests__/urlSync.test.ts`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/components/__tests__/AuthenticatedShell.test.tsx`

**Context:**
spec line 462-465 から:
```
/web/login
/web/sessions
/web/sessions/:id
/web/sessions/:id/window/:index
/web/files/:path*
/web/settings, /web/settings/gateway
```
を route として定義。`/web/sessions/:id` / `/web/sessions/:id/window/:index` で URL → focused pane に open する。

**スコープ簡素化:**
- 本 Phase では URL → store の一方向同期のみ実装 (store の変化を URL に push back する逆方向は Phase 5 へ)。
- `/web/files/:path*` は既存の Files route が `/web/files` を catch-all していると仮定し、touch しない。読みっぱなしの場合 Task 内で確認し、必要なら `/web/files/:path*` 追加。
- `/web/settings/gateway` は Settings 内 hash anchor で代替済みなら不要。
- ペイン状態 fragment 圧縮はやらない (Phase 5)。

- [ ] **Step 1: urlSync 失敗テスト**

```typescript
// packages/web/src/lib/__tests__/urlSync.test.ts

import { describe, it, expect } from 'vitest';
import { parseSessionRoute } from '../urlSync';

describe('parseSessionRoute', () => {
  it('returns null for non-matching pathname', () => {
    expect(parseSessionRoute('/web/files')).toBeNull();
    expect(parseSessionRoute('/web/sessions')).toBeNull();
  });

  it('parses /web/sessions/:id with window 0 default', () => {
    expect(parseSessionRoute('/web/sessions/work')).toEqual({
      sessionId: 'work',
      windowIndex: 0,
    });
  });

  it('parses /web/sessions/:id/window/:index', () => {
    expect(parseSessionRoute('/web/sessions/work/window/2')).toEqual({
      sessionId: 'work',
      windowIndex: 2,
    });
  });

  it('clamps negative window index to 0', () => {
    expect(parseSessionRoute('/web/sessions/work/window/-1')).toEqual({
      sessionId: 'work',
      windowIndex: 0,
    });
  });

  it('returns null for malformed window segment', () => {
    expect(parseSessionRoute('/web/sessions/work/window/abc')).toBeNull();
  });

  it('decodes percent-encoded session id', () => {
    expect(parseSessionRoute('/web/sessions/my%20work')).toEqual({
      sessionId: 'my work',
      windowIndex: 0,
    });
  });
});
```

- [ ] **Step 2: urlSync 実装**

```typescript
// packages/web/src/lib/urlSync.ts

export interface ParsedSessionRoute {
  sessionId: string;
  windowIndex: number;
}

const SESSION_ONLY_RE = /^\/web\/sessions\/([^/]+)\/?$/;
const SESSION_WINDOW_RE = /^\/web\/sessions\/([^/]+)\/window\/(-?\d+)\/?$/;

export function parseSessionRoute(pathname: string): ParsedSessionRoute | null {
  const wm = SESSION_WINDOW_RE.exec(pathname);
  if (wm) {
    const idx = Number.parseInt(wm[2], 10);
    if (!Number.isFinite(idx)) return null;
    return {
      sessionId: decodeURIComponent(wm[1]),
      windowIndex: Math.max(0, idx),
    };
  }
  const sm = SESSION_ONLY_RE.exec(pathname);
  if (sm) {
    return { sessionId: decodeURIComponent(sm[1]), windowIndex: 0 };
  }
  return null;
}
```

- [ ] **Step 3: route 追加 (App.tsx)**

```typescript
// 既存:
<Route path="/web/sessions" element={...} />

// 追加:
<Route path="/web/sessions/:id" element={...} />
<Route path="/web/sessions/:id/window/:index" element={...} />
```

各 `:id` route も `SessionsRoute` (= AuthenticatedShell) を element に指定。AuthenticatedShell 内で `useLocation` から pathname を読んで `parseSessionRoute` し、初回マウント時に `assignPane(focusedIndex, { sessionId, windowIndex })` を実行。

- [ ] **Step 4: AuthenticatedShell に URL → store 同期**

```typescript
// AuthenticatedShell.tsx

import { useLocation } from 'react-router-dom';
import { parseSessionRoute } from '@/lib/urlSync';

const location = useLocation();
const lastSyncedPath = useRef<string | null>(null);

useEffect(() => {
  if (lastSyncedPath.current === location.pathname) return;
  lastSyncedPath.current = location.pathname;
  const parsed = parseSessionRoute(location.pathname);
  if (!parsed) return;
  // sessions が読み込まれていなければ後で再評価
  if (!Array.isArray(sessions)) return;
  const exists = sessions.some((s) => s.displayName === parsed.sessionId);
  if (!exists) return;
  usePaneStore.getState().openInFocusedPane({
    sessionId: parsed.sessionId,
    windowIndex: parsed.windowIndex,
  });
}, [location.pathname, sessions]);
```

注意:
- sessions list の fetch が完了するまでは parse 結果を保留 (useEffect 内で `sessions` が deps に入っていれば再評価される)
- 1 度同期したら同じ pathname では再実行しない
- ユーザが Sidebar から別 session を選んでも URL は更新しない (一方向のみ)

- [ ] **Step 5: AuthenticatedShell テスト追加**

```typescript
// AuthenticatedShell.test.tsx に追加

it('opens session from /web/sessions/:id URL on mount', async () => {
  // sessions API は 'work' / 'play' を返すモック
  // /web/sessions/work で render
  // assignPane が { sessionId: 'work', windowIndex: 0 } で呼ばれることを assert
});

it('opens specific window from /web/sessions/:id/window/:index', async () => {
  // /web/sessions/work/window/2 で render
  // assignPane が { sessionId: 'work', windowIndex: 2 } で呼ばれることを assert
});

it('ignores URL whose session does not exist', async () => {
  // /web/sessions/ghost で render
  // assignPane は呼ばれない
});
```

- [ ] **Step 6: テスト実行**

```bash
npm test -w @zenterm/web -- --run src/lib/__tests__/urlSync.test.ts
npm test -w @zenterm/web -- --run src/components/__tests__/AuthenticatedShell.test.tsx
```

期待: urlSync 6 + AuthenticatedShell 新規 3 + 既存 all PASS。

- [ ] **Step 7: コミット**

```bash
git add packages/web/src/lib/urlSync.ts \
        packages/web/src/lib/__tests__/urlSync.test.ts \
        packages/web/src/App.tsx \
        packages/web/src/components/AuthenticatedShell.tsx \
        packages/web/src/components/__tests__/AuthenticatedShell.test.tsx
git commit -m "feat(web): deep-link URL parsing for /web/sessions/:id[/window/:index]"
```

---

## Task 8: E2E + bundle hash 更新

**Files:**
- Create: `tests/e2e/web/phase4b.spec.ts`
- Modify: `packages/gateway/public/web/index.html` (Vite build 後の bundle hash)

**Context:** Phase 4a の `shortcuts.spec.ts` (port 18812, token 4812) と同じパターンで spec を追加。

- [ ] **Step 1: E2E spec 作成**

```typescript
// tests/e2e/web/phase4b.spec.ts

import { test, expect, type Page } from '@playwright/test';
// ... (Phase 4a と同じ setup: gateway spawn / .env / addInitScript)

test.describe('Phase 4b mouse / URL', () => {
  test('sidebar drag changes width and persists across reload', async ({ page }) => {
    await login(page);
    const sidebar = page.locator('aside[role="complementary"]');
    const before = await sidebar.boundingBox();
    expect(before?.width).toBe(320);

    const handle = page.getByRole('separator', { name: /resize/i });
    const hb = await handle.boundingBox();
    if (!hb) throw new Error('handle bbox null');
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 100, hb.y + hb.height / 2, { steps: 5 });
    await page.mouse.up();

    const after = await sidebar.boundingBox();
    expect(after?.width).toBeGreaterThan(380);
    expect(after?.width).toBeLessThan(440);

    await page.reload();
    await login(page);
    const reloaded = await page.locator('aside[role="complementary"]').boundingBox();
    expect(reloaded?.width).toBe(after?.width);
  });

  test('deep link /web/sessions/:id opens session', async ({ page }) => {
    // pre-condition: 'work' session exists (テスト fixture or skip if missing)
    await login(page, '/web/sessions/work');
    await expect(page.getByText(/work/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Vite build → bundle hash 反映**

```bash
npm run build -w @zenterm/web
```

ビルド後 `packages/gateway/public/web/index.html` の bundle hash が変わるので git diff で確認しコミットに含める。

- [ ] **Step 3: E2E 実行**

```bash
npm run test:e2e -- tests/e2e/web/phase4b.spec.ts
```

期待: 2 spec PASS。

- [ ] **Step 4: 全テスト最終確認**

```bash
npm test -w @zenterm/web
npm run type-check -w @zenterm/web
```

期待: unit all PASS / tsc clean。

- [ ] **Step 5: コミット**

```bash
git add tests/e2e/web/phase4b.spec.ts packages/gateway/public/web/
git commit -m "test(web): e2e for sidebar resize + deep link + bundle hash update"
```

---

## Task 9 (Finalization): main へ merge + tag + push

**Context:** Phase 4a と同じ finalize 手順 (CLAUDE.md「main へのローカル merge + tag + push」)。

- [ ] **Step 1: 計画書コミット**

(本ファイルが既に commit 済みなら skip)

```bash
git add docs/superpowers/plans/2026-05-11-pc-web-phase-4b-mouse-url.md
git commit -m "docs: Phase 4b (マウス/URL 系) 計画書"
```

- [ ] **Step 2: 全テスト確認**

```bash
npm test -w @zenterm/web
npm run type-check -w @zenterm/web
```

- [ ] **Step 3: main へ --no-ff merge**

```bash
git switch main
git merge --no-ff feature/web-pc-phase-4b -m "Merge branch 'feature/web-pc-phase-4b' — Phase 4b (マウス/URL 系) complete"
```

- [ ] **Step 4: テスト最終確認 (merged main)**

```bash
npm test -w @zenterm/web
```

- [ ] **Step 5: タグ + push**

```bash
git tag -a web-pc-phase-4b-done -m "Phase 4b (マウス/URL 系) — context menus / sidebar resize / terminal D&D / deep link"
git push origin main
git push origin web-pc-phase-4b-done
```

- [ ] **Step 6: feature branch 削除**

```bash
git branch -d feature/web-pc-phase-4b
```

---

## 受け入れ基準

- 17 ショートカット (Phase 4a) + Phase 4b 新機能のリグレッションなし
- `npm test -w @zenterm/web`: 全 unit PASS
- `npm run type-check -w @zenterm/web`: clean
- E2E phase4b.spec.ts: 全 PASS
- 手動確認:
  - [ ] Sidebar 右端を掴んでドラッグ → 幅変更
  - [ ] リロード後も幅が persist (sidebarCollapsed と共に)
  - [ ] Terminal 上で右クリック → Search クリックで in-terminal 検索が開く
  - [ ] Terminal 上で右クリック → New pane で layout が `single → 2col` に変化
  - [ ] Sidebar の session 行 ⋯ メニューに「Open in pane N」が並ぶ
  - [ ] Sidebar の session 行から「Open in pane 2」 → pane 2 に first window 表示
  - [ ] Terminal 領域にファイルをドラッグ → 「Drop files to upload」オーバーレイ
  - [ ] ドロップ → 進捗バナー → cwd に保存される
  - [ ] `/web/sessions/work` 直アクセス → work セッション開く
  - [ ] `/web/sessions/work/window/2` 直アクセス → work の window 2 開く

## Phase 5 へ送る polish 項目 (本 Phase スコープ外)

- ペイン状態の URL fragment 圧縮 (`#l=2col&p=work.0,work.1`)
- URL は一方向のみ。focus 切替 → URL push back は実装しない
- 4 ペイン状態からの "New pane" は no-op、Toast で通知すべきか?
- `/web/files/:path*` (Files URL deep link、UX 要件次第で追加)
- ContextMenu の共通基盤化リファクタ
- Tooltip aria-describedby clobber 問題 (Phase 4a 引継ぎ)
- Sidebar resize drag 中の xterm refit debounce (現状 fit on resize に依存)
