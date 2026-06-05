# セッション行 Claude 集約バッジ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** セッション一覧のセッション行の先頭ドットを、tmux 状態表示から「そのセッション内の Claude 活動の集約（作業中/入力待ち/無）」に置き換え、折りたたみ時でも一目で入力待ちセッションが分かるようにする。

**Architecture:** `session.windows`（`GET /api/sessions` が既に各 window の `claudeStatus` を返す）から純関数 `rollupClaudeActivity` で集約し、`SessionRow` の先頭ドットを既存 `ClaudeStatusBadge` の再利用 or muted プレースホルダで描画する。Gateway 変更なし。リアルタイム更新は既存の `claude-status-changed` → sessions refetch 経路で成立。

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, `@zenterm/shared` 型。

**設計書:** `server/docs/specs/2026-06-05-session-claude-rollup-design.md`

**全コミット共通:** メッセージ末尾に `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` を付ける。作業は既存ブランチ（現在 `main`）。`main` 上で作業前にブランチを切る。

---

## 前提: 作業ブランチ作成

- [ ] **Step 0: ブランチ作成**

```bash
cd /home/server/projects/zenterm/server
git checkout -b feat/session-claude-rollup
```

---

## ファイル構成

| 種別 | パス | 責務 |
|---|---|---|
| 新規 | `packages/web/src/lib/claudeRollup.ts` | `rollupClaudeActivity(windows)` 純関数 |
| 新規 | `packages/web/src/lib/__tests__/claudeRollup.test.ts` | 純関数テスト |
| 変更 | `packages/web/src/components/sidebar/SessionRow.tsx` | 先頭ドットを Claude 集約に置換 |
| 変更 | `packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx` | state ドットテストを Claude ベースに更新 |

テストコマンド: `cd packages/web && npx vitest run <path>`
型チェック caveat: `tsc` は teardown で "Segmentation fault" を出すことがある。型確認は
`cd packages/web && npx tsc --noEmit > /tmp/tsc.log 2>&1; grep -E "error TS[0-9]+" /tmp/tsc.log || echo "types clean"`。

---

## Task 1: `rollupClaudeActivity` 純関数

**Files:**
- Create: `packages/web/src/lib/claudeRollup.ts`
- Test: `packages/web/src/lib/__tests__/claudeRollup.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`packages/web/src/lib/__tests__/claudeRollup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { TmuxWindow } from '@zenterm/shared';
import { rollupClaudeActivity } from '../claudeRollup';

function win(index: number, activity?: 'working' | 'waiting'): TmuxWindow {
  return {
    index,
    name: `w${index}`,
    active: false,
    zoomed: false,
    paneCount: 1,
    cwd: '/h',
    ...(activity ? { claudeStatus: { activity } } : {}),
  };
}

