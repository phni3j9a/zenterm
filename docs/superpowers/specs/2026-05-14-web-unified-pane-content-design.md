# PC Web — タブ切替でのペイン保持 & ファイルのペイン内表示 設計

- 対象: `packages/web` (React 19 SPA, Gateway の `/web/*` 配信)
- 作成日: 2026-05-14
- 関連: docs/superpowers/specs/2026-05-12-pc-web-phase-6-ui-polish.md, docs/roadmap.md (Phase 1〜7 完了)

## 1. 動機

現在の `AuthenticatedShell` は 3 ルート (`/web/sessions`, `/web/files`, `/web/settings`) で共有されているため SPA としてサイドバーは差し替わっている。しかし `AuthenticatedShell.tsx:82-88` の副作用が、`/web/sessions` 以外に遷移したタイミングで `usePaneStore.suspendForSingle()` を呼び、`setLayout('single')` 経由で `dropExtraPanes` を走らせる。これにより 2/3/4 ペイン構成は単一に潰され、`savedLayout` でレイアウトモードは復元できても消えたペインのアサイン情報(セッション/ウィンドウ)は失われる。ユーザーには「タブを行き来するとペインがリセットされる」と見える。

また `/web/files` ではサイドバーをファイルブラウザに切り替えると同時に、コンテンツ領域に `FilesViewerPane` を absolute オーバーレイで被せている。ペインは隠れるだけだがファイルとターミナルが画面上で共存できず、「ペインの中身を選ぶ」というメンタルモデルにもなっていない。

本設計では以下を満たす:

1. タブ(`sessions` / `files` / `settings`)切替でペインのレイアウトとアサインを保持する。
2. サイドバーで選んだファイルを、フォーカス中のペインに「セッションを開くのと同じ操作感」で表示する。
3. ファイルを開いているペインは × ボタンで空に戻せる。

## 2. データモデル

### 2.1 `PaneTarget` の判別共用体化

`stores/pane.ts` の `PaneTarget` を以下に置き換える:

```ts
export type PaneTarget =
  | { kind: 'terminal'; sessionId: string; windowIndex: number }
  | { kind: 'file'; path: string };
```

- ストアの内部ロジック (`setLayout` / `assignPane` / `openInFocusedPane` / `setFocusedIndex`) は kind を意識する必要なし。判別共用体の値を不透明に扱う。
- `isOccupied(target, excludeIdx?)` は「同一の対象を別ペインで重複表示しない」というガードだが、これを **`terminal` 同士のみ**に限定する。`file` 対象は常に `false` を返す(同一ファイルを 2 ペインで並べる用途を許可)。

### 2.2 ペインストアの永続化マイグレーション

`usePaneStore` の persist version を 2 → 3 に上げ、`migrate` で v2 の `{sessionId, windowIndex}` 形の各エントリに `kind: 'terminal'` を付与する。`null` ペインはそのまま。`savedLayout` は新設計では使わないため、移行時に破棄する。

### 2.3 サスペンド/レジューム機構の削除

`suspendForSingle`, `resume`, `savedLayout` を `PaneState` から完全に除去する。`AuthenticatedShell.tsx:82-88` の useEffect も削除。これがリセット現象の根治となる。

## 3. コンポーネント変更

### 3.1 新規

#### `components/files/FilePaneViewer.tsx`

- props: `{ path: string; client: FilesApiClient; token: string; onClose: () => void }`
- 構造:
  - 上部: ファイル名 + パス + 編集状態 + **× ボタン** を持つ薄いヘッダー。既存 `FilesViewerHeader` をそのまま再利用し、`onClose` を受け取る prop を追加して × ボタンの描画を許可する
  - 本体: 既存の分岐をそのまま流用
    - テキスト系 → `FilesEditor` または `FilesTextViewer`
    - Markdown → `FilesMarkdownViewer`
    - 画像 → `FilesImageViewer`
- ファイル取得・編集保存ロジックは既存 `FilesViewerPane` から移植。`useFilesPreview` 系の挙動(最新リクエスト優先・古いレスポンス破棄)はそのまま再利用。
- 読込エラー時はペイン内に「読み込めません」表示を出すのみ。ペイン自体は破棄せず、ユーザーが × で閉じるまで残す。

### 3.2 変更

#### `components/layout/MultiPaneArea.tsx`

