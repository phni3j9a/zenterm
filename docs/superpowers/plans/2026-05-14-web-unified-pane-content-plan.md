# Web タブ切替でのペイン保持 & ファイルのペイン内表示 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC Web の `/web/sessions` ↔ `/web/files` ↔ `/web/settings` タブ切替でペイン構成が潰れる問題を直し、サイドバーで選んだファイルを「セッションを開くのと同じ感覚で」フォーカス中のペインに表示できるようにする。

**Architecture:** `PaneTarget` を `{kind: 'terminal'|'file', ...}` の判別共用体に拡張する。`MultiPaneArea` の slot レンダリングが kind で `TerminalPane` と新規 `FilePaneViewer` を切り替える。`FilePaneViewer` は singleton 化されていた `useFilesPreviewStore` に依存せず、各ペインがローカル state でファイル取得・編集状態を持つ(複数ペインで独立して動作するため)。URL は path がサイドバーのタブ/フォルダのみ、hash がペイン全状態の単一の真実源、という役割分担に整理する。

**Tech Stack:** React 19 / Vite / TypeScript / Zustand (persist) / react-router v7 / vitest / Playwright (Docker 隔離 e2e)

**前提:**
- 作業ディレクトリは `packages/web/`(注記がない限り)
- ユニットテスト: `npx vitest run <パス>`
- E2E: 必ず `scripts/e2e-docker.sh tests/e2e/web/<spec>.spec.ts`(ホスト直接実行は禁止)
- 設計スペック: `docs/superpowers/specs/2026-05-14-web-unified-pane-content-design.md`

**ファイル構造(全体マップ):**

```
packages/web/src/
├── stores/
│   ├── pane.ts                              [改変: PaneTarget union, v3 migrate, suspend削除]
│   └── __tests__/pane.test.ts               [改変]
├── lib/
│   ├── paneStateFragment.ts                 [改変: kind対応 encode/decode]
│   ├── __tests__/paneStateFragment.test.ts  [新規 or 既存改変]
│   └── urlSync.ts                           [改変: legacy normalize only]
├── components/
│   ├── AuthenticatedShell.tsx               [改変: suspend削除, 同期方針見直し, overlay削除]
│   ├── SessionsListPanel.tsx                [改変: occupy判定の kind 絞り込み]
│   ├── layout/MultiPaneArea.tsx             [改変: kind分岐, isVisible削除]
│   └── files/
│       ├── FilePaneViewer.tsx               [新規: ペインローカル state でファイル表示]
│       ├── FilesSidebarPanel.tsx            [改変: click→openInFocusedPane]
│       ├── FilesViewerHeader.tsx            [改変: props駆動, onClose追加]
│       ├── FilesTextViewer.tsx              [改変: props駆動]
│       ├── FilesViewerPane.tsx              [削除]
│       ├── FilesViewerEmpty.tsx             [削除(吸収)]
│       └── __tests__/
│           ├── FilePaneViewer.test.tsx      [新規]
│           ├── FilesViewerPane.*.test.tsx   [削除]
│           ├── FilesViewerEmpty.test.tsx    [削除]
│           └── FilesViewerHeader.test.tsx   [改変]
tests/e2e/web/
├── file-in-pane.spec.ts                     [新規]
├── pane-preserve-across-tabs.spec.ts        [新規]
└── file-pane-url-restore.spec.ts            [新規]
```

---

## Task 1: PaneTarget を判別共用体に拡張(ストア型のみ)

**Files:**
- Modify: `packages/web/src/stores/pane.ts`
- Test: `packages/web/src/stores/__tests__/pane.test.ts`

このタスクではストアの型と最小限のヘルパだけ変更し、`isOccupied` と suspend/resume はそのままにする(次タスクで触る)。コンパイルを壊さないため、既存呼び出し側に kind='terminal' を付与するブリッジを書く必要があるかは Task 4 で対応。

- [ ] **Step 1: 既存テストの確認**

Run: `npx vitest run src/stores/__tests__/pane.test.ts`
Expected: 全テスト PASS(現状動作の baseline)

- [ ] **Step 2: 新しい型を反映する失敗テストを追加**

`packages/web/src/stores/__tests__/pane.test.ts` の末尾に追記:

```ts
describe('PaneTarget kind discrimination', () => {
  it('terminal ターゲットを assign できる', () => {
    const s = usePaneStore.getState();
    s.assignPane(0, { kind: 'terminal', sessionId: 'demo', windowIndex: 0 });
    expect(usePaneStore.getState().panes[0]).toEqual({
      kind: 'terminal',
      sessionId: 'demo',
      windowIndex: 0,
    });
  });

  it('file ターゲットを assign できる', () => {
    const s = usePaneStore.getState();
    s.assignPane(0, { kind: 'file', path: '/tmp/a.txt' });
    expect(usePaneStore.getState().panes[0]).toEqual({
      kind: 'file',
      path: '/tmp/a.txt',
    });
  });
});
```

- [ ] **Step 3: 失敗確認**

Run: `npx vitest run src/stores/__tests__/pane.test.ts -t 'kind discrimination'`
Expected: 型エラー or assertion 失敗

- [ ] **Step 4: `pane.ts` の `PaneTarget` を共用体化**

`packages/web/src/stores/pane.ts` の `export interface PaneTarget {...}` を以下に置換:

```ts
export type PaneTarget =
  | { kind: 'terminal'; sessionId: string; windowIndex: number }
  | { kind: 'file'; path: string };
```

- [ ] **Step 5: 既存の `isOccupied` 比較を kind 対応に更新**

同ファイルの `isOccupied` を以下に書き換え(file 同士は常に非衝突、terminal 同士はこれまで通り):

```ts
isOccupied: (target, excludeIdx) => {
  if (target.kind !== 'terminal') return false;
  const { panes } = get();
  return panes.some(
    (p, i) =>
      p !== null &&
      i !== excludeIdx &&
      p.kind === 'terminal' &&
      p.sessionId === target.sessionId &&
      p.windowIndex === target.windowIndex,
  );
},
```

- [ ] **Step 6: 既存テストが落ちる箇所を kind 付与で修正**

`pane.test.ts` 内で `{ sessionId: ..., windowIndex: ... }` リテラルになっている箇所をすべて `{ kind: 'terminal', sessionId: ..., windowIndex: ... }` に置換。`isOccupied` の file 用テストも追加:

```ts
it('isOccupied は file kind に対しては常に false', () => {
  const s = usePaneStore.getState();
  s.setLayout('cols-2');
  s.assignPane(0, { kind: 'file', path: '/a' });
  expect(s.isOccupied({ kind: 'file', path: '/a' })).toBe(false);
});
```

- [ ] **Step 7: テスト全パス**

Run: `npx vitest run src/stores/__tests__/pane.test.ts`
Expected: 全 PASS

- [ ] **Step 8: 型チェック(後続タスクで他の呼び出し側を直すまで失敗は許容するが範囲を確認)**

Run: `npx tsc -b --noEmit 2>&1 | head -60`
Expected: `PaneTarget` の構造を直書きしている箇所(MultiPaneArea / SessionsListPanel / paneStateFragment / urlSync 同期処理 / WindowRow など)でエラーが列挙される。これらは Task 3〜10 で順に潰す。

- [ ] **Step 9: Commit**

```bash
cd packages/web && git add src/stores/pane.ts src/stores/__tests__/pane.test.ts
git commit -m "refactor(web): PaneTarget を kind ベースの判別共用体に拡張"
```

---

## Task 2: ペインストアの persist v2→v3 マイグレーションと suspend/resume 撤去

