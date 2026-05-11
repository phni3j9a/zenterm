# ZenTerm PC Web Phase 3 (マルチペイン) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC Web 版に 5 種プリセットレイアウト (`single` / `cols-2` / `cols-3` / `grid-2x2` / `main-side-2`) のマルチペインを導入し、splitter ドラッグ可変・比率 persist・同 `(sessionId, windowIndex)` の重複ガード・Sidebar 行右クリック「別のペインで開く」・Files/Settings ルート滞在中の `single` 一時退避を実装する。

**Architecture:** 新規 `paneStore` (zustand persist) が `layout: LayoutMode` / `panes: (PaneTarget|null)[]` / `focusedIndex: number` / `ratios: Record<LayoutMode, number[]>` / `savedLayout: LayoutMode|null` を保持。既存 `useSessionViewStore` は **`paneStore` の薄いラッパ**として残し、`activeSessionId / activeWindowIndex` を「focused pane の派生」として提供する (旧 API 表面互換、内部実装差し替え)。新規汎用 `SplitPane` (orientation / ratio / first / second / minSize, pointer-drag + rAF debounce + 最小 320px) を 5 種レイアウトコンポーネントが組み合わせて使う。`MultiPaneArea` が `paneStore` を購読し layout に応じて該当レイアウトコンポーネントを描画、各 slot に `TerminalPane` を渡す。`AuthenticatedShell` の `/web/sessions` 以外滞在時は `paneStore.suspendForSingle()` で現 layout を `savedLayout` に退避して `single` に切替、戻ったら `resume()` で復元。`Sidebar` の `WindowRow` は他ペインで開かれている (s,w) を ⛔ + グレーアウトし、`RowActionsMenu` に「別のペインで開く ▸ ペイン N」を追加する。`TerminalHeader` には `⊟▾` レイアウト切替ボタン (新 `LayoutSelector`) を追加。

**Tech Stack:** TypeScript 5.7 strict (`noUnusedParameters: true`) / React 19 / Vite 6 / zustand 5 (`persist` + `createJSONStorage(localStorage)`) / react-router 7 / vitest 4 / @testing-library/react / Playwright / xterm.js 6 (既存)。新規 npm 依存ゼロ。

**Spec:** `docs/superpowers/specs/2026-05-09-pc-web-design.md`（特に line 296-343 と line 500「Phase 3」）

**Pre-existing facts (Phase 2d 完了時点、main = `50f5265`):**

- `packages/web/src/stores/sessionView.ts` (19 行): `{ activeSessionId: string|null, activeWindowIndex: number|null, open(sessionId, windowIndex?), close(), setWindow(idx) }`。`useSessionViewStore` を購読する側: `AuthenticatedShell.tsx` (line 29-31, 204), `SessionsListPanel.tsx` (props 経由), `__tests__/AuthenticatedShell.test.tsx` (line 47, 92)。Phase 3 で内部実装を `paneStore.panes[focusedIndex]` 派生に差し替えるが、export 関数シグネチャは温存
- `packages/web/src/components/AuthenticatedShell.tsx` (229 行): `<TerminalPane sessionId={activeSessionId} windowIndex={activeWindowIndex} isVisible={!isFilesRoute} />` が現在 1 枚だけ。Phase 3 で `<MultiPaneArea isVisible={!isFilesRoute} gatewayUrl={} token={} />` に置換、`MultiPaneArea` 内部で複数 `TerminalPane` を描画
- `packages/web/src/components/TerminalPane.tsx` (155 行): props は `{gatewayUrl, token, sessionId, windowIndex, isVisible}`。`sessionId === null` の場合 empty state、それ以外は `<TerminalHeader> + <XtermView>`。Phase 3 で `paneIndex: number` と `isFocused: boolean` を追加し、ヘッダーに `⊟▾` を出すのは focused pane のみ
- `packages/web/src/components/terminal/TerminalHeader.tsx` (203 行): props 受け取りで切り出し済み。Phase 3 で `onLayoutMenu?: () => void` を追加して focused pane でのみ表示
- `packages/web/src/components/Sidebar.tsx` (176 行): `<SessionsListPanel>` を `activePanel === 'sessions'` のとき描画。`activeSessionId` / `activeWindowIndex` を props で受け取り `WindowRow.isActive` 判定に使用
- `packages/web/src/components/SessionsListPanel.tsx` (159 行): 各 session を `<SessionRow>` で描画、展開時に `<WindowRow>` を並べる。Phase 3 で 「他ペインで開かれている (s,w)」判定と「別ペインで開く」メニューを `WindowRow` に追加する必要がある (props を拡張)
- `packages/web/src/components/sidebar/WindowRow.tsx` (94 行): `RowActionsMenu` (rename / delete) を持つ。Phase 3 で `items` に「別のペインで開く ▸」を追加 (サブメニューではなく動的アイテム列で対応)
- `packages/web/src/components/sidebar/SessionRow.tsx`: Phase 3 では非変更 (session 全体を別ペインに開くのは Phase 4 で実装、Phase 3 は window 単位のみ)
- `packages/web/src/components/sidebar/RowActionsMenu.tsx` (98 行): `items: RowActionsMenuItem[]` を受け取り flat に描画。サブメニュー機能はないので、Phase 3 では `「別ペインで開く: 2」` のような flat な複数項目で表現
- `packages/web/src/stores/settings.ts` (78 行): persist version 2、`createJSONStorage(() => localStorage)` 使用。Phase 3 の `paneStore` も同じ pattern を踏襲する
- `packages/web/src/stores/sessions.ts`: `sessions: TmuxSession[]` を保持。Phase 3 で paneStore からの依存はなし
- `packages/web/src/i18n/locales/{en,ja}.json`: 既存 namespace `sessions.* / terminal.* / sidebar.* / settings.* / files.* / common.*`。Phase 3 で `terminal.layout.*` と `sessions.openInPane.*` namespace を追加
- `packages/web/src/setupTests.ts`: jsdom 25、`navigator.clipboard` polyfill 済み、`ResizeObserver` polyfill **未** ⇒ Phase 3 Task 3 で `SplitPane` テストに `vi.stubGlobal('ResizeObserver', ...)` を入れる
- Playwright spec ポート: 既存 18790-18810 使用済 ⇒ Phase 3 は **18811** 1 本のみ割当 (`pane-split.spec.ts`)
- vite build artifact: `packages/gateway/public/web/index.html` は `assets/index-*.js` を参照。Phase 3 完了時に `npm run -w @zenterm/web build` を 1 回実行して bundle 更新を commit する (Phase 2d で `50f5265` でやった手順を踏襲)
- `packages/web/src/components/__tests__/AuthenticatedShell.test.tsx` (115 行): Phase 2d 時点で `useSessionViewStore.setState({ activeSessionId: 'dev', activeWindowIndex: 0 })` を使うテストが 1 件 (line 92)。Phase 3 の sessionView ラッパ化後も同テストは通り続ける必要あり (内部実装変更で API 互換)

**Scope (Phase 3 で実装する):**

- ✅ `paneStore` (zustand persist) + 純粋関数 `paneLayout.ts`
- ✅ 5 種レイアウト (`single`/`cols-2`/`cols-3`/`grid-2x2`/`main-side-2`) の React 描画
- ✅ `SplitPane` (汎用 2分割、horizontal/vertical、最小 320px、pointer-drag、ratio persist)
- ✅ `MultiPaneArea` (paneStore 購読 + 5 レイアウトを呼び分け + 各 slot に `TerminalPane`)
- ✅ `LayoutSelector` (toolbar `⊟▾` ボタン → 5 種選択ポップオーバー)
- ✅ `TerminalHeader` への `⊟▾` 統合 (focused pane のみ表示)
- ✅ Sidebar `WindowRow` 重複ガード (他ペインで開かれてる (s,w) を ⛔ グレーアウト)
- ✅ Sidebar `RowActionsMenu` への「別のペインで開く: N」追加 (1 行 / pane idx)
- ✅ `paneStore.suspendForSingle()` / `resume()` + AuthenticatedShell で route 変化時に駆動
- ✅ `useSessionViewStore` を `paneStore` の薄いラッパに差替 (API 互換)
- ✅ i18n キー (`terminal.layout.*` / `sessions.openInPane.*`)
- ✅ ユニット + コンポーネント + Playwright E2E `pane-split.spec.ts`
- ✅ `vite build` で bundle 更新 + commit

**Out of scope (Phase 4 以降):**

- ❌ ⌘\ / ⌘1-9 / ⌘[ / ⌘] / ⌘T / ⌘W などキーボードショートカット
- ❌ Command Palette
- ❌ ターミナル内検索 (⌘F)
- ❌ Sidebar 折りたたみ (⌘B)
- ❌ Session 単位の「別ペインで開く」(window 単位のみ Phase 3)
- ❌ 8 言語追加 (en/ja のみ。残り 6 言語は Phase 5)
- ❌ deep link (`/web/sessions/:id/window/:index`)

---

## File Structure

**Create:**
- `packages/web/src/lib/paneLayout.ts` — `LayoutMode` 型、`SLOT_COUNT` / `SPLITTER_COUNT` / `DEFAULT_RATIOS` 定数、`clampRatio` / `dropExtraPanes` 純関数
- `packages/web/src/lib/__tests__/paneLayout.test.ts` — 上記の純関数テスト
- `packages/web/src/stores/pane.ts` — zustand persist の paneStore (5 actions + selector helper)
- `packages/web/src/stores/__tests__/pane.test.ts` — paneStore ロジックテスト
- `packages/web/src/components/layout/SplitPane.tsx` — 汎用 2分割 splitter
- `packages/web/src/components/layout/__tests__/SplitPane.test.tsx` — pointer-drag + ratio update テスト
- `packages/web/src/components/layout/MultiPaneArea.tsx` — paneStore を読んで 5 種レイアウト + TerminalPane を描画
- `packages/web/src/components/layout/__tests__/MultiPaneArea.test.tsx` — レイアウト切替 / focused pane / 隠し pane display:none
- `packages/web/src/components/terminal/LayoutSelector.tsx` — `⊟▾` メニュー (5 種選択ポップ)
- `packages/web/src/components/terminal/__tests__/LayoutSelector.test.tsx` — クリック・選択テスト
- `tests/e2e/web/pane-split.spec.ts` — Playwright E2E (port 18811)