- `slot(idx)` 内で `pane?.kind` で分岐:
  - `null` (空スロット) → 既存の空ペイン表示
  - `'terminal'` → 既存の `TerminalPane`
  - `'file'` → 新設 `FilePaneViewer`(`onClose` には `() => usePaneStore.getState().assignPane(idx, null)` を渡す)
- `isVisible` prop は撤去する。`AuthenticatedShell` は常に MultiPaneArea を可視で常駐させ、ペインごとに表示の責務はスロット自身が持つ。
- ターミナルセッション一覧 (`sessionCwd`) を引く既存ロジックは `kind === 'terminal'` のときだけ実行する。

#### `components/files/FilesSidebarPanel.tsx`

- ファイルクリック時の遷移ロジックを差し替える:
  - 旧: ルーティング / オーバーレイ表示
  - 新: `usePaneStore.getState().openInFocusedPane({ kind: 'file', path })` を呼ぶだけ
- フォルダクリック(サイドバー内で深く潜る)は不変。
- サイドバーの「現在のフォルダ」は `useFilesStore` の状態にぶら下がる(従来通り)。

#### `components/AuthenticatedShell.tsx`

- 削除する箇所:
  - L82-88: `suspendForSingle/resume` の useEffect
  - L92-117: `parseSessionRoute` を起点に focused pane を上書きする useEffect(path→store 同期)
  - L450-471: `FilesViewerPane` をオーバーレイ表示している分岐
- 残す/調整:
  - hash → store 同期 (L121-132): kind 対応に拡張した `decodeFragment` を呼ぶ。それ以外は不変。
  - store → URL 同期 (L137-155): **path 部分の自動更新を撤去**。hash のみ書き戻す。フォーカスペインの kind に応じて path を変えない(タブの path はユーザー操作のみで変わる)。

#### `lib/paneStateFragment.ts`

- `encode` / `decode` を新 `PaneTarget` 用に拡張。
- 後方互換: 古いハッシュ(各ペインが `{sessionId, windowIndex}` 形)を decode したときは `kind: 'terminal'` を補完して返す。

#### `lib/urlSync.ts` (`parseSessionRoute` / `buildSessionPath`)

- もはやペイン状態を path から読み取らない方針のため、`parseSessionRoute` は「旧式 URL からの起動を救済する初回マイグレーション用ヘルパ」へ役割を縮小する。
- 起動時に旧 path (`/web/sessions/:id/window/:idx`) を踏んでいたら、それを `{kind: 'terminal', sessionId, windowIndex}` として focused pane に反映したうえで `/web/sessions` に正規化(`navigate(..., { replace: true })`)。以降は出力しない。

### 3.3 削除

- `components/files/FilesViewerPane.tsx`(役割を `FilePaneViewer` に統合)
- `components/files/FilesViewerEmpty.tsx`(空表示は `FilePaneViewer` 側のローディング/エラー UI として吸収)

## 4. URL / 状態同期方針

### 4.1 役割分担

- **path**: サイドバーがどのタブ/フォルダを開いているか
  - `/web/sessions`
  - `/web/files/<path>`(これは「サイドバーで今見ているフォルダ」のみを意味する。ペインに何が乗っているかとは独立)
  - `/web/settings`
- **hash**: ペインのレイアウトと各スロットの内容(ターミナル/ファイル/空)
- **localStorage** (`zenterm-web-pane`): persist v3。リロード/別タブで同じ状態を復元する。

### 4.2 path → store の影響を切る

ペイン状態を path から読み取らなくなるので、ユーザーがタブをクリックして path だけ変わってもペインは無傷。「設定/ファイルから戻ったらリセット」が原理的に発生しなくなる。

### 4.3 store → URL は hash のみ

`AuthenticatedShell` の逆同期 useEffect は、`layout` と `panes` 全体を `encodeFragment` に通して hash に書き戻すのみ。`navigate(desired, { replace: true })` の `desired` は `location.pathname + '#' + encoded`(layout=single かつ単一ペインのみで空ペインでなければ hash 省略は維持)。

### 4.4 旧 URL 救済

`/web/sessions/:id/window/:index` を起動時に検出したら一度だけ pane store に反映後、`/web/sessions` + hash に書き換える(replace)。以後この path 形式は出力しない。

## 5. エッジケース

