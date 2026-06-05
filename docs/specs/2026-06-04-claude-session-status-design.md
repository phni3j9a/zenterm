# Claude セッション活動ステータス表示 — 設計書

- 日付: 2026-06-04
- 対象: ZenTerm Server（`packages/shared` / `packages/gateway` / `packages/web`）
- ステータス: 設計合意済み（実装計画はこれから）

## 1. 背景・目的

ZenTerm のセッション一覧では、各 tmux ウィンドウで Claude Code が
**今どういう状態か**（作業中なのか、こちらの入力を待っているのか、そもそも
動いていないのか）が分からない。複数セッションを並行運用していると
「どのセッションが自分の返答待ちか」を知るために逐一開いて確認する必要がある。

セッション一覧に **3 状態のステータスバッジ** を出し、一目で
「見に行くべきセッション（入力待ち）」が分かるようにする。

まず PC Web で実装・検証し、良ければモバイル（別リポジトリ `zenterm-app`）へ
展開する。Gateway / shared 側の変更はモバイルでもそのまま再利用できる設計とする。

## 2. スコープ

### 対象（今回）
- `packages/shared`: 型定義の追加
- `packages/gateway`: ウィンドウ情報への状態付与、リアルタイム配信用 poller、イベント型追加
- `packages/web`: ウィンドウ行へのバッジ描画、イベント購読、i18n

### 非対象（今回やらない）
- モバイルアプリ（`zenterm-app`）のバッジ描画 — Gateway/shared を再利用し後日
- セッション行へのロールアップバッジ — 今回は**ウィンドウ個別のみ**。折りたたみ時に
  状態が見えない点は許容し、必要になれば後日追加
- 権限承認待ち・エラー・トークン上限などの**細分化状態** — v1 は 3 状態のみ
- 分割ウィンドウの**非アクティブペイン**で動く Claude の検出（後述の既知の制限）

## 3. 状態定義

| 状態 | 意味 | 検出 |
|---|---|---|
| `working`（作業中） | Claude が処理中（thinking / ツール実行中） | スピナーグリフ点灯中 |
| `waiting`（入力待ち） | Claude が応答を終えこちらの入力待ち | 静止グリフ `✳` |
| なし（Claude無） | そのウィンドウで Claude が動いていない | claude プロセス不在 |

「Claude無」は型上は `claudeStatus` フィールドの**不在（undefined）**で表現する
（`'none'` リテラルを各所に持ち回らない）。

## 4. 検出方式（D 案: tmux `pane_title` グリフ読み取り）

### 4.1 原理
Claude Code は実行中、OSC エスケープシーケンスでターミナルのタイトルを
`<状態グリフ> <作業概要>` の形に更新し続ける。tmux はこの OSC をパースして
ペインごとに `pane_title` として保持しており、`#{pane_title}` で参照できる。
ユーザーの tmux 設定（`set-titles` の on/off 等）に依存せず取得できる。

### 4.2 実測による裏付け（2026-06-04, 本番機 server-Macmini）
`tmux list-panes -a -F '#{pane_id}|#{pane_current_command}|#{pane_title}'` の実測:

| pane | current_command | title 先頭グリフ | コードポイント | 判定 |
|---|---|---|---|---|
| %0 | claude | `⠐` / `⠂`（コマ送りで変化） | U+2810 / U+2802 | working |
| %12 | claude | `⠂` | U+2802 | working |
| %86 | claude | `✳`（固定） | U+2733 | waiting |
| %8 | **zsh** | `⠐`（claude 終了後の残骸） | U+2810 | none（command で除外） |

- 作業中ペインの先頭グリフは点字ブロック（U+2800–U+28FF）を**コマ送りでアニメ**
  （= 生きたスピナー）。サンプル間で %0 が `⠐`→`⠂` と変化することを確認。
- 入力待ちペインは `✳`（U+2733）で**固定**。
- claude 終了後もタイトルは消えず**残る（stale）**。`pane_current_command` で
  ゲートしないと誤検出する（%8 が実例）。

### 4.3 分類規則（純関数 `deriveClaudeStatus`）
入力: `(paneCurrentCommand: string, paneTitle: string)` → `ClaudeWindowStatus | undefined`