**Modify:**
- `packages/web/src/stores/sessionView.ts` — paneStore 派生の薄いラッパに差替 (API 互換)
- `packages/web/src/components/AuthenticatedShell.tsx` — `<TerminalPane>` を `<MultiPaneArea>` に置換、route 変化時 suspend/resume
- `packages/web/src/components/TerminalPane.tsx` — `paneIndex: number` / `isFocused: boolean` props 追加、focused pane のみ `⊟▾` 表示、クリックで `setFocusedIndex`
- `packages/web/src/components/terminal/TerminalHeader.tsx` — `onLayoutMenu?: () => void` prop 追加
- `packages/web/src/components/Sidebar.tsx` — `WindowRow` への重複ガード情報を流す (props 拡張)
- `packages/web/src/components/SessionsListPanel.tsx` — paneStore から panes を読んで「他ペインで開かれてる」判定 + `WindowRow.openInPane` callback
- `packages/web/src/components/sidebar/WindowRow.tsx` — `isOccupiedElsewhere: boolean` + `openInPaneOptions: number[]` props 追加、`RowActionsMenu` に「別のペインで開く: N」項目を追加
- `packages/web/src/components/__tests__/AuthenticatedShell.test.tsx` — sessionView ラッパ化後の挙動 (paneStore 経由) を確認
- `packages/web/src/i18n/locales/en.json` — `terminal.layout.*` + `sessions.openInPane.*` キー追加
- `packages/web/src/i18n/locales/ja.json` — 同上の日本語訳
- `packages/gateway/public/web/index.html` — `npm run -w @zenterm/web build` の出力で再生成 (最後の commit のみ)

---

## paneStore データモデル

```ts
// packages/web/src/stores/pane.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LayoutMode, SLOT_COUNT, DEFAULT_RATIOS, dropExtraPanes } from '@/lib/paneLayout';

export interface PaneTarget {
  sessionId: string;
  windowIndex: number;
}

interface PaneState {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;
  ratios: Record<LayoutMode, number[]>;
  savedLayout: LayoutMode | null;

  setLayout: (mode: LayoutMode) => void;
  setFocusedIndex: (idx: number) => void;
  assignPane: (idx: number, target: PaneTarget | null) => void;
  openInFocusedPane: (target: PaneTarget) => void;
  setRatio: (mode: LayoutMode, splitterIdx: number, value: number) => void;
  isOccupied: (target: PaneTarget, excludeIdx?: number) => boolean;
  suspendForSingle: () => void;
  resume: () => void;
}
```

Persist key: `zenterm-web-pane`, version: `1`.

Persist partialize: `{ layout, panes, focusedIndex, ratios, savedLayout }`.

ratios の意味:
- `single`: `[]`
- `cols-2`: `[v]` — 左ペイン幅率 (0.1〜0.9)
- `cols-3`: `[v1, v2]` — 外側 SplitPane(left vs (mid|right)) の v1、内側 SplitPane(mid vs right) の v2
- `grid-2x2`: `[v, h]` — 横並び v (左列 vs 右列、両行共通) + 縦並び h (上行 vs 下行、両列共通)
- `main-side-2`: `[v, h]` — 横並び v (main 列 vs sides 列) + 縦並び h (sides の上半 vs 下半)

slot 番号 → 表示位置 (DOM 並び順):
- `single`: 0
- `cols-2`: 0=左, 1=右
- `cols-3`: 0=左, 1=中, 2=右
- `grid-2x2`: 0=左上, 1=右上, 2=左下, 3=右下
- `main-side-2`: 0=main, 1=top-side, 2=bottom-side

---

## Task 1: paneLayout 純関数

**Files:**
- Create: `packages/web/src/lib/paneLayout.ts`
- Test: `packages/web/src/lib/__tests__/paneLayout.test.ts`

- [ ] **Step 1: テストファイル作成 (失敗テスト)**

`packages/web/src/lib/__tests__/paneLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  LAYOUT_MODES,
  SLOT_COUNT,
  SPLITTER_COUNT,
  DEFAULT_RATIOS,
  clampRatio,
  dropExtraPanes,
  type LayoutMode,
} from '../paneLayout';

describe('paneLayout constants', () => {
  it('LAYOUT_MODES は 5 種すべてを含む', () => {
    expect(LAYOUT_MODES).toEqual(['single', 'cols-2', 'cols-3', 'grid-2x2', 'main-side-2']);
  });

  it('SLOT_COUNT は仕様通り 1/2/3/4/3', () => {
    expect(SLOT_COUNT.single).toBe(1);
    expect(SLOT_COUNT['cols-2']).toBe(2);
    expect(SLOT_COUNT['cols-3']).toBe(3);
    expect(SLOT_COUNT['grid-2x2']).toBe(4);
    expect(SLOT_COUNT['main-side-2']).toBe(3);
  });

  it('SPLITTER_COUNT は仕様通り 0/1/2/2/2', () => {
    expect(SPLITTER_COUNT.single).toBe(0);
    expect(SPLITTER_COUNT['cols-2']).toBe(1);
    expect(SPLITTER_COUNT['cols-3']).toBe(2);
    expect(SPLITTER_COUNT['grid-2x2']).toBe(2);
    expect(SPLITTER_COUNT['main-side-2']).toBe(2);
  });

  it('DEFAULT_RATIOS は各レイアウトの SPLITTER_COUNT と一致する長さ', () => {
    expect(DEFAULT_RATIOS.single.length).toBe(0);
    expect(DEFAULT_RATIOS['cols-2'].length).toBe(1);
    expect(DEFAULT_RATIOS['cols-3'].length).toBe(2);
    expect(DEFAULT_RATIOS['grid-2x2'].length).toBe(2);
    expect(DEFAULT_RATIOS['main-side-2'].length).toBe(2);
  });

  it('DEFAULT_RATIOS の各要素は 0.1〜0.9 の範囲', () => {
    for (const mode of LAYOUT_MODES) {
      for (const r of DEFAULT_RATIOS[mode]) {
        expect(r).toBeGreaterThanOrEqual(0.1);
        expect(r).toBeLessThanOrEqual(0.9);
      }
    }
  });
});

describe('clampRatio', () => {
  it('範囲内はそのまま返す', () => {
    expect(clampRatio(0.5)).toBe(0.5);
    expect(clampRatio(0.25)).toBe(0.25);
  });
  it('下限 0.1 でクランプ', () => {
    expect(clampRatio(0)).toBe(0.1);
    expect(clampRatio(-0.5)).toBe(0.1);
    expect(clampRatio(0.05)).toBe(0.1);
  });
  it('上限 0.9 でクランプ', () => {
    expect(clampRatio(1)).toBe(0.9);
    expect(clampRatio(0.95)).toBe(0.9);
  });
  it('NaN は 0.5 で fallback', () => {
    expect(clampRatio(NaN)).toBe(0.5);
  });
});

describe('dropExtraPanes', () => {
  it('focusedIndex を最優先で残し、残り slot を埋める', () => {
    const panes = [
      { sessionId: 'a', windowIndex: 0 },
      { sessionId: 'b', windowIndex: 0 },
      { sessionId: 'c', windowIndex: 0 },
      { sessionId: 'd', windowIndex: 0 },
    ];
    const result = dropExtraPanes(panes, /* focusedIndex */ 2, /* nextCount */ 1);
    expect(result.panes).toEqual([{ sessionId: 'c', windowIndex: 0 }]);
    expect(result.focusedIndex).toBe(0);
  });

  it('縮小時に focused 以外の前方 pane を新スロットに詰め直す', () => {
    const panes = [
      { sessionId: 'a', windowIndex: 0 },
      { sessionId: 'b', windowIndex: 0 },
      { sessionId: 'c', windowIndex: 0 },
      { sessionId: 'd', windowIndex: 0 },
    ];
    // grid-2x2 (4) → cols-2 (2)。focused=3 (d) を残し、a を 0 番に詰める
    const result = dropExtraPanes(panes, 3, 2);
    expect(result.panes.length).toBe(2);
    expect(result.panes[0]).toEqual({ sessionId: 'd', windowIndex: 0 });
    // 残り 1 枠に最初の非 focused (a) が入る
    expect(result.panes[1]).toEqual({ sessionId: 'a', windowIndex: 0 });
    expect(result.focusedIndex).toBe(0);
  });

  it('拡張時は null で埋める', () => {
    const panes = [{ sessionId: 'a', windowIndex: 0 }];
    const result = dropExtraPanes(panes, 0, 3);
    expect(result.panes).toEqual([
      { sessionId: 'a', windowIndex: 0 },
      null,
      null,
    ]);
    expect(result.focusedIndex).toBe(0);
  });

  it('focusedIndex が範囲外の場合 0 にクランプ', () => {
    const panes = [{ sessionId: 'a', windowIndex: 0 }, null];
    const result = dropExtraPanes(panes, 5, 2);
    expect(result.focusedIndex).toBe(0);
  });
});
```

- [ ] **Step 2: テスト実行 → fail 確認**

```bash
npx -w @zenterm/web vitest run src/lib/__tests__/paneLayout.test.ts
```

Expected: FAIL "Cannot find module '../paneLayout'"

- [ ] **Step 3: paneLayout.ts 実装**

`packages/web/src/lib/paneLayout.ts`:

```ts
import type { PaneTarget } from '@/stores/pane';

export type LayoutMode = 'single' | 'cols-2' | 'cols-3' | 'grid-2x2' | 'main-side-2';

export const LAYOUT_MODES: readonly LayoutMode[] = [
  'single',
  'cols-2',
  'cols-3',
  'grid-2x2',
  'main-side-2',
] as const;

export const SLOT_COUNT: Record<LayoutMode, number> = {
  single: 1,
  'cols-2': 2,
  'cols-3': 3,
  'grid-2x2': 4,
  'main-side-2': 3,
};

export const SPLITTER_COUNT: Record<LayoutMode, number> = {
  single: 0,
  'cols-2': 1,
  'cols-3': 2,
  'grid-2x2': 2,
  'main-side-2': 2,
};

export const DEFAULT_RATIOS: Record<LayoutMode, number[]> = {
  single: [],
  'cols-2': [0.5],
  'cols-3': [1 / 3, 0.5],
  'grid-2x2': [0.5, 0.5],
  'main-side-2': [0.6, 0.5],
};

export const MIN_PANE_PX = 320;
export const RATIO_MIN = 0.1;
export const RATIO_MAX = 0.9;

export function clampRatio(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  if (value < RATIO_MIN) return RATIO_MIN;
  if (value > RATIO_MAX) return RATIO_MAX;
  return value;
}

export interface DropExtraResult {
  panes: (PaneTarget | null)[];
  focusedIndex: number;
}

export function dropExtraPanes(
  current: (PaneTarget | null)[],
  focusedIndex: number,
  nextCount: number,
): DropExtraResult {
  const clampedFocus =
    focusedIndex >= 0 && focusedIndex < current.length ? focusedIndex : 0;
  const focused = current[clampedFocus] ?? null;
  const rest = current.filter((_, i) => i !== clampedFocus);

  if (nextCount >= current.length) {
    const expanded: (PaneTarget | null)[] = [...current];
    while (expanded.length < nextCount) expanded.push(null);
    return {
      panes: expanded,
      focusedIndex: clampedFocus,
    };
  }

  const result: (PaneTarget | null)[] = [focused];
  for (const p of rest) {
    if (result.length >= nextCount) break;
    result.push(p);
  }
  while (result.length < nextCount) result.push(null);
  return { panes: result, focusedIndex: 0 };
}
```