**Files:**
- Modify: `packages/web/src/stores/pane.ts`
- Test: `packages/web/src/stores/__tests__/pane.test.ts`

- [ ] **Step 1: マイグレーションの失敗テストを追加**

`pane.test.ts` 末尾に追記:

```ts
describe('persist migration v2 -> v3', () => {
  it('v2 panes に kind: terminal を補完し savedLayout を破棄する', () => {
    const v2: unknown = {
      layout: 'cols-2',
      panes: [
        { sessionId: 'demo', windowIndex: 0 },
        null,
      ],
      focusedIndex: 0,
      savedLayout: 'single',
    };
    // 直接 migrate 関数を import するため pane.ts から export を追加する必要あり
    const migrated = migratePaneStoreV2ToV3(v2);
    expect(migrated.panes[0]).toEqual({
      kind: 'terminal',
      sessionId: 'demo',
      windowIndex: 0,
    });
    expect(migrated.panes[1]).toBeNull();
    expect('savedLayout' in migrated).toBe(false);
  });
});
```

ファイル冒頭の import に `migratePaneStoreV2ToV3` を追加。

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/stores/__tests__/pane.test.ts -t 'migration'`
Expected: import 解決失敗で FAIL

- [ ] **Step 3: `pane.ts` から migrate 関数を export し suspend/resume 撤去**

`pane.ts` を以下のように改修:

- `PaneState` インターフェイスから `savedLayout`, `suspendForSingle`, `resume` を削除
- 実装の `savedLayout` 初期値、`suspendForSingle`, `resume` を削除
- `partialize` から `savedLayout` を削除
- `migrate` 関数を以下に置換し、トップレベルから export:

```ts
interface PersistedV3 {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
  focusedIndex: number;
}

export function migratePaneStoreV2ToV3(persisted: unknown): PersistedV3 {
  const s = (persisted ?? {}) as {
    layout?: unknown;
    panes?: unknown;
    focusedIndex?: unknown;
  };
  const layout = isLayoutMode(s.layout) ? s.layout : 'single';
  const focusedIndex = typeof s.focusedIndex === 'number' ? s.focusedIndex : 0;
  const rawPanes = Array.isArray(s.panes) ? s.panes : [null];
  const panes: (PaneTarget | null)[] = rawPanes.map((p) => {
    if (p === null || typeof p !== 'object') return null;
    const cand = p as { kind?: unknown; sessionId?: unknown; windowIndex?: unknown; path?: unknown };
    if (cand.kind === 'file' && typeof cand.path === 'string') {
      return { kind: 'file', path: cand.path };
    }
    if (cand.kind === 'terminal' || cand.kind === undefined) {
      if (typeof cand.sessionId === 'string' && typeof cand.windowIndex === 'number') {
        return { kind: 'terminal', sessionId: cand.sessionId, windowIndex: cand.windowIndex };
      }
    }
    return null;
  });
  return { layout, panes, focusedIndex };
}
```

`persist` の `version` を `2` から `3` に上げ、`migrate` プロパティを `migrate: (persisted) => migratePaneStoreV2ToV3(persisted)` に差し替え。

- [ ] **Step 4: 既存 suspend/resume テストを削除**

`pane.test.ts` 内の `describe('suspendForSingle')` ブロックを丸ごと削除。

- [ ] **Step 5: テスト全パス**

Run: `npx vitest run src/stores/__tests__/pane.test.ts`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add src/stores/pane.ts src/stores/__tests__/pane.test.ts
git commit -m "refactor(web): pane persist v3 へ移行し suspend/resume を撤去"
```

---

## Task 3: `paneStateFragment` を kind 対応にし後方互換を保つ

**Files:**
- Modify: `packages/web/src/lib/paneStateFragment.ts`
- Create or Modify: `packages/web/src/lib/__tests__/paneStateFragment.test.ts`

エンコード形式:
- terminal: `t:<encodeURIComponent(sessionId)>.<windowIndex>`
- file: `f:<encodeURIComponent(path)>`
- 空: `_`
- 旧形式(prefix なしの `<sid>.<idx>`)は decode 時に terminal 扱いで受理(後方互換)

- [ ] **Step 1: テスト雛形を確認**

Run: `ls src/lib/__tests__/paneStateFragment.test.ts 2>/dev/null || echo "(missing)"`
無ければ作る。

- [ ] **Step 2: 失敗テスト追加**

`packages/web/src/lib/__tests__/paneStateFragment.test.ts` に以下を含む(既存があれば追記):

```ts
import { describe, it, expect } from 'vitest';
import { encode, decode } from '@/lib/paneStateFragment';

describe('paneStateFragment v3 (kind aware)', () => {
  it('terminal/file/null 混在を round-trip する', () => {
    const state = {
      layout: 'cols-2' as const,
      panes: [
        { kind: 'terminal' as const, sessionId: 'sess A', windowIndex: 3 },
        { kind: 'file' as const, path: '/tmp/foo bar.txt' },
      ],
    };
    const out = decode('#' + encode(state));
    expect(out).toEqual(state);
  });

  it('legacy ハッシュ(prefix なし)を terminal 補完で decode できる', () => {
    // 旧フォーマット: <encodeURIComponent(sid)>.<idx>
    const legacy = `#l=cols-2&p=demo.0,_`;
    const out = decode(legacy);
    expect(out).toEqual({
      layout: 'cols-2',
      panes: [
        { kind: 'terminal', sessionId: 'demo', windowIndex: 0 },
        null,
      ],
    });
  });

  it('file パスに `,` と `:` が含まれてもエンコード/デコードできる', () => {
    const state = {
      layout: 'single' as const,
      panes: [{ kind: 'file' as const, path: '/a,b:c.txt' }],
    };
    const out = decode('#' + encode(state));
    expect(out).toEqual(state);
  });
});
```

- [ ] **Step 3: 失敗確認**

Run: `npx vitest run src/lib/__tests__/paneStateFragment.test.ts`
Expected: FAIL(現状 encode は kind 非対応)

- [ ] **Step 4: `paneStateFragment.ts` を書き換え**

`packages/web/src/lib/paneStateFragment.ts` の `PaneTarget` 型 import を `@/stores/pane` から行う(自前定義を削除し DRY 化)。実装は以下:

```ts
import { LAYOUT_MODES, SLOT_COUNT, type LayoutMode } from './paneLayout';
import type { PaneTarget } from '@/stores/pane';

export interface PaneFragmentState {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];
}

const EMPTY_SLOT = '_';

function safeDecode(s: string): string | null {
  try { return decodeURIComponent(s); } catch { return null; }
}

function encodePane(p: PaneTarget | null): string {
  if (p === null) return EMPTY_SLOT;
  if (p.kind === 'terminal') {
    return `t:${encodeURIComponent(p.sessionId)}.${p.windowIndex}`;
  }
  return `f:${encodeURIComponent(p.path)}`;
}