```
claude 在席判定:
  present = (command === 'claude')
         || (command === 'node' && 先頭グリフが既知集合に含まれる)
  present が false → undefined（= Claude無）。stale タイトルはここで除外される。

活動判定（present のとき）:
  glyph = title の先頭の非空白文字
  glyph ∈ [U+2800 .. U+28FF]（点字ブロック）            → activity = 'working'
  glyph === '✳'（U+2733）                                 → activity = 'waiting'
  上記以外（在席だがグリフ不明 / 起動直後でタイトル未設定） → activity = 'waiting'
    （起動直後の Claude は最初の入力待ちであるため waiting に倒す）

summary:
  title から先頭グリフと続く空白を除いた残り（空なら省略）
```

定数（差し替え容易に集約）:
- `BRAILLE_RANGE = [0x2800, 0x28FF]`
- `WAITING_GLYPHS = new Set(['✳'])`（将来 Claude 仕様変更時に追記できるよう Set）
- `CLAUDE_COMMANDS = new Set(['claude', 'node'])`（`node` は既知グリフ条件付き）

## 5. アーキテクチャ / データフロー

```
[Claude Code (各 tmux ペイン)]
  └─ OSC でタイトル更新（<グリフ> <概要>）
       └─ tmux が pane_title として保持
            ├─ (a) on-request: GET /api/sessions
            │       listSessions → listWindows（書式に command+title 追加）
            │       → parseWindowLine が deriveClaudeStatus を呼び window.claudeStatus を付与
            │
            └─ (b) realtime: claudeStatusPoller（WS 接続中のみ ~2s 間隔）
                    tmux list-windows -a（同一書式）→ 同一分類器で全ウィンドウ判定
                    → 派生状態の signature が前回と変化したときだけ
                       tmuxControlService 経由で {type:'claude-status-changed'} を broadcast
                         └─ Web: 既存 /ws/events 購読が受信 → /api/sessions を debounce refetch
                              └─ WindowRow がバッジ再描画
```

(a) と (b) は**同じ書式・同じ分類器**を使うため判定が一致する。

## 6. 変更点（パッケージ別）

### 6.1 `packages/shared/src/index.ts`
```ts
export type ClaudeActivity = 'working' | 'waiting';

export interface ClaudeWindowStatus {
  activity: ClaudeActivity;
  summary?: string; // タイトルの作業概要（ツールチップ用、省略可）
}

// 既存 TmuxWindow に追加（省略可。undefined = Claude無）
export interface TmuxWindow {
  // ...既存フィールド
  claudeStatus?: ClaudeWindowStatus;
}

// 既存 TmuxEvent に追加
export type TmuxEvent =
  | { type: 'sessions-changed' }
  | { type: 'windows-changed' }
  | { type: 'monitor-restart' }
  | { type: 'claude-status-changed' }; // ← 追加
```
gateway は `tmuxControl.ts` で `@zenterm/shared` の `TmuxEvent` を re-export 済み。
型の単一ソースは shared。

### 6.2 `packages/gateway`

**`services/claudePaneStatus.ts`（新規）**
- `deriveClaudeStatus(command, title): ClaudeWindowStatus | undefined` — §4.3 の純関数
- 分類用定数（§4.3）

**`services/tmux.ts`（変更）**
- `tmuxWindowListFormat` に `#{pane_current_command}` と `#{pane_title}` を追加。
  `pane_title` は任意文字列（`|` を含み得る）ため**末尾フィールド**に置く。
  新書式（案）:
  `#{window_index}|#{window_name}|#{?window_active,1,0}|#{?window_zoomed_flag,1,0}|#{window_panes}|#{pane_current_path}|#{pane_current_command}|#{pane_title}`
- `parseWindowLine` を更新:
  - 先頭から固定 7 フィールドを取り、**8 番目以降は join('|') で再結合**して title とする
    （title 内の `|` を吸収）。
  - `deriveClaudeStatus(command, title)` の結果を `window.claudeStatus` に設定
    （undefined のときはフィールドを付けない）。
  - 注意: `pane_current_path`（cwd）に `|` が含まれると壊れる既存リスクは現状維持
    （本変更で悪化させない。title を末尾にするのはこのため）。