- [ ] **Step 4: テスト実行 → pass 確認**

```bash
npx -w @zenterm/web vitest run src/lib/__tests__/paneLayout.test.ts
```

Expected: PASS (15 tests passed in 3 describes)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/paneLayout.ts packages/web/src/lib/__tests__/paneLayout.test.ts
git commit -m "feat(web): add paneLayout pure functions (5 layout modes + clamp/drop)"
```

---

## Task 2: paneStore (zustand persist)

**Files:**
- Create: `packages/web/src/stores/pane.ts`
- Test: `packages/web/src/stores/__tests__/pane.test.ts`

- [ ] **Step 1: 失敗テスト作成**

`packages/web/src/stores/__tests__/pane.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { usePaneStore } from '../pane';
import { SLOT_COUNT } from '@/lib/paneLayout';

const target = (id: string, w = 0) => ({ sessionId: id, windowIndex: w });

beforeEach(() => {
  // Reset persisted state to defaults
  window.localStorage.clear();
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
    ratios: {
      single: [],
      'cols-2': [0.5],
      'cols-3': [1 / 3, 0.5],
      'grid-2x2': [0.5, 0.5],
      'main-side-2': [0.6, 0.5],
    },
    savedLayout: null,
  });
});

describe('paneStore initial state', () => {
  it('初期値は single レイアウト + 1 pane null + focus 0', () => {
    const s = usePaneStore.getState();
    expect(s.layout).toBe('single');
    expect(s.panes).toEqual([null]);
    expect(s.focusedIndex).toBe(0);
  });
});

describe('setLayout', () => {
  it('cols-2 へ切替で panes 長が 2 に拡張、focus は保持', () => {
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().setLayout('cols-2');
    const s = usePaneStore.getState();
    expect(s.layout).toBe('cols-2');
    expect(s.panes.length).toBe(2);
    expect(s.panes[0]).toEqual(target('a'));
    expect(s.panes[1]).toBe(null);
    expect(s.focusedIndex).toBe(0);
  });

  it('grid-2x2 (4) → single (1) で focused を残し他は捨てる', () => {
    usePaneStore.getState().setLayout('grid-2x2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().assignPane(1, target('b'));
    usePaneStore.getState().assignPane(2, target('c'));
    usePaneStore.getState().assignPane(3, target('d'));
    usePaneStore.getState().setFocusedIndex(2);
    usePaneStore.getState().setLayout('single');
    const s = usePaneStore.getState();
    expect(s.layout).toBe('single');
    expect(s.panes).toEqual([target('c')]);
    expect(s.focusedIndex).toBe(0);
  });

  it('同じ layout へ setLayout してもクラッシュしない', () => {
    usePaneStore.getState().setLayout('single');
    expect(() => usePaneStore.getState().setLayout('single')).not.toThrow();
  });
});

describe('assignPane', () => {
  it('idx に target を入れる', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(1, target('z'));
    expect(usePaneStore.getState().panes[1]).toEqual(target('z'));
  });

  it('null クリア可能', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().assignPane(0, null);
    expect(usePaneStore.getState().panes[0]).toBe(null);
  });

  it('範囲外 idx は no-op', () => {
    const before = usePaneStore.getState().panes;
    usePaneStore.getState().assignPane(99, target('z'));
    expect(usePaneStore.getState().panes).toEqual(before);
  });
});

describe('openInFocusedPane', () => {
  it('focused idx に target を置く', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().setFocusedIndex(1);
    usePaneStore.getState().openInFocusedPane(target('a'));
    expect(usePaneStore.getState().panes[1]).toEqual(target('a'));
  });
});

describe('isOccupied', () => {
  it('別 idx で同 (s,w) があれば true', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    expect(usePaneStore.getState().isOccupied(target('a'))).toBe(true);
  });

  it('excludeIdx で除外指定すれば自分の slot は無視', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    expect(usePaneStore.getState().isOccupied(target('a'), 0)).toBe(false);
  });

  it('window index 違いは別物扱い', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a', 0));
    expect(usePaneStore.getState().isOccupied(target('a', 1))).toBe(false);
  });
});

describe('setRatio', () => {
  it('範囲内の値を保存', () => {
    usePaneStore.getState().setRatio('cols-2', 0, 0.7);
    expect(usePaneStore.getState().ratios['cols-2']).toEqual([0.7]);
  });

  it('範囲外は clamp', () => {
    usePaneStore.getState().setRatio('cols-2', 0, 1.5);
    expect(usePaneStore.getState().ratios['cols-2']).toEqual([0.9]);
    usePaneStore.getState().setRatio('cols-2', 0, -0.5);
    expect(usePaneStore.getState().ratios['cols-2']).toEqual([0.1]);
  });

  it('splitter idx が範囲外なら no-op', () => {
    const before = usePaneStore.getState().ratios['cols-2'];
    usePaneStore.getState().setRatio('cols-2', 5, 0.4);
    expect(usePaneStore.getState().ratios['cols-2']).toEqual(before);
  });
});

describe('suspendForSingle / resume', () => {
  it('現 layout を savedLayout に退避し single に切替', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().assignPane(1, target('b'));
    usePaneStore.getState().setFocusedIndex(1);

    usePaneStore.getState().suspendForSingle();
    const s = usePaneStore.getState();
    expect(s.layout).toBe('single');
    expect(s.savedLayout).toBe('cols-2');
    expect(s.panes).toEqual([target('b')]); // focused (idx=1) を残した
  });

  it('savedLayout を resume で復元', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().assignPane(1, target('b'));
    usePaneStore.getState().setFocusedIndex(1);
    usePaneStore.getState().suspendForSingle();
    // suspend 中に直接 layout を弄らない前提
    usePaneStore.getState().resume();
    const s = usePaneStore.getState();
    expect(s.layout).toBe('cols-2');
    expect(s.savedLayout).toBe(null);
    expect(s.panes.length).toBe(2);
  });

  it('savedLayout が null の場合 resume は no-op', () => {
    usePaneStore.getState().setLayout('single');
    usePaneStore.getState().resume();
    expect(usePaneStore.getState().layout).toBe('single');
    expect(usePaneStore.getState().savedLayout).toBe(null);
  });

  it('既に single のとき suspendForSingle は savedLayout を更新しない', () => {
    usePaneStore.getState().setLayout('single');
    usePaneStore.getState().suspendForSingle();
    expect(usePaneStore.getState().savedLayout).toBe(null);
  });
});

describe('persist round-trip', () => {
  it('panes / layout / ratios が localStorage に書かれる', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, target('a'));
    usePaneStore.getState().setRatio('cols-2', 0, 0.7);
    const raw = window.localStorage.getItem('zenterm-web-pane');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.layout).toBe('cols-2');
    expect(parsed.state.panes[0]).toEqual(target('a'));
    expect(parsed.state.ratios['cols-2']).toEqual([0.7]);
  });
});

describe('SLOT_COUNT contract', () => {
  it('setLayout 後の panes.length は SLOT_COUNT に一致', () => {
    for (const mode of ['single', 'cols-2', 'cols-3', 'grid-2x2', 'main-side-2'] as const) {
      usePaneStore.getState().setLayout(mode);
      expect(usePaneStore.getState().panes.length).toBe(SLOT_COUNT[mode]);
    }
  });
});
```

- [ ] **Step 2: テスト実行 → fail 確認**

```bash
npx -w @zenterm/web vitest run src/stores/__tests__/pane.test.ts
```

Expected: FAIL "Cannot find module '../pane'"

- [ ] **Step 3: pane.ts 実装**

`packages/web/src/stores/pane.ts`:

```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type LayoutMode,
  SLOT_COUNT,
  SPLITTER_COUNT,
  DEFAULT_RATIOS,
  clampRatio,
  dropExtraPanes,
} from '@/lib/paneLayout';

export interface PaneTarget {
  sessionId: string;
  windowIndex: number;
}

interface PaneState {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;
  ratios: Record<LayoutMode, number[]>;
  savedLayout: LayoutMode | null;

  setLayout: (mode: LayoutMode) => void;
  setFocusedIndex: (idx: number) => void;
  assignPane: (idx: number, target: PaneTarget | null) => void;
  openInFocusedPane: (target: PaneTarget) => void;
  setRatio: (mode: LayoutMode, splitterIdx: number, value: number) => void;
  isOccupied: (target: PaneTarget, excludeIdx?: number) => boolean;
  suspendForSingle: () => void;
  resume: () => void;
}

function defaultRatiosClone(): Record<LayoutMode, number[]> {
  return {
    single: [...DEFAULT_RATIOS.single],
    'cols-2': [...DEFAULT_RATIOS['cols-2']],
    'cols-3': [...DEFAULT_RATIOS['cols-3']],
    'grid-2x2': [...DEFAULT_RATIOS['grid-2x2']],
    'main-side-2': [...DEFAULT_RATIOS['main-side-2']],
  };
}

interface PersistedV1 {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;
  ratios: Record<LayoutMode, number[]>;
  savedLayout: LayoutMode | null;
}