function decodePane(slot: string): PaneTarget | null | 'invalid' {
  if (slot === EMPTY_SLOT) return null;
  if (slot.startsWith('t:')) {
    const body = slot.slice(2);
    const dotIdx = body.lastIndexOf('.');
    if (dotIdx < 0) return 'invalid';
    const sidPart = body.slice(0, dotIdx);
    const idxPart = body.slice(dotIdx + 1);
    const idx = Number.parseInt(idxPart, 10);
    if (!Number.isFinite(idx) || idx < 0 || String(idx) !== idxPart) return 'invalid';
    const sid = safeDecode(sidPart);
    if (sid === null) return 'invalid';
    return { kind: 'terminal', sessionId: sid, windowIndex: idx };
  }
  if (slot.startsWith('f:')) {
    const path = safeDecode(slot.slice(2));
    if (path === null) return 'invalid';
    return { kind: 'file', path };
  }
  // Legacy: <sid>.<idx>
  const dotIdx = slot.lastIndexOf('.');
  if (dotIdx < 0) return 'invalid';
  const sidPart = slot.slice(0, dotIdx);
  const idxPart = slot.slice(dotIdx + 1);
  const idx = Number.parseInt(idxPart, 10);
  if (!Number.isFinite(idx) || idx < 0 || String(idx) !== idxPart) return 'invalid';
  const sid = safeDecode(sidPart);
  if (sid === null) return 'invalid';
  return { kind: 'terminal', sessionId: sid, windowIndex: idx };
}

export function encode(state: PaneFragmentState): string {
  return `l=${state.layout}&p=${state.panes.map(encodePane).join(',')}`;
}

export function decode(hash: string): PaneFragmentState | null {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const l = params.get('l');
  const p = params.get('p');
  if (!l || !p) return null;
  if (!(LAYOUT_MODES as readonly string[]).includes(l)) return null;
  const layout = l as LayoutMode;
  const expectedCount = SLOT_COUNT[layout];
  const slots = p.split(',');
  if (slots.length !== expectedCount) return null;
  const panes: (PaneTarget | null)[] = [];
  for (const slot of slots) {
    const parsed = decodePane(slot);
    if (parsed === 'invalid') return null;
    panes.push(parsed);
  }
  return { layout, panes };
}
```

注意: パスに `,` を含めると split 時に壊れる。`encodeURIComponent` でエンコードされるので `%2C` になり、`,` セパレータと衝突しない(`encodeURIComponent(',')` は `%2C`)。テストでこれを検証済み。

ファイル内の元の `export interface PaneTarget {...}` 宣言は削除する(ストアの定義に統一)。

- [ ] **Step 5: テストパス**

Run: `npx vitest run src/lib/__tests__/paneStateFragment.test.ts`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/paneStateFragment.ts src/lib/__tests__/paneStateFragment.test.ts
git commit -m "feat(web): paneStateFragment を kind 対応にし legacy 形式を後方互換 decode"
```

---

## Task 4: `MultiPaneArea` を kind 分岐に対応(まず terminal だけ動作維持)

**Files:**
- Modify: `packages/web/src/components/layout/MultiPaneArea.tsx`

`isVisible` プロップは Task 7 まで残しておく(`AuthenticatedShell` 側で `isFilesRoute` 時に false を渡しているため)。本タスクでは terminal kind を正しく処理するだけ。file kind は `FilePaneViewer` 実装後の Task 6 で接続。

- [ ] **Step 1: 既存テストの確認**

Run: `ls src/components/layout/__tests__/`
あれば baseline 確認: `npx vitest run src/components/layout/__tests__/`

- [ ] **Step 2: slot の kind 分岐実装**

`MultiPaneArea.tsx` の `slot(idx)` を以下に書き換え:

```tsx
const slot = (idx: number): ReactNode => {
  const pane = panes[idx];
  const onFocus = () => setFocusedIndex(idx);
  const wrap = (child: ReactNode) => (
    <div
      key={`pane-${idx}`}
      onClick={onFocus}
      style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
    >
      {child}
    </div>
  );

  if (pane && pane.kind === 'file') {
    // Task 6 で実装: <FilePaneViewer .../>
    // 暫定で空表示にしておく(import 増やしたくないため)
    return wrap(<div style={{ color: '#888', padding: 16 }}>file: {pane.path}</div>);
  }

  // terminal or null (空ペイン) は既存の TerminalPane に流す
  const session = Array.isArray(sessions) && pane && pane.kind === 'terminal'
    ? sessions.find((s) => s.displayName === pane.sessionId)
    : undefined;
  const sessionCwd = session?.cwd;
  return wrap(
    <TerminalPane
      gatewayUrl={gatewayUrl}
      token={token}
      sessionId={pane && pane.kind === 'terminal' ? pane.sessionId : null}
      windowIndex={pane && pane.kind === 'terminal' ? pane.windowIndex : null}
      paneIndex={idx}
      isFocused={idx === focusedIndex}
      isVisible={isVisible}
      onSearch={onSearch}
      onNewPane={onNewPane}
      canCreateNewPane={canCreateNewPane}
      sessionCwd={sessionCwd}
      onDropFiles={onDropFiles}
      uploadProgress={uploadProgress}
    />
  );
};
```

- [ ] **Step 3: 既存ユニットテストを実行(retest)**

Run: `npx vitest run src/components/layout/__tests__/`
Expected: 既存テストは PASS(panes が null や terminal kind の挙動を確認しているはず)

- [ ] **Step 4: 型チェック(部分)**

Run: `npx tsc -b --noEmit 2>&1 | grep -E "MultiPaneArea|paneStateFragment|stores/pane" | head -20`
Expected: MultiPaneArea のエラーは解消。AuthenticatedShell など別箇所のエラーは残っていてよい。

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MultiPaneArea.tsx
git commit -m "refactor(web): MultiPaneArea を kind 分岐対応(file は次タスクで実装)"
```

---

## Task 5: `FilesViewerHeader` と `FilesTextViewer` を props 駆動に変換

**Files:**
- Modify: `packages/web/src/components/files/FilesViewerHeader.tsx`
- Modify: `packages/web/src/components/files/FilesTextViewer.tsx`
- Modify: `packages/web/src/components/files/__tests__/FilesViewerHeader.test.tsx`
- Modify: `packages/web/src/components/files/__tests__/FilesViewerHeader.dirty.test.tsx`

両コンポーネントから `useFilesPreviewStore` 依存を撤廃し、必要な値を props で受け取れるようにする(`FilePaneViewer` で per-pane state を渡せるように)。

- [ ] **Step 1: `FilesViewerHeader` を props 化**

`FilesViewerHeader.tsx` 全体を以下に置換:

```tsx
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import type { PreviewKind } from '@/lib/filesIcon';

interface Props {
  name: string;
  kind: PreviewKind;
  isEditing: boolean;
  isDirty: boolean;
  saving: boolean;
  showMarkdownRendered: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onToggleMarkdown: () => void;
  onClose: () => void;
}

export function FilesViewerHeader({
  name, kind, isEditing, isDirty, saving, showMarkdownRendered,
  onEdit, onSave, onCancel, onDownload, onToggleMarkdown, onClose,
}: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

  const btn = {
    background: 'none' as const,
    border: `1px solid ${tokens.colors.borderSubtle}`,
    color: tokens.colors.textPrimary,
    borderRadius: 4,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    cursor: 'pointer' as const,
    fontSize: tokens.typography.bodyMedium.fontSize,
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
      }}
    >
      <span
        style={{
          flex: 1,
          fontWeight: 600,
          color: tokens.colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={name}
      >
        {name}
      </span>
      {kind === 'markdown' && (
        <button type="button" onClick={onToggleMarkdown} style={btn}>
          {showMarkdownRendered ? t('files.source') : t('files.rendered')}
        </button>
      )}
      {(kind === 'text' || kind === 'markdown') && !isEditing && (
        <button type="button" onClick={onEdit} style={btn}>{t('files.edit')}</button>
      )}
      {isEditing && (
        <>
          <button type="button" onClick={onSave} style={btn} disabled={saving || !isDirty}>{t('files.save')}</button>
          <button type="button" onClick={onCancel} style={btn}>{t('files.cancel')}</button>
        </>
      )}
      <button type="button" onClick={onDownload} style={btn}>{t('files.download')}</button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('files.closePane')}
        style={btn}
      >
        ×
      </button>
    </header>
  );
}
```

- [ ] **Step 2: 翻訳キー追加**

`packages/web/src/i18n/locales/<各言語>.json` に `files.closePane` を追加(全 8 言語):

```json
"files.closePane": "閉じる" // ja
```

英語は `"Close"`、他言語は順次。全 locale を更新する。最低限 ja/en だけ正しい訳、他は en コピーで OK だが、必ず 8 言語すべてのファイルに同じキーを追加すること(欠落するとランタイム警告が出る)。

- [ ] **Step 3: `FilesTextViewer` を props 化**

`FilesTextViewer.tsx` 全体を確認のうえ、`useFilesPreviewStore` 呼び出しを props 受け取りに置換:

```tsx
import { useTheme } from '@/theme';