- これにより `listWindows` → `listSessions` → `GET /api/sessions` が**追加の tmux 呼び出し
  なしで** `claudeStatus` を含むようになる。ルート（`routes/sessions.ts`）は無変更。

**`services/claudeStatusPoller.ts`（新規）**
- ライフサイクルは `tmuxControlService` の購読数 0↔1 遷移に連動（WS クライアントが
  1 人以上いる間だけ稼働）。実装は `tmuxControlService.subscribe`/最終 unsubscribe の
  フックに poller の start/stop を相乗りさせる（購読数の単一ソースを使う）。
- 稼働中は `CLAUDE_STATUS_POLL_MS`（既定 2000ms）間隔で
  `tmux list-windows -a -F '#{session_name}|' + tmuxWindowListFormat` を実行。
  - `config.SESSION_PREFIX`（既定 `zen_`）で始まるセッションのみ対象
    （`_zen_monitor` / `_zen_view_*` 等の内部セッションを除外し、表示一覧と一致させる）。
- 各ウィンドウを `deriveClaudeStatus` で分類し、`session/window:activity` を連結した
  **signature 文字列**を作る。前回 signature と異なるときだけ
  `tmuxControlService` 経由で `{type:'claude-status-changed'}` を broadcast。
  → tick ごとではなく**実際の状態遷移ぶんだけ**配信される。
- tmux 不在 / コマンド失敗時は「全ウィンドウ none（= signature 空）」として扱い、
  例外を外に投げない。重複 tick（前回未完了）を避けるガードを持つ。
- broadcast 手段: 現状 `tmuxControlService.emit` は private。poller から配信できるよう、
  サービスに最小の publish 経路を用意する（例: `emit` を内部公開する薄いメソッド、
  または poller を `tmuxControlService` が保持し購読数連動で駆動）。
  実装方式は計画フェーズで確定。

### 6.3 `packages/web`

**`hooks/useEventsSubscription.ts`（変更）**
- `onEvent` の refetch トリガ条件に `event.type === 'claude-status-changed'` を追加
  （既存 `sessions-changed`/`windows-changed`/`monitor-restart` と同じ debounce refetch 経路）。

**`components/sidebar/ClaudeStatusBadge.tsx`（新規）**
- props: `status: ClaudeWindowStatus`
- 描画: 行頭に小さなドット（§7）。`aria-label` と `title`（ツールチップ）を付与。

**`components/sidebar/WindowRow.tsx`（変更）**
- `window.claudeStatus` があるとき、行の**先頭**に `ClaudeStatusBadge` を描画
  （既存ローディング skeleton が先頭 8px ドットを置くレイアウトと一致）。
- なければ何も描画しない（レイアウトのガタつきを避けるため、無し時もドット幅の
  プレースホルダを確保するか要検討 → 計画で決定）。

**i18n（`i18n/locales/*.json` 全 8 言語）**
- 追加キー: `sessions.claudeStatus.working` / `sessions.claudeStatus.waiting`
  （ツールチップ・aria-label 用。例: 「作業中」「入力待ち」）
- ツールチップは `summary` があれば `"<状態> · <summary>"` 形式で連結。
- `i18n/__tests__/parity.test.ts`（キー網羅テスト）を通すため全言語に追加。

## 7. UI / UX 仕様

### 7.1 視覚表現
| 状態 | 色（テーマトークン） | 形 | 動き |
|---|---|---|---|
| working | `tokens.colors.warning`（アンバー） | 塗りドット | ゆっくりした鼓動パルス |
| waiting | `tokens.colors.success`（セージ緑） | リング/中空ドット | 静止 |

- 「入力待ち＝あなたの番」を一覧スキャン時に見つけやすくするのが目的。
- スピナーのコマ（~100ms）は追わない。working の鼓動は **CSS アニメーションのみ**で、
  ポーリング頻度とは独立。
- 配色は muted な Zen パレット上で、選択中セッションの行ハイライト
  （`primarySubtle` 背景）と混同しないよう、ドットの色・形・動きで多重に区別する。
  最終的な色味は実装レビューでコントラストを確認して微調整可。