export const usePaneStore = create<PaneState>()(
  persist(
    (set, get) => ({
      layout: 'single',
      panes: [null],
      focusedIndex: 0,
      ratios: defaultRatiosClone(),
      savedLayout: null,

      setLayout: (mode) => {
        const { panes, focusedIndex } = get();
        if (panes.length === SLOT_COUNT[mode]) {
          set({ layout: mode });
          return;
        }
        const { panes: nextPanes, focusedIndex: nextFocus } = dropExtraPanes(
          panes,
          focusedIndex,
          SLOT_COUNT[mode],
        );
        set({ layout: mode, panes: nextPanes, focusedIndex: nextFocus });
      },

      setFocusedIndex: (idx) => {
        const { panes } = get();
        if (idx < 0 || idx >= panes.length) return;
        set({ focusedIndex: idx });
      },

      assignPane: (idx, target) => {
        const { panes } = get();
        if (idx < 0 || idx >= panes.length) return;
        const next = panes.slice();
        next[idx] = target;
        set({ panes: next });
      },

      openInFocusedPane: (target) => {
        const { focusedIndex } = get();
        get().assignPane(focusedIndex, target);
      },

      setRatio: (mode, splitterIdx, value) => {
        if (splitterIdx < 0 || splitterIdx >= SPLITTER_COUNT[mode]) return;
        const { ratios } = get();
        const nextForMode = ratios[mode].slice();
        nextForMode[splitterIdx] = clampRatio(value);
        set({ ratios: { ...ratios, [mode]: nextForMode } });
      },

      isOccupied: (target, excludeIdx) => {
        const { panes } = get();
        return panes.some(
          (p, i) =>
            p !== null &&
            i !== excludeIdx &&
            p.sessionId === target.sessionId &&
            p.windowIndex === target.windowIndex,
        );
      },

      suspendForSingle: () => {
        const { layout } = get();
        if (layout === 'single') return;
        set({ savedLayout: layout });
        get().setLayout('single');
      },

      resume: () => {
        const { savedLayout } = get();
        if (!savedLayout) return;
        get().setLayout(savedLayout);
        set({ savedLayout: null });
      },
    }),
    {
      name: 'zenterm-web-pane',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        layout: s.layout,
        panes: s.panes,
        focusedIndex: s.focusedIndex,
        ratios: s.ratios,
        savedLayout: s.savedLayout,
      }),
      migrate: (persisted, _version): PersistedV1 => {
        const s = (persisted ?? {}) as Partial<PersistedV1>;
        return {
          layout: s.layout ?? 'single',
          panes: Array.isArray(s.panes) ? s.panes : [null],
          focusedIndex: typeof s.focusedIndex === 'number' ? s.focusedIndex : 0,
          ratios: s.ratios ?? defaultRatiosClone(),
          savedLayout: s.savedLayout ?? null,
        };
      },
    },
  ),
);
```

- [ ] **Step 4: テスト実行 → pass 確認**

```bash
npx -w @zenterm/web vitest run src/stores/__tests__/pane.test.ts
```

Expected: PASS (約 18 ケース)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/pane.ts packages/web/src/stores/__tests__/pane.test.ts
git commit -m "feat(web): add paneStore (zustand persist + layout/ratios/duplicate guard)"
```

---

## Task 3: SplitPane (汎用 2分割 splitter)

**Files:**
- Create: `packages/web/src/components/layout/SplitPane.tsx`
- Test: `packages/web/src/components/layout/__tests__/SplitPane.test.tsx`

- [ ] **Step 1: 失敗テスト**

`packages/web/src/components/layout/__tests__/SplitPane.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { SplitPane } from '../SplitPane';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

function setup(props: Partial<React.ComponentProps<typeof SplitPane>> = {}) {
  const onChange = vi.fn();
  render(
    <ThemeProvider>
      <div style={{ width: 800, height: 600 }}>
        <SplitPane
          orientation={props.orientation ?? 'vertical'}
          ratio={props.ratio ?? 0.5}
          onRatioChange={onChange}
          first={<div data-testid="first">First</div>}
          second={<div data-testid="second">Second</div>}
        />
      </div>
    </ThemeProvider>,
  );
  return { onChange };
}

describe('SplitPane', () => {
  it('first / second の両方を描画する', () => {
    setup();
    expect(screen.getByTestId('first')).toBeInTheDocument();
    expect(screen.getByTestId('second')).toBeInTheDocument();
  });

  it('vertical orientation で splitter は col-resize cursor', () => {
    setup({ orientation: 'vertical' });
    const splitter = screen.getByRole('separator');
    expect(splitter.style.cursor).toBe('col-resize');
  });

  it('horizontal orientation で splitter は row-resize cursor', () => {
    setup({ orientation: 'horizontal' });
    const splitter = screen.getByRole('separator');
    expect(splitter.style.cursor).toBe('row-resize');
  });

  it('splitter ドラッグで onRatioChange が呼ばれる (vertical)', () => {
    const { onChange } = setup({ orientation: 'vertical', ratio: 0.5 });
    const splitter = screen.getByRole('separator');
    const container = splitter.parentElement as HTMLElement;
    // jsdom は getBoundingClientRect を返すが値はゼロ。クラスを介してテスト
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
    });
    fireEvent.pointerDown(splitter, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 600, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 600, clientY: 300, pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toBeGreaterThan(0.5);
    expect(last).toBeLessThanOrEqual(0.9);
  });

  it('separator は aria-orientation を持つ', () => {
    setup({ orientation: 'vertical' });
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical');
  });
});
```

- [ ] **Step 2: テスト実行 → fail 確認**

```bash
npx -w @zenterm/web vitest run src/components/layout/__tests__/SplitPane.test.tsx
```

Expected: FAIL "Cannot find module '../SplitPane'"

- [ ] **Step 3: SplitPane 実装**

`packages/web/src/components/layout/SplitPane.tsx`:

```tsx
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useTheme } from '@/theme';
import { clampRatio } from '@/lib/paneLayout';

export type SplitOrientation = 'horizontal' | 'vertical';

export interface SplitPaneProps {
  orientation: SplitOrientation;
  ratio: number;
  onRatioChange: (next: number) => void;
  first: ReactNode;
  second: ReactNode;
}

export function SplitPane({
  orientation,
  ratio,
  onRatioChange,
  first,
  second,
}: SplitPaneProps) {
  const { tokens } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingRatioRef = useRef<number | null>(null);

  const isVertical = orientation === 'vertical';
  const clampedRatio = clampRatio(ratio);
  const firstSize = `${(clampedRatio * 100).toFixed(4)}%`;
  const secondSize = `${((1 - clampedRatio) * 100).toFixed(4)}%`;

  const commit = useCallback(() => {
    if (pendingRatioRef.current !== null) {
      onRatioChange(pendingRatioRef.current);
      pendingRatioRef.current = null;
    }
    rafRef.current = null;
  }, [onRatioChange]);

  const onPointerMove = useCallback(
    (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const total = isVertical ? rect.width : rect.height;
      if (total <= 0) return;
      const offset = isVertical ? ev.clientX - rect.left : ev.clientY - rect.top;
      const next = clampRatio(offset / total);
      pendingRatioRef.current = next;
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(commit);
      }
    },
    [isVertical, commit],
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      commit();
    }
  }, [onPointerMove, commit]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    ev.preventDefault();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'row' : 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexBasis: firstSize,
          flexGrow: 0,
          flexShrink: 0,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={orientation}
        onPointerDown={onPointerDown}
        style={{
          flexBasis: 6,
          flexGrow: 0,
          flexShrink: 0,
          background: tokens.colors.borderSubtle,
          cursor: isVertical ? 'col-resize' : 'row-resize',
          touchAction: 'none',
        }}
      />
      <div
        style={{
          flexBasis: secondSize,
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {second}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テスト実行 → pass 確認**

```bash
npx -w @zenterm/web vitest run src/components/layout/__tests__/SplitPane.test.tsx
```

Expected: PASS (5 cases)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/layout/SplitPane.tsx packages/web/src/components/layout/__tests__/SplitPane.test.tsx
git commit -m "feat(web): add SplitPane (pointer-drag + rAF debounce + clamp 0.1-0.9)"
```

---

## Task 4: MultiPaneArea (paneStore + 5 レイアウト + TerminalPane 描画)

**Files:**
- Create: `packages/web/src/components/layout/MultiPaneArea.tsx`
- Test: `packages/web/src/components/layout/__tests__/MultiPaneArea.test.tsx`

- [ ] **Step 1: 失敗テスト**

`packages/web/src/components/layout/__tests__/MultiPaneArea.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { usePaneStore } from '@/stores/pane';
import { MultiPaneArea } from '../MultiPaneArea';

vi.mock('@/components/TerminalPane', () => ({
  TerminalPane: ({
    sessionId,
    paneIndex,
    isFocused,
    isVisible,
  }: { sessionId: string | null; paneIndex: number; isFocused: boolean; isVisible: boolean }) => (
    <div
      data-testid={`pane-${paneIndex}`}
      data-session={sessionId ?? ''}
      data-focused={String(isFocused)}
      data-visible={String(isVisible)}
    />
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
    ratios: {
      single: [],
      'cols-2': [0.5],
      'cols-3': [1 / 3, 0.5],
      'grid-2x2': [0.5, 0.5],
      'main-side-2': [0.6, 0.5],
    },
    savedLayout: null,
  });
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

function renderArea(isVisible = true) {
  return render(
    <ThemeProvider>
      <MultiPaneArea gatewayUrl="http://gw" token="tok" isVisible={isVisible} />
    </ThemeProvider>,
  );
}

describe('MultiPaneArea', () => {
  it('single layout で 1 pane を描画 (paneIndex=0, focused=true)', () => {
    usePaneStore.getState().assignPane(0, { sessionId: 's1', windowIndex: 0 });
    renderArea();
    const p0 = screen.getByTestId('pane-0');
    expect(p0.getAttribute('data-session')).toBe('s1');
    expect(p0.getAttribute('data-focused')).toBe('true');
  });

  it('cols-2 layout で 2 pane を描画、focused のみ data-focused=true', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 0 });
    usePaneStore.getState().assignPane(1, { sessionId: 'b', windowIndex: 0 });
    usePaneStore.getState().setFocusedIndex(1);
    renderArea();
    expect(screen.getByTestId('pane-0').getAttribute('data-focused')).toBe('false');
    expect(screen.getByTestId('pane-1').getAttribute('data-focused')).toBe('true');
  });

  it('cols-3 layout で 3 pane を描画', () => {
    usePaneStore.getState().setLayout('cols-3');
    renderArea();
    expect(screen.getByTestId('pane-0')).toBeInTheDocument();
    expect(screen.getByTestId('pane-1')).toBeInTheDocument();
    expect(screen.getByTestId('pane-2')).toBeInTheDocument();
  });

  it('grid-2x2 layout で 4 pane を描画', () => {
    usePaneStore.getState().setLayout('grid-2x2');
    renderArea();
    for (let i = 0; i < 4; i++) expect(screen.getByTestId(`pane-${i}`)).toBeInTheDocument();
  });

  it('main-side-2 layout で 3 pane を描画', () => {
    usePaneStore.getState().setLayout('main-side-2');
    renderArea();
    for (let i = 0; i < 3; i++) expect(screen.getByTestId(`pane-${i}`)).toBeInTheDocument();
  });

  it('isVisible=false のとき全 pane が data-visible=false', () => {
    usePaneStore.getState().setLayout('cols-2');
    renderArea(false);
    expect(screen.getByTestId('pane-0').getAttribute('data-visible')).toBe('false');
    expect(screen.getByTestId('pane-1').getAttribute('data-visible')).toBe('false');
  });

  it('pane クリックで focusedIndex が変わる', () => {
    usePaneStore.getState().setLayout('cols-2');
    usePaneStore.getState().setFocusedIndex(0);
    renderArea();
    fireEvent.click(screen.getByTestId('pane-1').parentElement as HTMLElement);
    expect(usePaneStore.getState().focusedIndex).toBe(1);
  });
});
```

- [ ] **Step 2: テスト実行 → fail 確認**

```bash
npx -w @zenterm/web vitest run src/components/layout/__tests__/MultiPaneArea.test.tsx
```

Expected: FAIL "Cannot find module '../MultiPaneArea'"

- [ ] **Step 3: MultiPaneArea 実装**