interface Props {
  textContent: string | null;
  textLines: number;
  textTruncated: boolean;
}

export function FilesTextViewer({ textContent, textLines, textTruncated }: Props) {
  // (元の textContent/textLines/textTruncated 取得行を削除し、本体はそのまま)
  // ...
}
```

(既存実装の `useFilesPreviewStore` 行 3 つを削除し、残りはそのまま温存)

- [ ] **Step 4: 既存呼び出し側を一時的に修正**

`FilesViewerPane.tsx`(Task 9 で削除予定だが現状動作維持のため)を以下のように `FilesTextViewer` 呼び出し箇所だけ更新:

```tsx
{selectedKind === 'text' && !isEditing && (
  <FilesTextViewer
    textContent={textContent}
    textLines={useFilesPreviewStore.getState().textLines}
    textTruncated={useFilesPreviewStore.getState().textTruncated}
  />
)}
{selectedKind === 'markdown' && !isEditing && (
  showMarkdownRendered
    ? <FilesMarkdownViewer source={textContent ?? ''} />
    : <FilesTextViewer
        textContent={textContent}
        textLines={useFilesPreviewStore.getState().textLines}
        textTruncated={useFilesPreviewStore.getState().textTruncated}
      />
)}
```

`FilesViewerHeader` の呼び出しも:

```tsx
<FilesViewerHeader
  name={selectedName ?? ''}
  kind={selectedKind}
  isEditing={isEditing}
  isDirty={useFilesPreviewStore((s) => s.isDirty)}
  saving={useFilesPreviewStore((s) => s.saving)}
  showMarkdownRendered={showMarkdownRendered}
  onEdit={() => useFilesPreviewStore.getState().startEditing()}
  onSave={handleSave}
  onCancel={() => useFilesPreviewStore.getState().cancelEditing()}
  onDownload={handleDownload}
  onToggleMarkdown={() => useFilesPreviewStore.getState().toggleMarkdownRendered()}
  onClose={() => useFilesPreviewStore.getState().clear()}