describe('rollupClaudeActivity', () => {
  it('どれか working なら working（waiting より優先）', () => {
    expect(rollupClaudeActivity([win(0, 'waiting'), win(1, 'working')])).toBe('working');
  });

  it('working 無し・waiting あり → waiting', () => {
    expect(rollupClaudeActivity([win(0), win(1, 'waiting')])).toBe('waiting');
  });

  it('claude 在席ウィンドウ無し → undefined', () => {
    expect(rollupClaudeActivity([win(0), win(1)])).toBeUndefined();
  });

  it('空配列 → undefined', () => {
    expect(rollupClaudeActivity([])).toBeUndefined();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/lib/__tests__/claudeRollup.test.ts`
Expected: FAIL（`Cannot find module '../claudeRollup'`）

- [ ] **Step 3: 実装を書く**

`packages/web/src/lib/claudeRollup.ts`:

```ts
import type { ClaudeActivity, TmuxWindow } from '@zenterm/shared';

/**
 * セッション内の各ウィンドウの Claude 活動を 1 つに集約する。
 * working 最優先 → waiting → どちらも無ければ undefined（= Claude 無）。
 */
export function rollupClaudeActivity(
  windows: readonly TmuxWindow[],
): ClaudeActivity | undefined {
  let sawWaiting = false;
  for (const w of windows) {
    if (w.claudeStatus?.activity === 'working') return 'working';
    if (w.claudeStatus?.activity === 'waiting') sawWaiting = true;
  }
  return sawWaiting ? 'waiting' : undefined;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/web && npx vitest run src/lib/__tests__/claudeRollup.test.ts`
Expected: PASS（全 4 ケース）

- [ ] **Step 5: コミット**

```bash
git add packages/web/src/lib/claudeRollup.ts packages/web/src/lib/__tests__/claudeRollup.test.ts
git commit -m "feat(web): add rollupClaudeActivity session aggregation helper"
```

---

## Task 2: SessionRow の先頭ドットを Claude 集約に置換

**Files:**
- Modify: `packages/web/src/components/sidebar/SessionRow.tsx`
- Test: `packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx`

- [ ] **Step 1: 既存テストを更新（失敗する状態にする）**

`SessionRow.test.tsx` の以下 2 テストを**置き換える**。

置換前（現在 line 186〜200 付近）:
```tsx
  it('renders state dot with aria-label "Active" when isActive is true', () => {
    render(
      <SessionRow
        session={session}
        isActive={true}
        isExpanded={false}
        openInPaneOptions={[]}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.getByTestId('session-row-state-dot')).toHaveAttribute('aria-label', 'Active');
  });

  it('renders state dot with aria-label "Detached" when session has no windows and not active', () => {
    render(
      <SessionRow
        session={sessionNoWindows}
        isActive={false}
        isExpanded={false}
        openInPaneOptions={[]}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.getByTestId('session-row-state-dot')).toHaveAttribute('aria-label', 'Detached');
  });
```

置換後（Claude 集約ベース。`screen` の import は既存。i18n は web テストで `lng:'en'` 固定なので英語ラベル）:
```tsx
  it('shows working Claude badge when a window is working', () => {
    const s: TmuxSession = {
      ...session,
      windows: [
        { index: 0, name: 'main', active: true, zoomed: false, paneCount: 1, cwd: '/home/me', claudeStatus: { activity: 'working' } },
        { index: 1, name: 'test', active: false, zoomed: false, paneCount: 1, cwd: '/home/me', claudeStatus: { activity: 'waiting' } },
      ],
    };
    render(
      <SessionRow
        session={s}
        isActive={false}
        isExpanded={false}
        openInPaneOptions={[]}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.getByRole('img', { name: 'Working' })).toBeInTheDocument();
  });

  it('shows waiting Claude badge when only waiting windows', () => {
    const s: TmuxSession = {
      ...session,
      windows: [
        { index: 0, name: 'main', active: true, zoomed: false, paneCount: 1, cwd: '/home/me', claudeStatus: { activity: 'waiting' } },
      ],
    };
    render(
      <SessionRow
        session={s}
        isActive={false}
        isExpanded={false}
        openInPaneOptions={[]}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.getByRole('img', { name: 'Waiting for input' })).toBeInTheDocument();
  });

  it('shows muted placeholder (no img) when no Claude activity', () => {
    render(
      <SessionRow
        session={sessionNoWindows}
        isActive={true}
        isExpanded={false}
        openInPaneOptions={[]}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-row-claude-none')).toBeInTheDocument();
  });

  it('active session button has aria-current="true"', () => {
    render(
      <SessionRow
        session={session}
        isActive={true}
        isExpanded={false}
        openInPaneOptions={[]}
        onToggleExpand={vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenInPane={vi.fn()}
      />,
    );
    // 行ボタン（displayName を含む）が aria-current を持つ
    const rowButton = screen.getByText('dev').closest('button');
    expect(rowButton).toHaveAttribute('aria-current', 'true');
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd packages/web && npx vitest run src/components/sidebar/__tests__/SessionRow.test.tsx`
Expected: FAIL（現状は `role="img"` バッジも `session-row-claude-none` も無く、先頭ドットは旧 state ドット）

- [ ] **Step 3: SessionRow を実装する**

`packages/web/src/components/sidebar/SessionRow.tsx`:

(a) import を追加:
```ts
import { ClaudeStatusBadge } from './ClaudeStatusBadge';
import { rollupClaudeActivity } from '@/lib/claudeRollup';
```

(b) 旧 state ドット算出を**削除**する。現在の以下のブロック（`hasWindows`/`showKebab` の直後）:
```ts
  const stateDotColor = isActive
    ? tokens.colors.primary
    : (session.windows?.length ?? 0) > 0
      ? tokens.colors.warning
      : tokens.colors.textMuted;
  const stateDotLabel = isActive
    ? t('sessions.state.active')
    : (session.windows?.length ?? 0) > 0
      ? t('sessions.state.idle')
      : t('sessions.state.detached');
```
を、次の 1 行に置き換える:
```ts
  const rollupActivity = rollupClaudeActivity(session.windows ?? []);
```

(c) 先頭ドットの JSX を置き換える。現在の以下:
```tsx
        <span
          data-testid="session-row-state-dot"
          aria-label={stateDotLabel}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: stateDotColor,
            flexShrink: 0,
          }}
        />
```
を、次に置き換える:
```tsx
        {rollupActivity ? (
          <ClaudeStatusBadge status={{ activity: rollupActivity }} />
        ) : (
          <span
            data-testid="session-row-claude-none"
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: tokens.colors.textMuted,
              flexShrink: 0,
            }}
          />
        )}
```

> 注: 行ボタンは `display:flex; gap: tokens.spacing.sm` なので、先頭子要素のバッジ/ドットの
> 後ろの余白は gap が担保する（追加マージン不要）。`ClaudeStatusBadge` は幅8・`flexShrink:0`。

- [ ] **Step 4: テストが通ることを確認**

Run: `cd packages/web && npx vitest run src/components/sidebar/__tests__/SessionRow.test.tsx`
Expected: PASS（更新した 4 ケース + 既存の rename/delete/chevron/open-in-pane 等すべて）

- [ ] **Step 5: 周辺テスト＋型チェック**

Run: `cd packages/web && npx vitest run src/components/sidebar src/components/__tests__/SessionsListPanel.test.tsx`
Expected: PASS（SessionsListPanel など SessionRow を含む上位もリグレッション無し）

型: `cd packages/web && npx tsc --noEmit > /tmp/tsc.log 2>&1; grep -E "error TS[0-9]+" /tmp/tsc.log || echo "types clean"`
Expected: `types clean`（旧 `stateDotColor`/`stateDotLabel` 削除で未使用変数が残っていないこと）

- [ ] **Step 6: コミット**

```bash
git add packages/web/src/components/sidebar/SessionRow.tsx packages/web/src/components/sidebar/__tests__/SessionRow.test.tsx
git commit -m "feat(web): show Claude rollup status on session rows"
```

---

## Task 3: 全体検証

- [ ] **Step 1: web 全テスト + 型**

Run: `cd packages/web && npx vitest run && (npx tsc --noEmit > /tmp/tscall.log 2>&1; grep -E "error TS[0-9]+" /tmp/tscall.log || echo "types clean")`
Expected: 全 PASS / types clean

- [ ] **Step 2: 仕上げ**

`superpowers:finishing-a-development-branch` でマージ/PR を判断。良ければ前回同様 `0.7.8` リリース → Gateway 更新まで（ユーザー判断）。

---

## 注意・既知の整理
- `sessions.state.active/idle/detached` の i18n キーは未使用になるが、8 言語の parity を崩さないため**残置**（削除しない）。
- Gateway / shared / イベントは無変更。リアルタイムは既存 `claude-status-changed`→refetch で成立。
- ウィンドウ行バッジは現状維持。