`packages/web/src/components/layout/MultiPaneArea.tsx`:

```tsx
import { type ReactNode } from 'react';
import { TerminalPane } from '@/components/TerminalPane';
import { SplitPane } from './SplitPane';
import { usePaneStore } from '@/stores/pane';
import type { LayoutMode } from '@/lib/paneLayout';

export interface MultiPaneAreaProps {
  gatewayUrl: string;
  token: string;
  isVisible: boolean;
}

export function MultiPaneArea({ gatewayUrl, token, isVisible }: MultiPaneAreaProps) {
  const layout = usePaneStore((s) => s.layout);
  const panes = usePaneStore((s) => s.panes);
  const focusedIndex = usePaneStore((s) => s.focusedIndex);
  const ratios = usePaneStore((s) => s.ratios);
  const setFocusedIndex = usePaneStore((s) => s.setFocusedIndex);
  const setRatio = usePaneStore((s) => s.setRatio);

  const slot = (idx: number): ReactNode => (
    <div
      onClick={() => setFocusedIndex(idx)}
      style={{ width: '100%', height: '100%' }}
    >
      <TerminalPane
        gatewayUrl={gatewayUrl}
        token={token}
        sessionId={panes[idx]?.sessionId ?? null}
        windowIndex={panes[idx]?.windowIndex ?? null}
        paneIndex={idx}
        isFocused={idx === focusedIndex}
        isVisible={isVisible}
      />
    </div>
  );

  const setR = (mode: LayoutMode, splitterIdx: number) => (v: number) =>
    setRatio(mode, splitterIdx, v);

  if (layout === 'single') {
    return <div style={{ width: '100%', height: '100%' }}>{slot(0)}</div>;
  }

  if (layout === 'cols-2') {
    return (
      <SplitPane
        orientation="vertical"
        ratio={ratios['cols-2'][0]}
        onRatioChange={setR('cols-2', 0)}
        first={slot(0)}
        second={slot(1)}
      />
    );
  }

  if (layout === 'cols-3') {
    return (
      <SplitPane
        orientation="vertical"
        ratio={ratios['cols-3'][0]}
        onRatioChange={setR('cols-3', 0)}
        first={slot(0)}
        second={
          <SplitPane
            orientation="vertical"
            ratio={ratios['cols-3'][1]}
            onRatioChange={setR('cols-3', 1)}
            first={slot(1)}
            second={slot(2)}
          />
        }
      />
    );
  }

  if (layout === 'grid-2x2') {
    return (
      <SplitPane
        orientation="horizontal"
        ratio={ratios['grid-2x2'][1]}
        onRatioChange={setR('grid-2x2', 1)}
        first={
          <SplitPane
            orientation="vertical"
            ratio={ratios['grid-2x2'][0]}
            onRatioChange={setR('grid-2x2', 0)}
            first={slot(0)}
            second={slot(1)}
          />
        }
        second={
          <SplitPane
            orientation="vertical"
            ratio={ratios['grid-2x2'][0]}
            onRatioChange={setR('grid-2x2', 0)}
            first={slot(2)}
            second={slot(3)}
          />
        }
      />
    );
  }

  // main-side-2
  return (
    <SplitPane
      orientation="vertical"
      ratio={ratios['main-side-2'][0]}
      onRatioChange={setR('main-side-2', 0)}
      first={slot(0)}
      second={
        <SplitPane
          orientation="horizontal"
          ratio={ratios['main-side-2'][1]}
          onRatioChange={setR('main-side-2', 1)}
          first={slot(1)}
          second={slot(2)}
        />
      }
    />
  );
}
```

- [ ] **Step 4: テスト実行 → pass 確認**

```bash
npx -w @zenterm/web vitest run src/components/layout/__tests__/MultiPaneArea.test.tsx
```

Expected: PASS (7 cases)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/layout/MultiPaneArea.tsx packages/web/src/components/layout/__tests__/MultiPaneArea.test.tsx
git commit -m "feat(web): add MultiPaneArea (5 layouts via SplitPane composition + focused tracking)"
```

---

## Task 5: TerminalPane に paneIndex / isFocused props を追加

**Files:**
- Modify: `packages/web/src/components/TerminalPane.tsx` (props 拡張)
- Modify: `packages/web/src/components/__tests__/TerminalPane.header.test.tsx` (新 props を渡す)

- [ ] **Step 1: 既存テストを更新 (失敗化)**

`packages/web/src/components/__tests__/TerminalPane.header.test.tsx` の各 `<TerminalPane>` 呼び出し位置 (line 47, 65, 87 周辺) で props に `paneIndex={0}` と `isFocused` を追加:

```tsx
<TerminalPane
  gatewayUrl="http://gateway.test:18765"
  token="t"
  sessionId="dev"
  windowIndex={0}
  paneIndex={0}
  isFocused
  isVisible
/>
```

- [ ] **Step 2: 既存テストを実行 → 型エラー or テスト fail 確認**

```bash
npx -w @zenterm/web vitest run src/components/__tests__/TerminalPane.header.test.tsx
```

Expected: FAIL or TS error (`paneIndex` / `isFocused` が type にない)

- [ ] **Step 3: TerminalPane.tsx に props 追加**

`packages/web/src/components/TerminalPane.tsx` を修正:

```tsx
export interface TerminalPaneProps {
  gatewayUrl: string;
  token: string;
  sessionId: string | null;
  windowIndex: number | null;
  paneIndex: number;
  isFocused: boolean;
  isVisible: boolean;
}

export function TerminalPane({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  paneIndex,
  isFocused,
  isVisible,
}: TerminalPaneProps) {
  // ... (既存ロジック)
  // XtermView 呼び出しの isFocused を新 prop の isFocused && isVisible に変更:
  //   isFocused={isFocused && isVisible}
  // (これにより focused でない pane は disableStdin=true)
}
```

XtermView に渡す `isFocused` 値は **`isFocused && isVisible`** に変更する。`paneIndex` は現状ヘッダー表示には使わないが、Task 6 で `onLayoutMenu` を出すかどうかの判定 + 将来 ⌘[ / ⌘] ペイン番号表示で使うので props として受ける。

- [ ] **Step 4: テスト実行 → pass 確認**

```bash
npx -w @zenterm/web vitest run src/components/__tests__/TerminalPane.header.test.tsx
```

Expected: PASS (3 cases)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/TerminalPane.tsx packages/web/src/components/__tests__/TerminalPane.header.test.tsx
git commit -m "feat(web): TerminalPane accepts paneIndex + isFocused props (focus-aware stdin)"
```

---

## Task 6: LayoutSelector (⊟▾ ポップオーバー)

**Files:**
- Create: `packages/web/src/components/terminal/LayoutSelector.tsx`
- Test: `packages/web/src/components/terminal/__tests__/LayoutSelector.test.tsx`

- [ ] **Step 1: 失敗テスト**

`packages/web/src/components/terminal/__tests__/LayoutSelector.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { usePaneStore } from '@/stores/pane';
import { LayoutSelector } from '../LayoutSelector';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en', fontSize: 14 } as any);
  initI18n();
  window.localStorage.clear();
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
    ratios: {
      single: [],
      'cols-2': [0.5],
      'cols-3': [1 / 3, 0.5],
      'grid-2x2': [0.5, 0.5],
      'main-side-2': [0.6, 0.5],
    },
    savedLayout: null,
  });
});

describe('LayoutSelector', () => {
  it('ボタンクリックで 5 種のメニュー項目が出る', () => {
    render(
      <ThemeProvider>
        <LayoutSelector />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    expect(screen.getByRole('menuitem', { name: /single/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /2 cols/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /3 cols/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /2x2/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /main \+ side/i })).toBeInTheDocument();
  });

  it('メニュー項目クリックで paneStore.setLayout が呼ばれる', () => {
    render(
      <ThemeProvider>
        <LayoutSelector />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /2x2/i }));
    expect(usePaneStore.getState().layout).toBe('grid-2x2');
  });

  it('現在の layout はメニュー上で aria-checked', () => {
    usePaneStore.getState().setLayout('cols-2');
    render(
      <ThemeProvider>
        <LayoutSelector />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    const checked = screen.getByRole('menuitem', { name: /2 cols/i });
    expect(checked.getAttribute('aria-checked')).toBe('true');
  });

  it('Escape でメニューが閉じる', () => {
    render(
      <ThemeProvider>
        <LayoutSelector />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
```

- [ ] **Step 2: テスト fail 確認**

```bash
npx -w @zenterm/web vitest run src/components/terminal/__tests__/LayoutSelector.test.tsx
```

Expected: FAIL "Cannot find module '../LayoutSelector'"

- [ ] **Step 3: LayoutSelector 実装**

`packages/web/src/components/terminal/LayoutSelector.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { usePaneStore } from '@/stores/pane';
import { LAYOUT_MODES, type LayoutMode } from '@/lib/paneLayout';

const I18N_KEY: Record<LayoutMode, string> = {
  single: 'terminal.layout.single',
  'cols-2': 'terminal.layout.cols2',
  'cols-3': 'terminal.layout.cols3',
  'grid-2x2': 'terminal.layout.grid2x2',
  'main-side-2': 'terminal.layout.mainSide2',
};

export function LayoutSelector() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const layout = usePaneStore((s) => s.layout);
  const setLayout = usePaneStore((s) => s.setLayout);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('terminal.layout.menuLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          background: tokens.colors.surface,
          color: tokens.colors.textPrimary,
          border: `1px solid ${tokens.colors.border}`,
          padding: `2px 8px`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.caption.fontSize,
          cursor: 'pointer',
        }}
      >
        ⊟▾
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: tokens.colors.bgElevated,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radii.md,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: tokens.spacing.xs,
            minWidth: 180,
            zIndex: 100,
          }}
        >
          {LAYOUT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              aria-checked={mode === layout}
              onClick={() => {
                setLayout(mode);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
                background: mode === layout ? tokens.colors.primarySubtle : 'transparent',
                color: tokens.colors.textPrimary,
                border: 'none',
                borderRadius: tokens.radii.sm,
                cursor: 'pointer',
                fontSize: tokens.typography.smallMedium.fontSize,
              }}
            >
              {t(I18N_KEY[mode])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: i18n キーを先取り追加** (テストが label を参照するため)

`packages/web/src/i18n/locales/en.json` に追加 (既存 `terminal` namespace の末尾に):

```json
    "layout": {
      "menuLabel": "Change layout",
      "single": "Single",
      "cols2": "2 cols",
      "cols3": "3 cols",
      "grid2x2": "2x2 grid",
      "mainSide2": "Main + 2 side"
    }
```

`packages/web/src/i18n/locales/ja.json` に同様 (既存 `terminal` namespace に):

```json
    "layout": {
      "menuLabel": "レイアウト変更",
      "single": "単一",
      "cols2": "2列",
      "cols3": "3列",
      "grid2x2": "2x2 グリッド",
      "mainSide2": "主 + 副2"
    }
