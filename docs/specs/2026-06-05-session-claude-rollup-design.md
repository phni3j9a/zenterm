# セッション行への Claude 集約ステータス — 設計書

- 日付: 2026-06-05
- 対象: `packages/shared`（純関数1個）/ `packages/web`（SessionRow）
- 前提: `2026-06-04-claude-session-status-design.md`（ウィンドウ単位バッジ、v0.7.7 でリリース済み）の続き
- ステータス: 設計合意済み

## 1. 背景・目的
ウィンドウ行には Claude 活動バッジ（作業中/入力待ち/無）が出るようになったが、
セッションを**折りたたんだ状態**では見えない。「どのセッションが入力待ちか」を
一覧から一目で分かるよう、**セッション行に集約バッジ**を出す。

## 2. 方針の要点
- セッション行の**先頭ドットを置き換える**。現状の先頭ドットは tmux 状態
  （active=primary / idle=warning / detached=muted）を表すが、ユーザー合意のもと
  **Claude 集約ステータスに置き換える**。
  - 副次効果: 既存 tmux「idle」が `warning`（アンバー）で Claude「作業中」と色が
    衝突していた問題も、置き換えにより解消する。
  - 「アクティブなセッション」は従来どおり**行の背景ハイライト＋影**と
    `aria-current="true"`（既存のボタン属性）で伝わるため、情報は失われない。
- **Gateway 変更なし**。`GET /api/sessions` は既に各 window の `claudeStatus` を返すので、
  Web 側で `session.windows` から集約する。既存の refetch 経路でリアルタイム更新も成立。

## 3. 集約ロジック（純関数 `rollupClaudeActivity`）
置き場所: `packages/web/src/lib/claudeRollup.ts`（**web 専用のプレゼンロジック**）。
`@zenterm/shared` にはテスト基盤が無く、これは型と違い「共有が必須」でもないため
web に置き web の vitest でテストする。将来モバイルが必要になれば shared へ昇格する。

```ts
import type { ClaudeActivity, TmuxWindow } from '@zenterm/shared';

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
- どれか working → `'working'`（最優先・早期 return）
- working は無いが waiting あり → `'waiting'`
- どちらも無し → `undefined`（= Claude 無）

## 4. UI（`SessionRow.tsx`）
- 既存の `stateDotColor` / `stateDotLabel` 算出と、それを使う先頭ドット
  `<span data-testid="session-row-state-dot">` を**撤去**する。
- 先頭スロットに、`rollupClaudeActivity(session.windows ?? [])` の結果で分岐:
  - 結果が `'working'`/`'waiting'` → 既存 `ClaudeStatusBadge` を再利用し
    `<ClaudeStatusBadge status={{ activity }} />` を描画（summary なし＝ツールチップは状態のみ）。
  - `undefined`（Claude 無） → **muted ドット**（`tokens.colors.textMuted`、幅8・丸、
    `aria-hidden`）。整列維持のためのプレースホルダ。
- 先頭スロットは常に幅を確保し、行のレイアウトを崩さない（バッジ/ドットいずれも 8px 丸）。
- アクセシビリティ: Claude 在席時は `ClaudeStatusBadge` の `role="img"`＋aria-label が
  状態を読み上げる。Claude 無の muted ドットは装飾扱い（`aria-hidden`）。アクティブ
  セッションは既存の `aria-current="true"` で伝わる。

## 5. スコープ外（今回やらない）
- Gateway / shared イベント / i18n の変更（`sessions.state.*` キーは未使用になるが、
  parity 維持のため**残置**。削除しない）。
- ウィンドウ行バッジは現状維持（変更なし）。
- セッション集約のツールチップに「どのウィンドウが何をしているか」を出す等の拡張。

## 6. テスト
- **web `lib/__tests__/claudeRollup.test.ts`**: `rollupClaudeActivity` 純関数ユニット
  （working 優先 / waiting / 無し / 空配列）。
- **web `SessionRow.test.tsx`**: 既存の state ドット検証2件
  （line 186「Active」/ 202「Detached」）を**置き換える**:
  - working ウィンドウを含むセッション → 先頭に `role="img"` aria-label `"Working"`。
  - waiting のみ → aria-label `"Waiting for input"`。
  - Claude 無（claudeStatus 無しの windows / 空）→ `role="img"` が無く、
    muted プレースホルダのみ（`session-row-state-dot` testid は撤去。必要なら
    新しい testid を付けて存在のみ確認）。
  - アクティブセッションのボタンが `aria-current="true"` を持つことは別途担保
    （既存テストがあれば維持、無ければ1件追加）。
- 既存の他テスト（rename / delete / chevron / open-in-pane）は不変で通ること。

## 7. 影響範囲
| ファイル | 変更 |
|---|---|
| `packages/web/src/lib/claudeRollup.ts`（新規） | `rollupClaudeActivity` 純関数 |
| `packages/web/src/lib/__tests__/claudeRollup.test.ts`（新規） | 純関数テスト |
| `packages/web/src/components/sidebar/SessionRow.tsx` | 先頭ドットを Claude 集約に置換 |
| `packages/web/.../__tests__/SessionRow.test.tsx` | state ドットテストを Claude ベースに更新 |