/>
```

(これらの fix は FilesViewerPane が削除される Task 9 でまとめて吹き飛ぶが、テストを通すため一時的に置く)

- [ ] **Step 5: ヘッダーのテストを props 駆動に書き換え**

`FilesViewerHeader.test.tsx` と `FilesViewerHeader.dirty.test.tsx` のセットアップを「`useFilesPreviewStore.setState(...)` で値を仕込む」から「`render(<FilesViewerHeader ... />)` に props を直接渡す」に変更。`onClose` のテストも追加:

```tsx
it('× ボタンで onClose を呼ぶ', async () => {
  const onClose = vi.fn();
  render(
    <FilesViewerHeader
      name="a.txt" kind="text" isEditing={false} isDirty={false}
      saving={false} showMarkdownRendered={false}
      onEdit={() => {}} onSave={() => {}} onCancel={() => {}}
      onDownload={() => {}} onToggleMarkdown={() => {}} onClose={onClose}
    />
  );
  await userEvent.click(screen.getByRole('button', { name: /閉じる|close/i }));
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 6: テスト全パス**

Run: `npx vitest run src/components/files/__tests__/FilesViewerHeader.test.tsx src/components/files/__tests__/FilesViewerHeader.dirty.test.tsx src/components/files/__tests__/FilesTextViewer.test.tsx src/components/files/__tests__/FilesViewerPane.test.tsx`
Expected: 全 PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/files/FilesViewerHeader.tsx src/components/files/FilesTextViewer.tsx src/components/files/FilesViewerPane.tsx src/components/files/__tests__/FilesViewerHeader.test.tsx src/components/files/__tests__/FilesViewerHeader.dirty.test.tsx src/i18n/
git commit -m "refactor(web): FilesViewerHeader/FilesTextViewer を props 駆動に変換し × ボタンを追加"
```

---

## Task 6: `FilePaneViewer` を新規実装

**Files:**
- Create: `packages/web/src/components/files/FilePaneViewer.tsx`
- Create: `packages/web/src/components/files/__tests__/FilePaneViewer.test.tsx`

各ペインがローカル state でファイル取得・編集・保存を独立に行う。`useFilesPreviewStore` には触らない。

- [ ] **Step 1: 失敗テスト追加**

`packages/web/src/components/files/__tests__/FilePaneViewer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilePaneViewer } from '../FilePaneViewer';
import type { FilesApiClient } from '../filesApi';

function makeClient(overrides: Partial<FilesApiClient> = {}): FilesApiClient {
  return {
    listFiles: vi.fn(),
    getFileContent: vi.fn(async () => ({ content: 'hello', lines: 1, truncated: false })),
    writeFileContent: vi.fn(async () => {}),
    deleteFile: vi.fn(),
    renameFile: vi.fn(),
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    createDirectory: vi.fn(),
    uploadFile: vi.fn(),
    buildRawFileUrl: (p: string) => `/raw${p}`,
    ...overrides,
  } as FilesApiClient;
}

describe('FilePaneViewer', () => {
  it('テキストファイルを取得して表示する', async () => {
    const client = makeClient();
    render(<FilePaneViewer path="/tmp/a.txt" client={client} token="t" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/hello/)).toBeInTheDocument());
  });

  it('× ボタンで onClose を呼ぶ', async () => {
    const onClose = vi.fn();
    render(<FilePaneViewer path="/tmp/a.txt" client={makeClient()} token="t" onClose={onClose} />);
    await waitFor(() => screen.getByText(/hello/));
    await userEvent.click(screen.getByRole('button', { name: /閉じる|close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('API 取得エラー時にペイン内エラー表示を出すが close は呼ばない', async () => {
    const onClose = vi.fn();
    const client = makeClient({
      getFileContent: vi.fn(async () => { throw new Error('boom'); }),
    });
    render(<FilePaneViewer path="/tmp/a.txt" client={client} token="t" onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('path が変わると再取得する', async () => {
    const get = vi.fn(async (p: string) => ({ content: p, lines: 1, truncated: false }));
    const client = makeClient({ getFileContent: get });
    const { rerender } = render(
      <FilePaneViewer path="/a" client={client} token="t" onClose={() => {}} />
    );
    await waitFor(() => screen.getByText('/a'));
    rerender(<FilePaneViewer path="/b" client={client} token="t" onClose={() => {}} />);
    await waitFor(() => screen.getByText('/b'));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/components/files/__tests__/FilePaneViewer.test.tsx`
Expected: import 解決失敗で FAIL

- [ ] **Step 3: `FilePaneViewer.tsx` 実装**

`packages/web/src/components/files/FilePaneViewer.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme';
import { getPreviewKind, type PreviewKind } from '@/lib/filesIcon';
import { FilesViewerHeader } from './FilesViewerHeader';
import { FilesTextViewer } from './FilesTextViewer';
import { FilesImageViewer } from './FilesImageViewer';
import { FilesMarkdownViewer } from './FilesMarkdownViewer';
import { FilesEditor } from './FilesEditor';
import type { FilesApiClient } from './filesApi';

interface Props {
  path: string;
  client: FilesApiClient;
  token: string | null;
  onClose: () => void;
}

export function FilePaneViewer({ path, client, token, onClose }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const name = path.split('/').filter(Boolean).slice(-1)[0] ?? path;
  const kind: PreviewKind = getPreviewKind(name);

  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLines, setTextLines] = useState(0);
  const [textTruncated, setTextTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMarkdownRendered, setShowMarkdownRendered] = useState(true);

  const isDirty = isEditing && editContent !== (textContent ?? '');
  const fetchSeq = useRef(0);

  useEffect(() => {
    if (kind !== 'text' && kind !== 'markdown') return;
    const myId = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await client.getFileContent(path);
        if (myId !== fetchSeq.current) return;
        setTextContent(res.content);
        setTextLines(res.lines);
        setTextTruncated(res.truncated);
      } catch (err) {
        if (myId !== fetchSeq.current) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (myId === fetchSeq.current) setLoading(false);
      }
    })();
  }, [path, kind, client]);

  // path が変わったら編集状態をリセット
  useEffect(() => {
    setIsEditing(false);
    setEditContent('');
  }, [path]);

  const startEditing = () => {
    setEditContent(textContent ?? '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.writeFileContent(path, editContent);
      setTextContent(editContent);
      setIsEditing(false);
      useUiStore.getState().pushToast({ type: 'success', message: t('files.saved') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useUiStore.getState().pushToast({ type: 'error', message: `${t('files.saveFailed')}: ${msg}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(client.buildRawFileUrl(path), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useUiStore.getState().pushToast({ type: 'error', message: `${t('files.downloadFailed')}: ${msg}` });
    }
  };

  const containerStyle = {
    flex: 1,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    background: tokens.colors.bg,
    minWidth: 0,
    height: '100%',
  };

  if (error) {
    return (
      <div style={containerStyle}>
        <FilesViewerHeader
          name={name} kind={kind} isEditing={false} isDirty={false}
          saving={false} showMarkdownRendered={false}
          onEdit={() => {}} onSave={() => {}} onCancel={() => {}}
          onDownload={handleDownload} onToggleMarkdown={() => {}} onClose={onClose}
        />
        <div role="alert" style={{ padding: tokens.spacing.md, color: tokens.colors.error }}>
          {t('files.loadFailed')}: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <FilesViewerHeader
        name={name} kind={kind} isEditing={isEditing} isDirty={isDirty}
        saving={saving} showMarkdownRendered={showMarkdownRendered}
        onEdit={startEditing}
        onSave={handleSave}
        onCancel={cancelEditing}
        onDownload={handleDownload}
        onToggleMarkdown={() => setShowMarkdownRendered((v) => !v)}
        onClose={onClose}
      />
      {kind === 'unsupported' && (
        <div
          role="status"
          aria-label={t('files.cannotOpen')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: tokens.spacing.sm,
            color: tokens.colors.textMuted,
            padding: tokens.spacing.lg,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: tokens.typography.heading.fontSize }}>{t('files.cannotOpen')}</div>
          <div style={{ fontSize: tokens.typography.bodyMedium.fontSize }}>
            {t('files.cannotOpenDesc', { name })}
          </div>
        </div>
      )}
      {kind === 'image' && (
        <FilesImageViewer rawUrl={client.buildRawFileUrl(path)} token={token} name={name} />
      )}
      {(kind === 'text' || kind === 'markdown') && isEditing && (
        <FilesEditor
          filename={name}
          value={editContent}
          onChange={setEditContent}
          onSave={handleSave}
        />
      )}
      {kind === 'text' && !isEditing && (
        <FilesTextViewer textContent={textContent} textLines={textLines} textTruncated={textTruncated} />
      )}
      {kind === 'markdown' && !isEditing && (
        showMarkdownRendered
          ? <FilesMarkdownViewer source={textContent ?? ''} />
          : <FilesTextViewer textContent={textContent} textLines={textLines} textTruncated={textTruncated} />
      )}
    </div>
  );
}
```

注意:
- `basename` ヘルパが `@/lib/filesPath` に無いことを確認済み。インラインで `path.split('/').filter(Boolean).slice(-1)[0] ?? path` を使う。
- `files.cannotOpen` / `files.cannotOpenDesc` は既存の翻訳キー(`FilesViewerEmpty` の unsupported モードで使われていたもの)を再利用する。`files.closePane` のみ新規追加(Task 5 Step 2 で 8 言語に追加済)。

- [ ] **Step 4: テスト全パス**

Run: `npx vitest run src/components/files/__tests__/FilePaneViewer.test.tsx`
Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/files/FilePaneViewer.tsx src/components/files/__tests__/FilePaneViewer.test.tsx
git commit -m "feat(web): FilePaneViewer を追加(ペインごとに独立した state でファイル表示)"
```

---

## Task 7: `MultiPaneArea` の file kind 分岐を `FilePaneViewer` へ接続

**Files:**
- Modify: `packages/web/src/components/layout/MultiPaneArea.tsx`

- [ ] **Step 1: import 追加と暫定実装の差し替え**

`MultiPaneArea.tsx` 冒頭に追加:

```tsx
import { FilePaneViewer } from '@/components/files/FilePaneViewer';
import type { FilesApiClient } from '@/components/files/filesApi';
```

`MultiPaneAreaProps` に props を追加:

```ts
filesClient: FilesApiClient | null;
```

slot 分岐の file 部分を実装:

```tsx
if (pane && pane.kind === 'file') {
  if (!filesClient) return wrap(null);
  return wrap(
    <FilePaneViewer
      path={pane.path}
      client={filesClient}
      token={token}
      onClose={() => usePaneStore.getState().assignPane(idx, null)}
    />
  );
}
```

- [ ] **Step 2: `AuthenticatedShell` から `filesClient` を渡す**

`AuthenticatedShell.tsx` の `<MultiPaneArea ... />` 呼び出しに `filesClient={filesClient}` を追加。

- [ ] **Step 3: 既存テスト確認**

Run: `npx vitest run src/components/layout/__tests__/`
Expected: 全 PASS(file パスは新規テストが Task 6 でカバー済)

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/MultiPaneArea.tsx src/components/AuthenticatedShell.tsx
git commit -m "feat(web): MultiPaneArea の file kind を FilePaneViewer に接続"
```

---

## Task 8: `FilesSidebarPanel` のファイルクリックを `openInFocusedPane` に切り替え

**Files:**
- Modify: `packages/web/src/components/files/FilesSidebarPanel.tsx`
- Modify: `packages/web/src/components/files/__tests__/FilesSidebarPanel.test.tsx`

- [ ] **Step 1: 失敗テスト追加**

`FilesSidebarPanel.test.tsx` に追加:

```tsx
it('ファイル行クリックで usePaneStore.openInFocusedPane に file ターゲットを渡す', async () => {
  // setup: 既存のテストハーネスでファイル一覧をモック
  // ... (既存テストの setup を流用)
  // 期待: usePaneStore.getState().panes[focusedIndex] が
  // { kind: 'file', path: '<期待パス>' } になっている
});
```

(具体的なセットアップは既存 `FilesSidebarPanel.test.tsx` のパターンに合わせる。既存に「クリックで preview store が更新される」テストがあればそれを「pane store が更新される」に書き換える)

- [ ] **Step 2: `FilesSidebarPanel.tsx` の `handleOpen` を修正**

`useFilesPreviewStore` 依存を撤廃し `usePaneStore` を使う。`FilesSidebarPanel.tsx` の import に追加:

```ts
import { usePaneStore } from '@/stores/pane';
```

`handleOpen` を以下に置換:

```ts
const handleOpen = (entry: FileEntry) => {
  if (useFilesStore.getState().selectionMode) {
    useFilesStore.getState().toggleSelection(entry.name);
    return;
  }
  const isDir = entry.type === 'directory'
    || (entry.type === 'symlink' && entry.resolvedType === 'directory');
  if (isDir) {
    navigateTo(buildEntryPath(currentPath, entry.name));
    return;
  }
  const path = buildEntryPath(currentPath, entry.name);
  usePaneStore.getState().openInFocusedPane({ kind: 'file', path });
};
```

`useFilesPreviewStore` の import と「unsaved changes 確認」周りのコードは Task 11 のクリーンアップで全部削除する。本タスクでは触らない(`isDirty` チェックを残しておくと preview store が更新されないので機能しないが、現状動作に害はない)。

- [ ] **Step 3: テストパス**

Run: `npx vitest run src/components/files/__tests__/FilesSidebarPanel.test.tsx`
Expected: 全 PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/files/FilesSidebarPanel.tsx src/components/files/__tests__/FilesSidebarPanel.test.tsx
git commit -m "feat(web): サイドバーのファイルクリックでフォーカスペインに開くよう変更"
```

---

## Task 9: `AuthenticatedShell` から suspend/resume と FilesViewerPane オーバーレイを撤去

**Files:**
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/components/layout/MultiPaneArea.tsx`(`isVisible` プロップ撤去)

- [ ] **Step 1: 該当 useEffect と overlay の削除**

`AuthenticatedShell.tsx` から以下を削除:

1. **L81-88** の suspend/resume useEffect 一式
2. **L90-117** の `parseSessionRoute` を起点に焦点ペインを上書きする useEffect 一式(`lastSyncedPath.current` 含む)
3. **L450-471** の `isFilesRoute` 分岐:
   - `MultiPaneArea` 呼び出しから `isVisible={!isFilesRoute}` を削除
   - `{isFilesRoute && (...)}` ブロック全体(`FilesViewerPane` 描画)を削除
4. `import { FilesViewerPane } from '@/components/files/FilesViewerPane';` を削除
5. `import { parseSessionRoute, buildSessionPath } from '@/lib/urlSync';` のうち `buildSessionPath` を削除(必要なければ `parseSessionRoute` も Task 10 まで残す)
6. `const isFilesRoute = ...;` および同変数の参照を削除(他に使われていないことを確認)

- [ ] **Step 2: hash → store 同期を新フォーマットで使えるように軽微修正**

L121-132 の hash decode 処理:

```tsx
useEffect(() => {
  if (lastSyncedHash.current === location.hash) return;
  lastSyncedHash.current = location.hash;
  if (!location.hash) return;
  const parsed = decodeFragment(location.hash);
  if (!parsed) return;
  const store = usePaneStore.getState();
  if (store.layout !== parsed.layout) store.setLayout(parsed.layout);
  for (let i = 0; i < parsed.panes.length; i++) {
    store.assignPane(i, parsed.panes[i]);
  }
}, [location.hash]);
```

これは現状のままで OK(parsed.panes は新 PaneTarget union 型なので Task 3 完了後に型整合する)。

- [ ] **Step 3: store → URL 同期を hash のみに簡略化**

L137-155 の useEffect を以下に置換:

```tsx
const layout = usePaneStore((s) => s.layout);
const allPanes = usePaneStore((s) => s.panes);
useEffect(() => {
  const isSinglePaneState =
    layout === 'single' && allPanes.length === 1 && allPanes[0] !== null;
  const desiredHash = isSinglePaneState ? '' : `#${encodeFragment({ layout, panes: allPanes })}`;
  const desired = location.pathname + desiredHash;
  const current = location.pathname + location.hash;
  if (current === desired) return;
  lastSyncedHash.current = desiredHash;
  navigateFnRef.current(desired, { replace: true });
}, [layout, allPanes, location.pathname]);
```

`focusedPane` の参照は撤去(path 部分にもう使わないため)。`isSessionsRoute` ガードも撤去(すべてのタブで hash を更新する)。

- [ ] **Step 4: `MultiPaneArea` の `isVisible` プロップ撤去**

`MultiPaneAreaProps` から `isVisible: boolean;` を削除。`TerminalPane` への `isVisible` 受け渡しは固定値 `true` に置換(`TerminalPane` 側の prop は必須なため):

```tsx
isVisible={true}
```

`AuthenticatedShell` から `isVisible` を渡している箇所は Step 1 で削除済み。

- [ ] **Step 5: ユニットテスト**

Run: `npx vitest run src/components/__tests__/AuthenticatedShell.test.tsx 2>/dev/null; npx vitest run src/`
Expected: 全 PASS。落ちた場合は MultiPaneArea のテストが `isVisible` プロップを参照していないか確認し、参照していれば外す。

- [ ] **Step 6: Commit**

```bash
git add src/components/AuthenticatedShell.tsx src/components/layout/MultiPaneArea.tsx
git commit -m "fix(web): タブ切替でペインが潰れる原因の suspend/resume と FilesViewerPane overlay を撤去"
```

---

## Task 10: 旧 URL `/web/sessions/:id/window/:idx` の正規化のみ残す

**Files:**
- Modify: `packages/web/src/components/AuthenticatedShell.tsx`
- Modify: `packages/web/src/lib/urlSync.ts`(必要なら)

- [ ] **Step 1: 旧 URL 検出と一度きりの吸収**

`AuthenticatedShell.tsx` に新たな useEffect を追加(mount 時に一度だけ走る形でよい):

```tsx
const didLegacyMigrationRef = useRef(false);
useEffect(() => {
  if (didLegacyMigrationRef.current) return;
  didLegacyMigrationRef.current = true;
  const parsed = parseSessionRoute(location.pathname);
  if (!parsed) return;
  // 旧 URL: 焦点ペインに terminal kind を流し込み、path を /web/sessions に正規化
  usePaneStore.getState().openInFocusedPane({
    kind: 'terminal',
    sessionId: parsed.sessionId,
    windowIndex: parsed.windowIndex,
  });
  navigateFnRef.current('/web/sessions' + location.hash, { replace: true });
}, []);
```

`parseSessionRoute` の import を残す(`buildSessionPath` は削除)。

- [ ] **Step 2: テスト追加(任意)**

旧 URL から起動した場合の振る舞いはユニットでも書けるが、Task 13 の E2E でカバーする方が分かりやすい。本ステップではユニット追加なし。

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthenticatedShell.tsx
git commit -m "feat(web): 旧 /web/sessions/:id/window/:idx URL を一度だけ吸収して正規化"
```

---

## Task 11: 残った `useFilesPreviewStore` 依存と `FilesViewerPane` / `FilesViewerEmpty` を削除

**Files:**
- Delete: `packages/web/src/components/files/FilesViewerPane.tsx`
- Delete: `packages/web/src/components/files/FilesViewerEmpty.tsx`
- Delete: `packages/web/src/components/files/__tests__/FilesViewerPane.test.tsx`
- Delete: `packages/web/src/components/files/__tests__/FilesViewerPane.download.test.tsx`
- Delete: `packages/web/src/components/files/__tests__/FilesViewerPane.unsupported.test.tsx`
- Delete: `packages/web/src/components/files/__tests__/FilesViewerEmpty.test.tsx`
- Modify: `packages/web/src/components/files/FilesSidebarPanel.tsx`
- Modify: `packages/web/src/stores/filesPreview.ts` (削除 or 縮小)
- Delete (if obsolete): `packages/web/src/stores/__tests__/filesPreview.test.ts`

`useFilesPreviewStore` の残存利用:
- `FilesSidebarPanel.doDelete`: 削除したファイルが preview に開かれているかの判定 → 削除したファイルを表示しているペインがあれば null 化する処理に置換
- `FilesSidebarPanel.doRename`: 同上 → リネームしたファイルを表示しているペインがあれば path を更新
- `FilesSidebarPanel.doNewFile`: 新規ファイル作成 → 別アプローチへ(下記)
- `FilesSidebarPanel.handleOpen`: `isDirty` チェック → 撤去(per-pane で sidebar 側からは検知できない、UX 影響は前述スペック通り)

- [ ] **Step 1: `FilesSidebarPanel` の preview store 参照を撤去**

`FilesSidebarPanel.tsx` を編集:

```ts
// import を更新
import { usePaneStore, type PaneTarget } from '@/stores/pane';
// useFilesPreviewStore import を削除

// doDelete の中の preview store 連動を pane store に置換
const doDelete = async (entry: FileEntry) => {
  showConfirm({
    title: t('files.deleteConfirmTitle'),
    message: t('files.deleteConfirmMessage', { name: entry.name }),
    destructive: true,
    onConfirm: async () => {
      const targetPath = buildEntryPath(useFilesStore.getState().currentPath, entry.name);
      try {
        await client.deleteFile(targetPath);
        pushToast({ type: 'success', message: t('files.deleteSuccess') });
        const { panes } = usePaneStore.getState();
        panes.forEach((p, i) => {
          if (p && p.kind === 'file' && p.path === targetPath) {
            usePaneStore.getState().assignPane(i, null);
          }
        });
        await refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pushToast({ type: 'error', message: `${t('files.deleteFailed')}: ${msg}` });
      }
    },
  });
};

// doRename: 旧パスを開いているペインがあればパスを差し替え
const doRename = async (newName: string) => {
  if (!renameTarget) return;
  const oldPath = buildEntryPath(useFilesStore.getState().currentPath, renameTarget.name);
  const newPath = buildEntryPath(useFilesStore.getState().currentPath, newName);
  try {
    await client.renameFile(oldPath, newName);
    pushToast({ type: 'success', message: t('files.renameSuccess') });
    const { panes } = usePaneStore.getState();
    panes.forEach((p, i) => {
      if (p && p.kind === 'file' && p.path === oldPath) {
        usePaneStore.getState().assignPane(i, { kind: 'file', path: newPath });
      }
    });
    setRenameTarget(null);
    await refresh();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: `${t('files.renameFailed')}: ${msg}` });
  }
};

// doNewFile: 「新規ファイル」ダイアログでは空ファイルをサーバーに作って、その上で開く
const doNewFile = async (name: string) => {
  const path = buildEntryPath(useFilesStore.getState().currentPath, name);
  try {
    await client.writeFileContent(path, '');
    usePaneStore.getState().openInFocusedPane({ kind: 'file', path });
    setNewFileOpen(false);
    await refresh();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: `${t('files.mkdirFailed')}: ${msg}` });
  }
};
```

`handleOpen` 内の `isDirty` 分岐(L217-229)を削除し、`proceed()` 関数を解体して直接処理する形に整理(Task 8 で大枠は書いたのでマージするだけ)。

- [ ] **Step 2: `FilesViewerPane` 系と `FilesViewerEmpty` を削除**

```bash
git rm src/components/files/FilesViewerPane.tsx \
       src/components/files/FilesViewerEmpty.tsx \
       src/components/files/__tests__/FilesViewerPane.test.tsx \
       src/components/files/__tests__/FilesViewerPane.download.test.tsx \
       src/components/files/__tests__/FilesViewerPane.unsupported.test.tsx \
       src/components/files/__tests__/FilesViewerEmpty.test.tsx
```

- [ ] **Step 3: `useFilesPreviewStore` の利用を確認し撤去**

```bash
grep -rn "useFilesPreviewStore\|stores/filesPreview" src/ 2>/dev/null
```

呼び出し元が `__tests__` 含め 0 件になっていたら:

```bash
git rm src/stores/filesPreview.ts src/stores/__tests__/filesPreview.test.ts
```

残っている呼び出しがあれば追加で潰す。

- [ ] **Step 4: 型チェックとテスト**

Run: `npx tsc -b --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(web): FilesViewerPane / FilesViewerEmpty / filesPreview ストアを削除"
```

---

## Task 12: `SessionsListPanel` の occupy 判定を terminal kind 限定に修正

**Files:**
- Modify: `packages/web/src/components/SessionsListPanel.tsx`
- Modify: `packages/web/src/components/__tests__/SessionsListPanel.test.tsx`(あれば)

`SessionsListPanel.tsx:172-179` の `panes.findIndex` で `p.sessionId === target.sessionId` を見ているが、`PaneTarget` が共用体になったため file kind のペインに対して `sessionId` を参照すると型エラー(かつ意味的にも非該当)。kind フィルタを追加。

- [ ] **Step 1: 該当箇所を修正**

`SessionsListPanel.tsx` の L172-179 付近を以下に修正:

```tsx
const occupyingIdx = panes.findIndex(
  (p) =>
    p !== null &&
    p.kind === 'terminal' &&
    p.sessionId === target.sessionId &&
    p.windowIndex === target.windowIndex,
);
```

`onOpenInPane` の `assignPane` 呼び出しもターゲットに kind を付与:

```tsx
onOpenInPane={(idx) => assignPane(idx, { kind: 'terminal', ...target })}
```

`onSelect` で `usePaneStore.openInFocusedPane` を呼ぶ箇所(`SessionsListPanel` 内に存在すれば)も同じく kind を付与。

- [ ] **Step 2: テスト**

Run: `npx vitest run src/components/__tests__/SessionsListPanel.test.tsx 2>/dev/null; npx tsc -b --noEmit`
Expected: PASS / エラー無し

- [ ] **Step 3: Commit**

```bash
git add src/components/SessionsListPanel.tsx
git commit -m "fix(web): SessionsListPanel の occupy 判定に kind: 'terminal' フィルタを追加"
```

---

## Task 13: E2E スペック — ペイン保持リグレッション

**Files:**
- Create: `tests/e2e/web/pane-preserve-across-tabs.spec.ts`

Docker 隔離前提。既存 `helpers.ts` の `createGatewayEnv` を使うこと(ホスト直接 npx は禁止)。

- [ ] **Step 1: スペック作成**

`tests/e2e/web/pane-preserve-across-tabs.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createGatewayEnv, startGateway, loginAndOpenSessions } from './helpers';

test.describe('Pane preservation across tab switches', () => {
  test('2 ペイン構成は files/settings タブを巡回しても保持される', async ({ page }) => {
    const env = await createGatewayEnv();
    const gw = await startGateway(env);
    try {
      await loginAndOpenSessions(page, gw.url);

      // 2 セッションを作成して 2 ペインに開く想定。helpers にユーティリティがなければ
      // ここで UI 経由で作成する。
      // 1) 1 セッション目を開く
      // 2) cols-2 レイアウトに変更
      // 3) 2 つ目のセッションを 2 ペイン目に open in pane

      // 期待: panes.length が grid 上で 2 個 (data-testid="terminal-pane")
      await expect(page.locator('[data-testid="terminal-pane"]')).toHaveCount(2);

      // ファイルタブへ
      await page.click('[aria-label="Files"]');
      await expect(page.locator('[data-testid="terminal-pane"]')).toHaveCount(2);

      // 設定タブへ
      await page.click('[aria-label="Settings"]');
      await expect(page.locator('[data-testid="terminal-pane"]')).toHaveCount(2);

      // セッションに戻る
      await page.click('[aria-label="Sessions"]');
      await expect(page.locator('[data-testid="terminal-pane"]')).toHaveCount(2);
    } finally {
      await gw.stop();
    }
  });
});
```

実際のセレクタは既存 spec(例: `pane-split.spec.ts`)を参考に調整。`data-testid` がなければ既存テストで使われている `role`/`label` を流用。

- [ ] **Step 2: 実行**

Run: `scripts/e2e-docker.sh tests/e2e/web/pane-preserve-across-tabs.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/pane-preserve-across-tabs.spec.ts
git commit -m "test(web/e2e): タブ切替でのペイン保持リグレッション"
```

---

## Task 14: E2E スペック — ファイルがペインに開く

**Files:**
- Create: `tests/e2e/web/file-in-pane.spec.ts`

- [ ] **Step 1: スペック作成**

`tests/e2e/web/file-in-pane.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createGatewayEnv, startGateway, loginAndOpenSessions } from './helpers';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

test.describe('File in pane', () => {
  test('サイドバーのファイルクリックでフォーカスペインに表示され、× で空に戻る', async ({ page }) => {
    const env = await createGatewayEnv();
    const fixturesDir = join(env.HOME, 'work');
    mkdirSync(fixturesDir, { recursive: true });
    writeFileSync(join(fixturesDir, 'demo.txt'), 'hello pane');
    const gw = await startGateway(env);
    try {
      await loginAndOpenSessions(page, gw.url);
      await page.click('[aria-label="Files"]');
      // breadcrumb で work/ に潜る(helpers / existing spec の流儀に合わせる)
      // ファイル demo.txt をクリック
      await page.click('text=demo.txt');
      // ペインに hello pane が表示される
      await expect(page.getByText('hello pane')).toBeVisible();
      // × ボタンで閉じる
      await page.getByRole('button', { name: /閉じる|close/i }).click();
      await expect(page.getByText('hello pane')).not.toBeVisible();
    } finally {
      await gw.stop();
    }
  });
});
```

(実 selectors は既存 `files-preview.spec.ts` 等を参考に細かく調整)

- [ ] **Step 2: 実行**

Run: `scripts/e2e-docker.sh tests/e2e/web/file-in-pane.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/file-in-pane.spec.ts
git commit -m "test(web/e2e): ファイルがフォーカスペインに開き × で閉じる"
```

---

## Task 15: E2E スペック — URL 復元(file kind)

**Files:**
- Create: `tests/e2e/web/file-pane-url-restore.spec.ts`

- [ ] **Step 1: スペック作成**

`tests/e2e/web/file-pane-url-restore.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createGatewayEnv, startGateway, loginAndOpenSessions } from './helpers';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

test.describe('Pane state restore from URL hash', () => {
  test('hash に file エントリがある URL でリロードしてもペインが復元される', async ({ page }) => {
    const env = await createGatewayEnv();
    mkdirSync(join(env.HOME, 'work'), { recursive: true });
    writeFileSync(join(env.HOME, 'work/demo.txt'), 'restored');
    const gw = await startGateway(env);
    try {
      await loginAndOpenSessions(page, gw.url);

      // ファイルを開いて URL hash に乗ったことを確認
      await page.click('[aria-label="Files"]');
      await page.click('text=demo.txt');
      await page.waitForURL(/#l=.*p=.*f%3A/i);

      // 同 URL でリロード → ペインに復元
      await page.reload();
      await expect(page.getByText('restored')).toBeVisible();
    } finally {
      await gw.stop();
    }
  });

  test('legacy /web/sessions/:id/window/:idx URL は正規化されてもペインに反映される', async ({ page }) => {
    const env = await createGatewayEnv();
    const gw = await startGateway(env);
    try {
      // 事前にセッション作成して name を控える(helpers 経由)
      // ...
      const sessionName = 'demo';
      await page.goto(`${gw.url}/web/sessions/${encodeURIComponent(sessionName)}/window/0`);
      await page.waitForURL((u) => u.pathname === '/web/sessions');
      // ターミナルペインに demo セッションが表示されている
      await expect(page.locator('[data-testid="terminal-pane"]')).toHaveCount(1);
    } finally {
      await gw.stop();
    }
  });
});
```

- [ ] **Step 2: 実行**

Run: `scripts/e2e-docker.sh tests/e2e/web/file-pane-url-restore.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/web/file-pane-url-restore.spec.ts
git commit -m "test(web/e2e): URL hash と legacy URL からのペイン復元"
```

---

## Task 16: 既存 49 spec 一式の回帰確認

- [ ] **Step 1: フル E2E**

Run: `scripts/e2e-docker.sh`
Expected: 既存テストが全部 PASS。ホスト側 `tmux ls` が無事であることも目視確認。

- [ ] **Step 2: 落ちたテストがあれば対応**

代表的な懸念:
- `terminal-mount-preservation.spec.ts`: タブ切替前後でペイン保持を確認している場合、新しい挙動とマッチするはず。仕様強化なら期待値修正。
- `pane-split.spec.ts`: PaneTarget の kind 付きが反映されているか。
- `files-*.spec.ts`: サイドバーが files パネルに切り替わる挙動、ファイルクリック挙動。プレビュー画面が overlay → ペイン内表示になったので spec の DOM クエリを更新。

修正は最小限で、本 PR スコープ内とする。

- [ ] **Step 3: Commit(必要な spec 修正があれば)**

```bash
git add tests/e2e/web/
git commit -m "test(web/e2e): 既存 spec を新ペイン内表示モデルに合わせて更新"
```

---

## Task 17: 型チェック・全ユニットテスト・ビルドの最終確認

- [ ] **Step 1: 型チェック**

Run: `cd packages/web && npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 2: ユニットテスト全実行**

Run: `npx vitest run`
Expected: 全 PASS

- [ ] **Step 3: ビルド**

Run: `npm run build --workspace=@zenterm/web`
Expected: 成功

- [ ] **Step 4: 必要なら lint(プロジェクトに lint コマンドがあれば実行)**

Run: `npm run lint --workspace=@zenterm/web 2>/dev/null || echo "no lint script"`

- [ ] **Step 5: PR 用 branch 作成 / merge 準備(scope 外なら省略)**

本タスクではコミットのみで終了。マージ運用はユーザーに任せる。

---

## 完了基準

- 設計スペック (`docs/superpowers/specs/2026-05-14-web-unified-pane-content-design.md`) のすべての要件にタスクが対応している。
- ユニット・E2E すべて PASS。
- `npm run build --workspace=@zenterm/web` が成功する。
- 手動確認: `/web/sessions` で 2 ペインに分割 → `/web/files` → `/web/settings` → `/web/sessions` と巡回してもペイン構成が維持される。サイドバーでファイルクリックでフォーカスペインに開く。× で閉じると空ペインに戻る。