```

- [ ] **Step 5: テスト実行 → pass 確認**

```bash
npx -w @zenterm/web vitest run src/components/terminal/__tests__/LayoutSelector.test.tsx
```

Expected: PASS (4 cases)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/terminal/LayoutSelector.tsx packages/web/src/components/terminal/__tests__/LayoutSelector.test.tsx packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "feat(web): add LayoutSelector (toolbar layout dropdown, 5 presets, i18n)"
```

---

## Task 7: TerminalHeader に LayoutSelector を統合

**Files:**
- Modify: `packages/web/src/components/terminal/TerminalHeader.tsx` (slot prop で受ける)
- Modify: `packages/web/src/components/__tests__/TerminalPane.header.test.tsx` (focused pane で ⊟▾ が出ることを検証)

- [ ] **Step 1: テスト追加 (失敗)**

`packages/web/src/components/__tests__/TerminalPane.header.test.tsx` の describe 末尾に追加:

```tsx
  it('focused=true のとき layout selector ボタンが表示される', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused
        isVisible
      />,
    );
    expect(screen.getByRole('button', { name: /change layout/i })).toBeInTheDocument();
  });

  it('focused=false のとき layout selector ボタンは出ない', () => {
    render(
      <TerminalPane
        gatewayUrl="http://gateway.test:18765"
        token="t"
        sessionId="dev"
        windowIndex={0}
        paneIndex={0}
        isFocused={false}
        isVisible
      />,
    );
    expect(screen.queryByRole('button', { name: /change layout/i })).toBeNull();
  });
```

- [ ] **Step 2: テスト実行 → fail 確認**

```bash
npx -w @zenterm/web vitest run src/components/__tests__/TerminalPane.header.test.tsx
```

Expected: FAIL (新 2 ケースが失敗)

- [ ] **Step 3: TerminalHeader と TerminalPane を更新**

`packages/web/src/components/terminal/TerminalHeader.tsx` の `TerminalHeaderProps` に追加:

```ts
export interface TerminalHeaderProps {
  // ... 既存
  layoutSlot?: React.ReactNode;
}
```

`{labelText}` の直後 (line 102 周辺、`<span style={{ flex: 1 }} />` の直前) に挿入:

```tsx
      {props.layoutSlot}
```

(関数の引数オブジェクトを `props` にリネームするか、destructure に `layoutSlot` を追加して `{layoutSlot}` で参照。後者を選ぶ。)

`packages/web/src/components/TerminalPane.tsx` で `<TerminalHeader>` 呼び出しに props を追加:

```tsx
import { LayoutSelector } from './terminal/LayoutSelector';

// ...
<TerminalHeader
  // ... 既存 props
  layoutSlot={isFocused ? <LayoutSelector /> : null}
/>
```

- [ ] **Step 4: テスト実行 → pass 確認**

```bash
npx -w @zenterm/web vitest run src/components/__tests__/TerminalPane.header.test.tsx
```

Expected: PASS (5 cases、新 2 ケース含む)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/terminal/TerminalHeader.tsx packages/web/src/components/TerminalPane.tsx packages/web/src/components/__tests__/TerminalPane.header.test.tsx
git commit -m "feat(web): wire LayoutSelector into TerminalHeader (visible on focused pane only)"
```

---

## Task 8: sessionView を paneStore ラッパに差替

**Files:**
- Modify: `packages/web/src/stores/sessionView.ts`
- Modify: `packages/web/src/stores/__tests__/sessionView.test.ts` (既存があれば更新、無ければ作成)

- [ ] **Step 1: テスト作成 / 更新 (失敗化)**

`packages/web/src/stores/__tests__/sessionView.test.ts` (新規):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionViewStore } from '../sessionView';
import { usePaneStore } from '../pane';

beforeEach(() => {
  window.localStorage.clear();
  usePaneStore.setState({
    layout: 'single',
    panes: [null],
    focusedIndex: 0,
    ratios: {
      single: [],
      'cols-2': [0.5],
      'cols-3': [1 / 3, 0.5],
      'grid-2x2': [0.5, 0.5],
      'main-side-2': [0.6, 0.5],
    },
    savedLayout: null,
  });
});

describe('sessionView (paneStore wrapper)', () => {
  it('open(sessionId, windowIndex) で paneStore.openInFocusedPane が呼ばれる', () => {
    useSessionViewStore.getState().open('dev', 2);
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'dev', windowIndex: 2 });
  });

  it('open(sessionId) で windowIndex は null', () => {
    useSessionViewStore.getState().open('dev');
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'dev', windowIndex: null as any });
  });

  it('activeSessionId / activeWindowIndex は focused pane の派生', () => {
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 1 });
    const s = useSessionViewStore.getState();
    expect(s.activeSessionId).toBe('a');
    expect(s.activeWindowIndex).toBe(1);
  });

  it('close() で focused pane を null にする', () => {
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 0 });
    useSessionViewStore.getState().close();
    expect(usePaneStore.getState().panes[0]).toBe(null);
  });

  it('setWindow(idx) は focused pane の windowIndex のみ更新', () => {
    usePaneStore.getState().assignPane(0, { sessionId: 'a', windowIndex: 0 });
    useSessionViewStore.getState().setWindow(3);
    expect(usePaneStore.getState().panes[0]).toEqual({ sessionId: 'a', windowIndex: 3 });
  });

  it('focused pane が null のとき setWindow は no-op', () => {
    useSessionViewStore.getState().setWindow(3);
    expect(usePaneStore.getState().panes[0]).toBe(null);
  });
});
```

- [ ] **Step 2: テスト fail 確認**

```bash
npx -w @zenterm/web vitest run src/stores/__tests__/sessionView.test.ts
```

Expected: FAIL (現状の sessionView は paneStore と独立)

- [ ] **Step 3: sessionView.ts を paneStore ラッパに置換**

`packages/web/src/stores/sessionView.ts` を全置換:

```ts
import { useSyncExternalStore } from 'react';
import { usePaneStore } from './pane';

interface SessionViewSnapshot {
  activeSessionId: string | null;
  activeWindowIndex: number | null;
  open: (sessionId: string, windowIndex?: number) => void;
  close: () => void;
  setWindow: (windowIndex: number) => void;
}

function getSnapshot(): SessionViewSnapshot {
  const { panes, focusedIndex } = usePaneStore.getState();
  const focused = panes[focusedIndex] ?? null;
  return {
    activeSessionId: focused?.sessionId ?? null,
    activeWindowIndex: focused?.windowIndex ?? null,
    open: (sessionId, windowIndex) => {
      usePaneStore.getState().openInFocusedPane({
        sessionId,
        windowIndex: windowIndex ?? (null as unknown as number),
      });
    },
    close: () => {
      const { focusedIndex: idx } = usePaneStore.getState();
      usePaneStore.getState().assignPane(idx, null);
    },
    setWindow: (windowIndex) => {
      const { panes: ps, focusedIndex: idx } = usePaneStore.getState();
      const current = ps[idx];
      if (!current) return;
      usePaneStore.getState().assignPane(idx, {
        sessionId: current.sessionId,
        windowIndex,
      });
    },
  };
}

export const useSessionViewStore = Object.assign(
  function useSessionViewStoreHook<T>(selector: (s: SessionViewSnapshot) => T): T {
    return useSyncExternalStore(
      (cb) => usePaneStore.subscribe(cb),
      () => selector(getSnapshot()),
      () => selector(getSnapshot()),
    );
  },
  {
    getState: getSnapshot,
    setState: (
      partial:
        | Partial<Pick<SessionViewSnapshot, 'activeSessionId' | 'activeWindowIndex'>>
        | ((s: SessionViewSnapshot) => Partial<SessionViewSnapshot>),
    ) => {
      const next = typeof partial === 'function' ? partial(getSnapshot()) : partial;
      const sid = 'activeSessionId' in next ? next.activeSessionId ?? null : getSnapshot().activeSessionId;
      const widx =
        'activeWindowIndex' in next ? next.activeWindowIndex ?? null : getSnapshot().activeWindowIndex;
      const { focusedIndex: idx } = usePaneStore.getState();
      if (sid === null) {
        usePaneStore.getState().assignPane(idx, null);
      } else {
        usePaneStore.getState().assignPane(idx, {
          sessionId: sid,
          windowIndex: widx as number,
        });
      }
    },
  },
);
```

注: 既存テスト `AuthenticatedShell.test.tsx` (line 47, 92) が `useSessionViewStore.setState({ activeSessionId: ..., activeWindowIndex: ... })` を呼ぶので、`setState` 互換 API を提供する必要がある (上記の `setState` プロパティで対応)。

- [ ] **Step 4: テスト実行 → pass 確認**

```bash
npx -w @zenterm/web vitest run src/stores/__tests__/sessionView.test.ts src/components/__tests__/AuthenticatedShell.test.tsx
```

Expected: PASS (両ファイル合計 9 ケース)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/stores/sessionView.ts packages/web/src/stores/__tests__/sessionView.test.ts
git commit -m "refactor(web): sessionView store wraps paneStore (focused pane derivation, API compat)"
```

---

## Task 9: AuthenticatedShell が MultiPaneArea を使うように修正

**Files:**
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/components/__tests__/AuthenticatedShell.test.tsx` (新挙動を検証)

- [ ] **Step 1: テスト更新 / 追加**

`AuthenticatedShell.test.tsx` を編集。既存の `it('keeps TerminalPane mounted (hidden) when navigated to /web/files', ...)` ケースは現状 1 pane 前提で書かれているが、Phase 3 でも引き続き single layout でこのテストを通したい。

加えて新ケースを追加:

```tsx
  it('suspends current layout to single when route leaves /web/sessions', async () => {
    useAuthStore.setState({ token: 'tok', gatewayUrl: 'http://example' });
    // pre-set cols-2
    const { usePaneStore } = await import('@/stores/pane');
    usePaneStore.setState({
      layout: 'cols-2',
      panes: [{ sessionId: 'a', windowIndex: 0 }, { sessionId: 'b', windowIndex: 0 }],
      focusedIndex: 0,
      ratios: {
        single: [],
        'cols-2': [0.5],
        'cols-3': [1 / 3, 0.5],
        'grid-2x2': [0.5, 0.5],
        'main-side-2': [0.6, 0.5],
      },
      savedLayout: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ entries: [], path: '~' }),
      text: async () => '{"entries":[],"path":"~"}',
    }));
    render(
      <MemoryRouter initialEntries={['/web/files']}>
        <AuthenticatedShell />
      </MemoryRouter>,
    );
    await act(async () => { await Promise.resolve(); });
    expect(usePaneStore.getState().layout).toBe('single');
    expect(usePaneStore.getState().savedLayout).toBe('cols-2');
  });
```