### 7.2 アクセシビリティ
- **色だけに依存しない**: 形（塗り/リング）・動きの有無・`aria-label` の 3 チャネルで区別。
- `aria-label` に状態テキスト（i18n）を入れ、スクリーンリーダーで読めるようにする。
- `prefers-reduced-motion: reduce` のときは working のパルスを止め、静的な差別化
  （形・色）にフォールバックする。

## 8. エッジケース・既知の制限

| ケース | 挙動 |
|---|---|
| claude 終了後の stale タイトル | `pane_current_command != claude/node` で none に倒れる |
| `node` で直接起動した claude | `node` かつ既知グリフなら在席として拾う |
| 無関係な `node` アプリ（vite 等） | 既知グリフを持たないため none |
| 在席だがグリフ不明（起動直後等） | waiting に倒す |
| tmux サーバ不在 / コマンド失敗 | 全ウィンドウ none、例外を投げない |
| **分割ウィンドウの非アクティブペインで動く claude** | **v1 非対象**（アクティブペインのみ判定）。多くの運用ではウィンドウ＝単一/アクティブペインなので許容。将来 list-panes 全走査へ拡張可能 |
| `pane_title` に `|` を含む | title を末尾フィールド＋再結合で吸収 |
| 将来 Claude が spinner/idle グリフ仕様を変更 | 判定が壊れ得る（どの設置不要案でも避けられない性質）。定数集約で追従を容易にし、`command` ゲートで誤「作業中」表示は出にくくして緩和 |

## 9. テスト計画

### ユニット（最重要・純関数）
- `deriveClaudeStatus`:
  - 点字各種（U+2800 / U+2802 / U+2810 / U+28FF）→ working
  - `✳`(U+2733) → waiting
  - command=zsh + 点字タイトル（stale）→ undefined
  - command=node + 既知グリフ → 在席 / command=node + 非グリフ → undefined
  - 在席 + 不明グリフ → waiting
  - summary 抽出（グリフ＋空白除去、空なら省略）
- `parseWindowLine`: 新書式のパース、title 内 `|` の再結合、claudeStatus 付与。

### Gateway 結合
- `listWindows`/`listSessions` が `claudeStatus` を含むこと（tmux 出力をモック）。
- `claudeStatusPoller`: signature 変化時のみ broadcast / 不変時は無音 /
  購読数 0↔1 で start・stop / tmux 失敗時に例外を投げないこと（タイマー・tmux runner を注入）。

### Web
- `ClaudeStatusBadge`: working/waiting の描画差分、aria-label、ツールチップ（summary 連結）。
- `WindowRow`: claudeStatus 有/無での描画。
- `useEventsSubscription`: `claude-status-changed` 受信で refetch がトリガされること。
- i18n parity テストが通ること。

### E2E（Docker 隔離・必須ルール順守: `scripts/e2e-docker.sh`）
- PATH に `claude` スタブ（`printf '\033]2;⠂ test\033\\'` でタイトルを出して sleep する
  スクリプト）を置き、`pane_current_command == claude` を再現してバッジ表示まで検証。
- v1 はユニット中心。E2E は最小限（1 ケース）に留めてよい。

## 10. 設定・定数
- `CLAUDE_STATUS_POLL_MS`（env, 既定 2000）— poller 間隔。
- `BRAILLE_RANGE` / `WAITING_GLYPHS` / `CLAUDE_COMMANDS` — `claudePaneStatus.ts` に集約。
- `config.SESSION_PREFIX`（既存, 既定 `zen_`）— poller の対象セッション絞り込みに流用。

## 11. 将来拡張（今回やらない）
- セッション行ロールアップバッジ（折りたたみ時の可視化）。
- 細分化状態（権限承認待ち = `PermissionRequest`、エラー、トークン上限連携）。
- 分割ウィンドウ全ペイン走査。
- 閲覧中ペインのみ PTY ストリームから OSC を sniff して即時反映（ポーリングのラグ解消）。
- `claude-status-changed` にペイロード（statuses）を載せ、Web 側 refetch を不要にする最適化。
- モバイル（`zenterm-app`）でのバッジ描画。