- **ハッシュ参照先が存在しないファイル**: `FilePaneViewer` が API エラーを捕捉し、ペイン内エラー表示。`null` 化はしない(ユーザーが × で閉じる判断)。
- **ハッシュ参照先が存在しないセッション/ウィンドウ**: 既存 `parseSessionRoute` 後の `exists` チェックと同等のガードを hash 復元側にも入れ、見つからない `terminal` ターゲットは `null` 化する。
- **ファイル lazy load 中の連打**: 既存 `useFilesPreview` のレース対策(最新リクエストのみ反映)を継続利用。
- **同一ファイルを 2 ペインで開いて編集**: 競合は API 側で発生せず。もう片方のペインの表示は古いままになるが、最小実装では再クリックで再読込する運用とする。`stores/files` の更新イベント購読による自動再読込は本スコープ外。
- **× で閉じた直後**: 当該スロットを `null` にして hash を再エンコード。空スロットは既存仕様で表現可能。
- **`isOccupied` の呼び出し元レビュー**: ストア外で `isOccupied` を参照している箇所(コマンドパレット、`openInFocusedPane` 前のガード等)を実装着手前に grep で洗い出し、ファイル kind に対する挙動変更が意図せず影響しないか個別に確認する。

## 6. テスト

### 6.1 ユニット (`vitest`)

- `stores/pane.ts`
  - v2 → v3 migrate: `{sessionId, windowIndex}` のペインが `{kind: 'terminal', sessionId, windowIndex}` に変換される。`savedLayout` が破棄される。
  - `isOccupied`: 同一 file ターゲットが別ペインに存在しても `false`。同一 terminal ターゲットが存在すれば `true`。
- `lib/paneStateFragment.ts`
  - encode/decode の round-trip: terminal / file / null を混在させた `panes` で完全一致。
  - 旧フォーマット (`kind` なし) の decode で `kind: 'terminal'` 補完される。
- `components/layout/MultiPaneArea`
  - `kind: 'terminal'` のスロットで `TerminalPane` が、`kind: 'file'` のスロットで `FilePaneViewer` がレンダリングされる(モック化して識別)。
- `components/files/FilePaneViewer`
  - テキスト / 画像 / Markdown の分岐(既存 `FilesViewerPane` テストの移植)。
  - × ボタン押下で `onClose` が呼ばれる。

### 6.2 E2E (`scripts/e2e-docker.sh` 経由必須)

- `web/file-in-pane.spec.ts` (新規)
  - サイドバーでファイルクリック → フォーカスペインに表示される。
  - 2 ペイン分割状態でフォーカス切替 → クリックしたファイルが正しいスロットに入る。
  - × で閉じるとスロットが空になり、空ペインの状態に戻る。
- `web/pane-preserve-across-tabs.spec.ts` (新規 — リグレッション対策の中核)
  - 2 ペイン構成のまま `/web/files`、`/web/settings`、`/web/sessions` を巡回してもレイアウトとアサインが保持される。
- `web/url-restore.spec.ts` (新規)
  - ハッシュにファイルを含めた URL でリロードしてペインが復元される。
  - 旧 path `/web/sessions/:id/window/:idx` を踏むと正規化された URL に書き換わり、ターミナルが該当ペインに入っている。
- 既存 49 spec はそのまま通る前提。落ちた場合は原因特定して修正(本設計に内包する作業範囲)。

## 7. 想定される影響範囲(変更ファイル一覧)

新規:
- `packages/web/src/components/files/FilePaneViewer.tsx`
- `packages/web/src/components/files/__tests__/FilePaneViewer.test.tsx`
- `tests/e2e/web/file-in-pane.spec.ts`
- `tests/e2e/web/pane-preserve-across-tabs.spec.ts`
- `tests/e2e/web/url-restore.spec.ts`

変更:
- `packages/web/src/stores/pane.ts`
- `packages/web/src/lib/paneStateFragment.ts`
- `packages/web/src/lib/urlSync.ts`
- `packages/web/src/components/layout/MultiPaneArea.tsx`
- `packages/web/src/components/AuthenticatedShell.tsx`
- `packages/web/src/components/files/FilesSidebarPanel.tsx`
- 関連ユニットテスト(`__tests__/`)

削除:
- `packages/web/src/components/files/FilesViewerPane.tsx`
- `packages/web/src/components/files/FilesViewerEmpty.tsx`(吸収)

## 8. アウトオブスコープ

- ファイル編集中の自動再読込(別ペインで開いた同一ファイルの同期)。
- 設定タブをペインに開けるようにする拡張。
- タブ機構(1 ペイン内でターミナル/ファイルを切替保持)。
- ペインのドラッグ&ドロップ並び替え。