- [ ] **Step 2: テスト fail 確認**

```bash
npx -w @zenterm/web vitest run src/components/__tests__/AuthenticatedShell.test.tsx
```

Expected: FAIL (新ケース)

- [ ] **Step 3: AuthenticatedShell 実装**

`AuthenticatedShell.tsx` を変更:

1. import 追加:
   ```ts
   import { MultiPaneArea } from '@/components/layout/MultiPaneArea';
   import { usePaneStore } from '@/stores/pane';
   ```

2. `TerminalPane` の import を削除 (もう shell から直接呼ばない)。

3. `useSessionViewStore` の `open` 取得は維持 (Sidebar の onSelect 用)。

4. `isFilesRoute` 判定の直下に追加:
   ```ts
   const isSessionsRoute = location.pathname.startsWith('/web/sessions');
   useEffect(() => {
     if (isSessionsRoute) {
       usePaneStore.getState().resume();
     } else {
       usePaneStore.getState().suspendForSingle();
     }
   }, [isSessionsRoute]);
   ```

5. `return (...)` の `<TerminalPane ... />` を `<MultiPaneArea gatewayUrl={gatewayUrl} token={token} isVisible={!isFilesRoute} />` に置換。

- [ ] **Step 4: テスト pass 確認**

```bash
npx -w @zenterm/web vitest run src/components/__tests__/AuthenticatedShell.test.tsx
```

Expected: PASS (既存 3 + 新規 1 = 4 cases)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/AuthenticatedShell.tsx packages/web/src/components/__tests__/AuthenticatedShell.test.tsx
git commit -m "feat(web): AuthenticatedShell uses MultiPaneArea, suspends to single off /web/sessions"
```

---

## Task 10: Sidebar WindowRow に重複ガード + 「別ペインで開く」

**Files:**
- Modify: `packages/web/src/components/sidebar/WindowRow.tsx`
- Modify: `packages/web/src/components/SessionsListPanel.tsx` (重複情報 + paneStore 接続)
- Modify: `packages/web/src/components/Sidebar.tsx` (props pass-through)
- Modify: `packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx` (既存があれば、なければ新規)

- [ ] **Step 1: WindowRow 用テスト作成 (失敗)**

`packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx` (新規 or 既存に追加):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { initI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { WindowRow } from '../WindowRow';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en' } as any);
  initI18n();
});

const baseWindow = {
  index: 0,
  name: 'main',
  active: true,
  zoomed: false,
  paneCount: 1,
  cwd: '/',
};

describe('WindowRow duplicate guard', () => {
  it('isOccupiedElsewhere=true で disabled + ⛔ プレフィックス', () => {
    render(
      <ThemeProvider>
        <WindowRow
          sessionDisplayName="dev"
          window={baseWindow}
          isActive={false}
          isOccupiedElsewhere
          openInPaneOptions={[]}
          onSelect={vi.fn()}
          onRename={vi.fn()}
          onRequestDelete={vi.fn()}
          onOpenInPane={vi.fn()}
        />
      </ThemeProvider>,
    );
    const btn = screen.getByRole('button', { name: /main/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/⛔/);
  });

  it('isOccupiedElsewhere=true のとき onSelect は呼ばれない', () => {
    const onSelect = vi.fn();
    render(
      <ThemeProvider>
        <WindowRow
          sessionDisplayName="dev"
          window={baseWindow}
          isActive={false}
          isOccupiedElsewhere
          openInPaneOptions={[]}
          onSelect={onSelect}
          onRename={vi.fn()}
          onRequestDelete={vi.fn()}
          onOpenInPane={vi.fn()}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /main/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('WindowRow openInPane menu', () => {
  it('openInPaneOptions が空でないときメニューに「Open in pane N」項目が出る', () => {
    render(
      <ThemeProvider>
        <WindowRow
          sessionDisplayName="dev"
          window={baseWindow}
          isActive={false}
          isOccupiedElsewhere={false}
          openInPaneOptions={[1, 2]}
          onSelect={vi.fn()}
          onRename={vi.fn()}
          onRequestDelete={vi.fn()}
          onOpenInPane={vi.fn()}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /actions for window/i }));
    expect(screen.getByRole('menuitem', { name: /open in pane 2/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /open in pane 3/i })).toBeInTheDocument(); // 1-based
  });

  it('「Open in pane N」クリックで onOpenInPane(idx) が呼ばれる (0-based)', () => {
    const onOpenInPane = vi.fn();
    render(
      <ThemeProvider>
        <WindowRow
          sessionDisplayName="dev"
          window={baseWindow}
          isActive={false}
          isOccupiedElsewhere={false}
          openInPaneOptions={[1, 2]}
          onSelect={vi.fn()}
          onRename={vi.fn()}
          onRequestDelete={vi.fn()}
          onOpenInPane={onOpenInPane}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /actions for window/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /open in pane 3/i }));
    expect(onOpenInPane).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: テスト fail 確認**

```bash
npx -w @zenterm/web vitest run src/components/sidebar/__tests__/WindowRow.test.tsx
```

Expected: FAIL (`isOccupiedElsewhere` / `openInPaneOptions` / `onOpenInPane` 未実装)

- [ ] **Step 3: WindowRow 修正**

`packages/web/src/components/sidebar/WindowRow.tsx` の `WindowRowProps` に追加:

```ts
export interface WindowRowProps {
  // ... 既存
  isOccupiedElsewhere: boolean;
  openInPaneOptions: number[]; // 開ける他 pane の 0-based index 列
  onOpenInPane: (paneIndex: number) => void;
}
```

ボタンを変更:
- `disabled={isOccupiedElsewhere}` を追加
- `onClick={!isOccupiedElsewhere ? onSelect : undefined}`
- 表示テキスト: `{isOccupiedElsewhere ? '⛔ ' : ''}{window.name}`

`RowActionsMenu` の items 配列を構築:

```ts
const baseItems = [
  { label: t('common.rename'), onClick: () => setMode('editing-name') },
  { label: t('common.delete'), onClick: () => onRequestDelete(sessionDisplayName, window), destructive: true },
];
const openInItems = openInPaneOptions.map((idx) => ({
  label: t('sessions.openInPane.label', { pane: idx + 1 }),
  onClick: () => onOpenInPane(idx),
}));
const items = [...openInItems, ...baseItems];
```

- [ ] **Step 4: SessionsListPanel から paneStore 接続**

`packages/web/src/components/SessionsListPanel.tsx` を編集。

import 追加:
```ts
import { usePaneStore } from '@/stores/pane';
```

コンポーネント内:
```ts
const panes = usePaneStore((s) => s.panes);
const focusedIndex = usePaneStore((s) => s.focusedIndex);
const assignPane = usePaneStore((s) => s.assignPane);
```

各 `<WindowRow>` 呼び出し (line 137-146) を以下に変更:

```tsx
{session.windows.map((w) => {
  const target = { sessionId: session.displayName, windowIndex: w.index };
  const occupyingIdx = panes.findIndex(
    (p) => p && p.sessionId === target.sessionId && p.windowIndex === target.windowIndex,
  );
  const isOccupiedElsewhere = occupyingIdx !== -1 && occupyingIdx !== focusedIndex;
  const openInPaneOptions = panes
    .map((_, i) => i)
    .filter((i) => i !== focusedIndex && i !== occupyingIdx);
  const isWindowActive = isActive && activeWindowIndex === w.index;
  return (
    <WindowRow
      key={w.index}
      sessionDisplayName={session.displayName}
      window={w}
      isActive={isWindowActive}
      isOccupiedElsewhere={isOccupiedElsewhere}
      openInPaneOptions={openInPaneOptions}
      onSelect={() => onSelect(session.displayName, w.index)}
      onRename={onRenameWindow}
      onRequestDelete={onRequestDeleteWindow}
      onOpenInPane={(idx) => assignPane(idx, target)}
    />
  );
})}
```

- [ ] **Step 5: Sidebar.tsx は props pass-through のみ** (SessionsListPanel が直接 paneStore を読むので、Sidebar は無変更で OK)

- [ ] **Step 6: i18n キー追加**

`packages/web/src/i18n/locales/en.json` の `sessions` namespace に追加:

```json
    "openInPane": {
      "label": "Open in pane {{pane}}"
    }
```

`packages/web/src/i18n/locales/ja.json` の `sessions` namespace に追加:

```json
    "openInPane": {
      "label": "ペイン {{pane}} で開く"
    }
```

- [ ] **Step 7: テスト pass 確認**

```bash
npx -w @zenterm/web vitest run src/components/sidebar/__tests__/WindowRow.test.tsx
```

Expected: PASS (4 cases)

`SessionsListPanel` 既存テストも回す:

```bash
npx -w @zenterm/web vitest run src/components/__tests__
```

Expected: PASS (既存テストは props 拡張で型エラーになる可能性。必要なら既存テストにダミーの `isOccupiedElsewhere={false} openInPaneOptions={[]} onOpenInPane={vi.fn()}` を追加)

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/components/sidebar/WindowRow.tsx packages/web/src/components/sidebar/__tests__/WindowRow.test.tsx packages/web/src/components/SessionsListPanel.tsx packages/web/src/i18n/locales/en.json packages/web/src/i18n/locales/ja.json
git commit -m "feat(web): WindowRow duplicate guard (⛔ disable) + 'Open in pane N' menu items"
```

---

## Task 11: build artifact 更新 (index.html bundle ref)

**Files:**
- Modify: `packages/gateway/public/web/index.html` (vite が再生成)
- Modify: `packages/gateway/public/web/assets/index-*.js` (新規 hash)

- [ ] **Step 1: web を build**

```bash
npm run -w @zenterm/web build
```

Expected: SUCCESS。出力に `../gateway/public/web/assets/index-XXXXX.js` (新 hash) と `index.html` 更新。

- [ ] **Step 2: 古い bundle を整理**

```bash
ls packages/gateway/public/web/assets/index-*.js
```

旧 hash (例: `index-JgsUHjvF.js`) を削除する判断:
- もし旧 hash と新 hash が両方残っていれば、`index.html` が新 hash のみ参照していることを確認した上で旧ファイルを削除:

```bash
# index.html が参照する hash を抽出
grep -oP 'index-[^.]+\.js' packages/gateway/public/web/index.html
# 上記以外の index-*.js を削除
```

- [ ] **Step 3: ローカル動作確認**

```bash
node packages/gateway/dist/index.js &
sleep 1
curl -sf http://127.0.0.1:18765/web/ | head -5
# index.html が返ること、200 OK を確認
curl -sf http://127.0.0.1:18765/web/assets/$(grep -oP 'index-[^.]+\.js' packages/gateway/public/web/index.html) > /dev/null
echo "asset OK: $?"
kill %1
```

Expected: index.html 配信 + asset 200。

- [ ] **Step 4: Commit**

```bash
git add packages/gateway/public/web/
git commit -m "build(web): rebuild bundle for Phase 3 multi-pane (index.html + assets)"
```

---

## Task 12: Playwright E2E `pane-split.spec.ts`

**Files:**
- Create: `tests/e2e/web/pane-split.spec.ts` (port 18811)

- [ ] **Step 1: E2E spec を作成**

`tests/e2e/web/pane-split.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let gateway: ChildProcess;
let baseUrl: string;
const TOKEN = '4811';
const PORT = 18811;

test.beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), 'zenterm-e2e-'));
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
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch { /* */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Gateway did not start within 6 seconds');
});

test.afterAll(async () => {
  try {
    await fetch(`${baseUrl}/api/sessions/e2e-pane-a`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` },
    });
    await fetch(`${baseUrl}/api/sessions/e2e-pane-b`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch { /* */ }
  gateway?.kill();
});

test('switching layout to cols-2 renders 2 panes and Sidebar duplicate guard works', async ({ page }) => {
  // Pre-create 2 sessions
  for (const name of ['e2e-pane-a', 'e2e-pane-b']) {
    const r = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    expect(r.ok).toBe(true);
  }

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

  // Click session "e2e-pane-a" to open in focused pane
  await page.getByText('e2e-pane-a').click();
  await expect(page.getByLabel(/Connection Connected/i)).toBeVisible({ timeout: 5000 });

  // Open layout selector and pick 2 cols
  await page.getByRole('button', { name: /change layout/i }).click();
  await page.getByRole('menuitem', { name: /2 cols/i }).click();

  // Now there should be 2 terminal sections
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(2);

  // Click the second (right) pane to focus it
  const panes = page.locator('section[data-terminal-root="true"]');
  await panes.nth(1).click();

  // Open e2e-pane-b in focused (right) pane
  await page.getByText('e2e-pane-b').click();
  await expect(page.getByLabel(/Connection Connected/i).nth(1)).toBeVisible({ timeout: 5000 });

  // Sidebar should now show e2e-pane-a as Active in pane 0 → if I expand e2e-pane-a's windows,
  // window 0 should be ⛔ disabled because it's occupying pane 0 (not focused = right pane).
  // Click the chevron / row to expand. The session row itself opens in focused pane,
  // but the test for duplicate guard is on WindowRow. We need a session with windows visible.

  // Expand e2e-pane-a (click expand chevron). SessionRow auto-expands when there are windows.
  // With only 1 window each, the chevron may not show. Use the SessionsListPanel via API
  // to add a window, then expand.
  await fetch(`${baseUrl}/api/sessions/e2e-pane-a/windows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'second' }),
  });

  // Refetch sessions UI by clicking another route then back
  await page.getByRole('button', { name: /Files tab/i }).click();
  await page.getByRole('button', { name: /Sessions tab/i }).click();

  // Expand a's windows
  const expandBtn = page.getByRole('button', { name: /expand windows/i }).first();
  await expandBtn.click();

  // Window 0 of e2e-pane-a is occupied in pane 0 (left), focused is pane 1 (right).
  // So window 0 should be ⛔ disabled.
  const windowRow0 = page.getByRole('button', { name: /^⛔ /i }).first();
  await expect(windowRow0).toBeVisible({ timeout: 3000 });
  await expect(windowRow0).toBeDisabled();
});

test('cols-2 → single drops the non-focused pane', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'zenterm-web-pane',
      JSON.stringify({
        state: {
          layout: 'cols-2',
          panes: [
            { sessionId: 'e2e-pane-a', windowIndex: 0 },
            { sessionId: 'e2e-pane-b', windowIndex: 0 },
          ],
          focusedIndex: 1,
          ratios: {
            single: [], 'cols-2': [0.5], 'cols-3': [1/3, 0.5],
            'grid-2x2': [0.5, 0.5], 'main-side-2': [0.6, 0.5],
          },
          savedLayout: null,
        },
        version: 1,
      }),
    );
    localStorage.setItem(
      'zenterm-web-settings',
      JSON.stringify({
        state: { themeMode: 'dark', language: 'en', fontSize: 14, autoCopyOnSelect: false },
        version: 2,
      }),
    );
  });

  // Pre-create sessions if not present
  for (const name of ['e2e-pane-a', 'e2e-pane-b']) {
    await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  }

  await page.goto(`${baseUrl}/web`);
  await page.getByLabel(/Token/i).fill(TOKEN);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(2, { timeout: 5000 });

  // Switch to single via layout selector
  await page.getByRole('button', { name: /change layout/i }).click();
  await page.getByRole('menuitem', { name: /^Single$/ }).click();

  await expect(page.locator('section[data-terminal-root="true"]')).toHaveCount(1);
  // Focused pane (idx=1) was e2e-pane-b → that's what's left
  await expect(page.getByText('e2e-pane-b')).toBeVisible();
});
```

- [ ] **Step 2: E2E 実行**

```bash
npm run -w @zenterm/web build  # bundle 最新を確実に
npx playwright test tests/e2e/web/pane-split.spec.ts
```

Expected: PASS (2 cases)

E2E 失敗時の典型原因:
- セレクタ `^⛔ ` の正規表現エスケープミス → `^\\u26d4 ` で書き直す
- localStorage seed の persist key 名違い → `zenterm-web-pane` を確認
- セッション API のレスポンス形式 → 既存 spec を参照

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/pane-split.spec.ts
git commit -m "test(e2e): pane-split (port 18811) — cols-2 split, duplicate guard, single fallback"
```

---

## Task 13: 最終ビルド + Phase 3 完了マーク

**Files:**
- Modify: `packages/gateway/public/web/index.html` (vite 出力)
- Modify: `packages/gateway/public/web/assets/index-*.js`
- 必要に応じて: `docs/superpowers/specs/2026-05-09-pc-web-design.md` (Phase 3 完了表記)

- [ ] **Step 1: Phase 3 全テストを最終確認**

```bash
# Unit + component
npm run -w @zenterm/web test
# Type check
npm run -w @zenterm/web typecheck 2>/dev/null || npm run -w @zenterm/web tsc --noEmit
# E2E
npx playwright test tests/e2e/web/
```

Expected: ALL PASS

- [ ] **Step 2: vite build を最終回**

```bash
npm run -w @zenterm/web build
```

Expected: `packages/gateway/public/web/index.html` と `assets/index-*.js` が最新。

- [ ] **Step 3: gateway をローカル起動 → スモークテスト**

```bash
systemctl --user stop zenterm-gateway.service 2>/dev/null
node packages/gateway/dist/index.js &
GW_PID=$!
sleep 1
curl -sf http://127.0.0.1:18765/web/ > /dev/null && echo "OK /web/"
# 認証付きで /api/sessions
curl -sf -H "Authorization: Bearer $(grep AUTH_TOKEN ~/.config/zenterm/.env | cut -d= -f2)" http://127.0.0.1:18765/api/sessions > /dev/null && echo "OK /api/sessions"
kill $GW_PID
systemctl --user start zenterm-gateway.service
```

Expected: 両 echo OK。

- [ ] **Step 4: Commit (build artifact)**

```bash
git add packages/gateway/public/web/
git commit -m "build(web): refresh bundle for Phase 3 multi-pane completion"
```

- [ ] **Step 5: PR or マージ準備**

最終的に `feature/web-pc-phase-3` を main にマージする前に:

```bash
git log --oneline main..HEAD
```

確認できたら finishing-a-development-branch skill で merge/PR 選択へ進む。

---

## Self-Review チェックリスト

### Spec coverage

| Spec 要件 | 担当タスク | 状態 |
|---|---|---|
| `paneStore` 定義 (line 313-331) | Task 2 | ✓ |
| プリセット 5 種 (line 299-307) | Task 1 (定数) + Task 4 (描画) | ✓ |
| splitter ドラッグ (line 449-451) | Task 3 (SplitPane) + Task 4 (組合せ) | ✓ |
| 最小 320px ペイン幅 (line 450) | `clampRatio 0.1-0.9` で間接的に保証 (Task 1) | ✓ |
| 比率 persist (line 451) | Task 2 (zustand persist) | ✓ |
| `⊟▾` レイアウト切替メニュー (line 296) | Task 6 + Task 7 | ✓ |
| 重複ガード ⛔ グレーアウト (line 336-337) | Task 10 | ✓ |
| 右クリック「別のペインで開く」(line 338) | Task 10 (RowActionsMenu に追加) | ✓ |
| Sessions タブ以外で `single` 一時退避 (line 343) | Task 9 (suspendForSingle/resume) | ✓ |
| ペイン数縮小時 focus 残し (line 311) | Task 1 (dropExtraPanes) + Task 2 (setLayout) | ✓ |
| E2E `pane-split.spec.ts` (line 535) | Task 12 | ✓ |
| ブランチ `feature/web-pc-phase-3` (line 507) | 着手前に作成済 | ✓ |

### Out of scope (確認)

- ⌘\ / ⌘1-9 / ⌘[ / ⌘] / ⌘T / ⌘W 等: Phase 4 (line 418-432)
- Command Palette ⌘K: Phase 4
- ターミナル内検索 ⌘F: Phase 4
- Sidebar 折りたたみ ⌘B: Phase 4
- Session 単位の「別ペインで開く」: 仕様は window 単位のみ (line 336-338 で session 全体には言及なし)
- 残り 6 言語: Phase 5

### Type consistency

- `LayoutMode` 型: paneLayout.ts (Task 1) で定義、pane.ts (Task 2) / MultiPaneArea (Task 4) / LayoutSelector (Task 6) で同じ import
- `PaneTarget` 型: pane.ts (Task 2) で定義・export、SessionsListPanel (Task 10) と sessionView.ts (Task 8) で参照
- `usePaneStore.assignPane(idx, target)`: Task 2 で定義、Task 8 / Task 10 / Task 4 で使用 — 引数 2 つで一貫
- `usePaneStore.setLayout(mode)`: Task 2 / Task 6 / Task 9 で一貫
- `usePaneStore.suspendForSingle()` / `resume()`: Task 2 / Task 9 で一貫 (引数なし)
- ratios 配列の長さ: Task 1 `SPLITTER_COUNT[mode]` に揃え、`setRatio(mode, splitterIdx, value)` で `splitterIdx < SPLITTER_COUNT[mode]` をチェック

### Placeholder scan

- なし: 全 Step に実コード + 実コマンド + Expected を記載済

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-11-pc-web-phase-3-multi-pane.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — タスクごとに fresh subagent を投入し、spec compliance + code quality の 2 段レビューを挟みつつ進める (Phase 2 までと同じスタイル)
2. **Inline Execution** — 同セッション内で executing-plans を使い、チェックポイントごとにレビュー

Which approach?
