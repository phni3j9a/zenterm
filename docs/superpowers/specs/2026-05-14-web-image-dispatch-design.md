# PC Web — 画像のドロップ/ペーストで Claude Code 等に渡す経路 設計

- 対象: `packages/web` (React 19 SPA, Gateway の `/web/*` 配信)
- 作成日: 2026-05-14
- 関連: docs/superpowers/specs/2026-05-14-web-unified-pane-content-design.md, app 側既存実装 `app/src/components/SpecialKeys.tsx:402-423`

## 1. 動機

モバイルアプリ (`packages/mobile` および `app/`) には「画像をライブラリから選んでサーバーの staging に上げ、戻ってきた絶対パスを stdin に打鍵する」フローが既にある (`SpecialKeys.tsx:402-423`)。これによりユーザーは Claude Code 等の TUI に対して画像を「コマンドの引数」として与えられる。

PC Web (`packages/web`) には現状:

- `Ctrl+Shift+V` (`XtermView.tsx:230-242`) はテキストのみのペースト
- ターミナルペインへのドラッグ&ドロップ (`TerminalDropZone.tsx`, `AuthenticatedShell.tsx:168-190`) はあるが、**ファイルを cwd に upload するだけ**でパス打鍵はしない
- クリップボード画像のペーストハンドリングなし
- xterm.js のインライン画像描画アドオン (`@xterm/addon-image` 等) もなし

このため PC Web からは Claude Code に画像を渡す手段が事実上ない。本設計ではアプリ版と同じ「**staging に保存 → 絶対パスを stdin に打鍵**」モデルを、**ドラッグ&ドロップ**と**クリップボードペースト**の 2 入口で提供する。

## 2. 仕様

### 2.1 保存先・ファイル名

- 既存サーバー API `POST /api/upload` を `dest` クエリ無しで呼ぶ。
- サーバー側 (`packages/gateway/src/routes/upload.ts:96`) はデフォルト `UPLOAD_DIR` (= `$HOME/uploads/zenterm/`) に保存し、`preserveName` 未指定なので `YYYY-MM-DD_HHMMSS_<rand8hex>.<ext>` で自動リネームする (`upload.ts:26-33`)。
- レスポンスの `path` は絶対パス。

サーバー側の変更はゼロ。アプリ版と完全同一エンドポイント・同一挙動。

### 2.2 トリガ

| 入口 | 検知 | 対象ペイン |
|---|---|---|
| ドラッグ&ドロップ | `TerminalDropZone` の DragEvent | ドロップされたペイン |
| クリップボードペースト | `XtermView` の `Ctrl+Shift+V` (macOS は `Cmd+Shift+V` も) keydown | フォーカス中ペイン |

### 2.3 複数ファイルの扱い

- 1 回のドロップ/ペーストに複数 File が含まれる場合、**順次** アップロードし、1 件成功するたびに即時 write する。
- 各 path は **POSIX シェルの single-quote エスケープ** で囲む (`shellQuote(path) + ' '`)。staging のファイル名は date_time_rand.ext なのでスペース混入リスクは低いが、防御的に常にクォートする。
- 末尾に改行 (`\r` / `\n`) は送らない。Enter は人間が押す。

### 2.4 既存 cwd ドロップの廃止

- `TerminalDropZone` 経由の cwd ドロップ (`AuthenticatedShell.handleTerminalDrop`) は完全廃止。staging 一本化。
- cwd にファイルを置きたいユースケースは、サイドバー Files パネルの既存アップロード機能 (`FilesSidebarPanel.tsx:171`) で代替可能だが本設計では追加 UI は作らない。
- ターミナルペイン上のドロップは画像/非画像を区別せず、一律 staging 行き。

### 2.5 排他制御

- `useUploadProgress` (AuthenticatedShell スコープで単一) を流用。同時に複数 dispatch が走らない。
- 既に `active === true` の状態で新規 dispatch が来たら `terminal.uploadBusy` トースト (既存) を出して early return する。

## 3. アーキテクチャ

```
[OS clipboard] ─paste─┐
                       ├──▶ useImageDispatch hook ──▶ ApiClient.uploadFile(file)  (dest 省略)
[Drag&Drop file] ──────┘                                       │
                                                               ▼
                                                  POST /api/upload  (dest 無し)
                                                               │
                                                               ▼
                                  $HOME/uploads/zenterm/<date>_<time>_<rand>.<ext>
                                                               │
                                                               ▼
                                          response.path (絶対パス)
                                                               │
                                                               ▼
                              shellQuote(path) + ' ' を WebSocket.send(encodeInput(...)) で
                              対象ペインの pty stdin に書き込む
```

- API は既存 `/api/upload` を再利用。
- 入り口が増えても **`useImageDispatch` フック**にロジック集約。`TerminalDropZone` と `XtermView` は薄い caller。
- `write` 関数は `XtermView` の既存 WebSocket 送信経路 (`encodeInput` 経由) を `TerminalActions` 経由で公開する。新規プロトコル追加なし。

## 4. コンポーネント分解

### 4.1 新規ファイル

#### `web/src/lib/shellQuote.ts`

POSIX シェルの single-quote エスケープ。純粋関数。

```ts
export function shellQuote(input: string): string;
// 'foo' → "'foo'"
// "foo bar" → "'foo bar'"
// "foo'bar" → "'foo'\\''bar'"
// "" → "''"
```

#### `web/src/hooks/useImageDispatch.ts`

入力 (File[]) → 順次アップロード → シェル引用付きで write を一括処理。

```ts
export interface ImageDispatchDeps {
  apiClient: ApiClient;
  write: (text: string) => void;
  uploadProgress: UploadProgressApi;
  pushToast: (toast: Toast) => void;
  t: TFunction; // react-i18next の useTranslation() から
}

export function useImageDispatch(deps: ImageDispatchDeps): {
  dispatch: (files: File[]) => Promise<void>;
};
```

責務:

1. `files.length === 0` なら何もしない。
2. `uploadProgress.active` なら `terminal.uploadBusy` トーストを出して return。
3. `uploadProgress.begin(files.length)`。
4. for each file:
   - `uploadProgress.markStart(file.name)`
   - `path = await apiClient.uploadFile(file)` (dest 省略 → staging)
   - 成功: `uploadProgress.markDone()`, `write(shellQuote(path) + ' ')`
   - 失敗: `uploadProgress.fail(msg)`, `pushToast('error', ...)` , **以降のファイル処理は中断**, `setTimeout(finish, 3000)`, return
5. 全件成功: `pushToast('success', { count })`, `setTimeout(finish, 1500)`

依存は全て注入なので、DOM 知識ゼロで単体テスト可能。

### 4.2 改修ファイル

#### `web/src/api/client.ts`

- `uploadFile(file: File, destPath?: string)` で `destPath` を optional 化。
- `destPath` 未指定なら `?dest=...&preserveName=true` を **付けない** (= サーバーの `UPLOAD_DIR` に自動リネーム保存)。
- `destPath` 指定時の挙動は現状維持 (`FilesSidebarPanel` 等の既存呼び出し元への影響なし)。

#### `web/src/components/terminal/XtermView.tsx`

- `TerminalActions` インターフェースに `write(text: string)` を追加。
- 既存 `paste` メソッドも内部的に `write` 経由に統一できると望ましいが破壊的変更を避けるため任意。
- `Ctrl+Shift+V` / `Cmd+Shift+V` キーハンドラを書き換え:

  ```
  if (navigator.clipboard?.read) {
    items = await navigator.clipboard.read()
    images = items から image/* の Blob を集めて File[] 化
    if (images.length > 0) {
      onPasteImagesRef.current?.(images)   // hook の dispatch を呼ぶコールバック
      return false
    }
  }
  // フォールバック: 従来の readText パス
  ```

- `onPasteImages: (files: File[]) => void` を新規 prop に追加 (ref 経由で安定参照)。
- `navigator.clipboard.read` 未対応ブラウザはトースト経由でユーザー通知し、テキストペーストにフォールバック。

#### `web/src/components/terminal/TerminalDropZone.tsx`

- props を `{ onFiles: (files: File[]) => void }` に簡略化 (`cwd` を削除)。
- ヒント表示テキストを `terminal.dropHint` を新文言「ファイル/画像をドロップして Claude などに渡す」 (各言語) に差し替え。
- DOM レイアウト・スタイルは現状維持。

#### `web/src/components/TerminalPane.tsx`

- `TerminalDropZone` の cwd 依存を除去。
- `XtermView` から `write` を受け取れるよう `onActionsReady` で受領した `TerminalActions.write` を保持。
- ローカルで `useImageDispatch` を呼んで `dispatch` を作り、`TerminalDropZone.onFiles` と `XtermView.onPasteImages` の両方に接続。
- これにより **dispatch インスタンスはペイン単位**となり、target session の write が pane 固有のまま分離される。

#### `web/src/components/AuthenticatedShell.tsx`

- `handleTerminalDrop` の cwd 直書き呼び出しを削除。
- `apiClient` / `uploadProgress` / `pushToast` を `TerminalPane` に渡せるよう必要な props を整理。
- `useUploadProgress` のシングルトン的扱いは現状維持 (shell スコープ)。

#### `web/src/i18n/locales/*.json` (8 言語)

| キー | 変更 |
|---|---|
| `terminal.dropHint` | 「ファイル/画像をここにドロップして Claude などに渡す」相当の文言に差し替え |
| `terminal.uploadBusy` | 流用 (既存) |
| `terminal.uploadError` | 流用 |
| `terminal.uploadDone` | 流用 (件数フォーマット維持) |
| `terminal.clipboardPermission` | **新規**: 「ブラウザのクリップボード権限を許可してください」 |
| `terminal.clipboardUnsupported` | **新規**: 「このブラウザはクリップボード読み取りに対応していません」 |
| `terminal.uploadSizeExceeded` | **新規**: 「ファイルサイズが上限を超えました」(`UPLOAD_MAX_SIZE` の現値=10MiB を本文に表記) |
| `terminal.notConnected` | **新規**: 「ターミナルが切断中のためパスを送信できませんでした」 |

i18n 対応言語: en, ja, zh-CN, ko, es, de, fr, pt-BR。

## 5. データフロー詳細

### 5.1 ドラッグ&ドロップ経路

```
1. user drops files on terminal pane
2. TerminalDropZone onDrop → files: File[]
3. TerminalPane が useImageDispatch.dispatch(files) を呼ぶ
4. dispatch:
   a. uploadProgress.begin(files.length)
   b. for each file:
        uploadProgress.markStart(file.name)
        path = await apiClient.uploadFile(file)   // dest 無し
        uploadProgress.markDone()
        write(shellQuote(path) + ' ')             // 即時打鍵
   c. pushToast('uploadDone', { count: files.length })
   d. setTimeout(uploadProgress.finish, 1500)
```

### 5.2 ペースト経路 (Ctrl/Cmd+Shift+V)

```
1. user presses Ctrl+Shift+V (Cmd+Shift+V on macOS)
2. XtermView の keydown ハンドラが捕捉 (preventDefault → return false)
3. navigator.clipboard.read() で ClipboardItem[] を取得
4. items を走査して image/* (image/png, image/jpeg, image/gif, image/webp 等) の Blob を全部 File に変換
   ファイル名は `Blob` には無いため `image_${Date.now()}_${i}.<ext>` を採番。
   `<ext>` は MIME のサブタイプから決定する (`image/png` → `png`, `image/jpeg` → `jpg`, `image/gif` → `gif`, `image/webp` → `webp`, 未知サブタイプは `bin`)
5. 画像が 1 枚以上あれば: onPasteImages(files) → dispatch(files) (5.1.b と同じ)
   画像が無ければ: 従来通り navigator.clipboard.readText() を走らせ ws.send(encodeInput(text))
```

### 5.3 打鍵タイミング

- **1 ファイルアップロード成功ごとに即 write** (バッチではない)。
- 中断時の振る舞いは 6 章を参照。

### 5.4 対象ペインの確定

- **ドロップ**: `TerminalDropZone` がペイン内部にあるので、ドロップされたペインで自動確定。
- **ペースト**: `XtermView` 内のキーハンドラから発火するので、フォーカス中ペインで自動確定。
- 排他制御 (`uploadProgress.active`) は AuthenticatedShell スコープなので、**ペインをまたいだ同時アップロードは MVP では弾く**。

## 6. エラーハンドリング

| 失敗箇所 | 検知 | ユーザー表示 | 内部処理 |
|---|---|---|---|
| クリップボード読み取り拒否 (`NotAllowedError`) | `navigator.clipboard.read()` の reject | `terminal.clipboardPermission` トースト | テキストパスへフォールバック (`readText` で再試行) |
| クリップボードに画像なし | items 走査結果が空 | (無表示) | 従来のテキストペーストを実行 |
| クリップボード API 未対応 | `navigator.clipboard?.read` が undefined | `terminal.clipboardUnsupported` トースト | テキストパスへフォールバック |
| 別の dispatch が走行中 | `uploadProgress.active === true` | `terminal.uploadBusy` トースト (既存) | 早期 return |
| HTTP 401 | `HttpError.status === 401` | 既存 `logout()` → ログイン画面 | 残りファイルも中断 |
| HTTP 413 (サイズ超過) | response status | `terminal.uploadSizeExceeded` (上限を表記) | 該当ファイルの write スキップ、残り中断 |
| その他 HTTP エラー | non-2xx | `terminal.uploadError` (既存) | 残り中断 |
| ネットワーク失敗 | fetch reject | `terminal.uploadError` | 残り中断 |
| WebSocket 切断中の write | `ws.readyState !== OPEN` | `terminal.notConnected` トースト (初回のみ) | 残りファイルの処理は中断 (upload もスキップ)。path 文字列は内部 buffer に保持しない (シンプル仕様) |
| サポート外 MIME (image 以外を paste) | items 全部 image じゃない | (無表示) | テキストパスへフォールバック |

### 6.1 中断仕様の意図

「3 枚中 2 枚目が失敗 → 3 枚目は試さず止める」。理由:

- 1 枚目分の path は既にターミナルに打鍵済み (ユーザーのコマンドラインに残る)
- 2 枚目失敗のトーストが出る
- 続けて 3 枚目を打鍵すると `path1 path3 ` という抜けたパス列ができ、ユーザーが混乱する
- 中断すれば、ユーザーは「2 枚目以降を改めてドロップする」という素直な復旧ができる

### 6.2 WebSocket 切断時の挙動

- アップロードは HTTP なので WebSocket とは独立に成功し得る。
- `write` が無声に失敗するとユーザーに「画像が pty に届いた感覚」が伴わないので、`terminal.notConnected` トーストで**明示**。
- staging には残るので、再接続後にユーザーが手動で `ls $HOME/uploads/zenterm/` から拾える (= lost work ではない)。

## 7. テスト方針

### 7.1 ユニットテスト (vitest, `__tests__/` colocated)

| 対象 | テストファイル | 検証内容 |
|---|---|---|
| `shellQuote` | `web/src/lib/__tests__/shellQuote.test.ts` (新規) | 表テスト: 空文字 / 通常文字列 / `foo'bar` / スペース / 日本語 / 連続シングルクォート |
| `useImageDispatch` | `web/src/hooks/__tests__/useImageDispatch.test.tsx` (新規) | ① 1 ファイル成功時に正しい引用付き文字列が write される ② 複数ファイル: 順次 write される ③ 途中失敗で残りスキップ + 適切なトースト ④ `uploadProgress.active=true` で早期 return |
| `ApiClient.uploadFile(file)` (dest 省略) | `web/src/api/__tests__/client-files.test.ts` に追記 | `?dest=` クエリが付かないこと、Authorization ヘッダ、レスポンス絶対パスの返却 |
| `XtermView` の paste 拡張 | `web/src/components/terminal/__tests__/XtermView.paste.test.tsx` (新規) | ① clipboard.read が image 含む ClipboardItem を返す場合 dispatch 呼び出し ② image 無しなら readText 経由のテキスト送信 ③ `NotAllowedError` のフォールバック ④ Cmd+Shift+V (mac) も対応 |
| `TerminalDropZone` | `web/src/components/terminal/__tests__/TerminalDropZone.test.tsx` (新規 or 追記) | onFiles が cwd 無しで呼ばれる、ヒント文言の表示 |

### 7.2 E2E テスト (`tests/e2e/web/*.spec.ts`, Docker 隔離必須)

**ルール**: PC Web の e2e は必ず `scripts/e2e-docker.sh` 経由 (`server/CLAUDE.md` の規定通り)。host で `npx playwright test` 直叩きは禁止。

| spec | シナリオ |
|---|---|
| `tests/e2e/web/image-drop.spec.ts` (新規) | DataTransfer で偽 PNG を生成し TerminalDropZone に dispatchEvent → ① container 内の `$HOME/uploads/zenterm/` にファイル生成 ② xterm の表示行に絶対パス＋スペースが出る |
| `tests/e2e/web/image-paste.spec.ts` (新規) | `page.evaluate` で `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` → Ctrl+Shift+V → 同様の検証 |
| 既存 e2e 影響調査 | 既存 `tests/e2e/web/` に「ドロップで cwd に upload」を検証するテストがあれば staging 検証に書き換え (実装フェーズで列挙) |

### 7.3 手動検証チェックリスト (実装完了時)

1. Chrome で起動 → 画像ファイル 1 枚をペインにドロップ → staging に保存され、絶対パスが xterm に表示。
2. Chrome で `Cmd+Shift+V` / `Ctrl+Shift+V` でスクリーンショットペースト → 同上。
3. 画像 3 枚同時ドロップ → スペース区切りで 3 path が表示。
4. テキストだけ含むクリップボードで Ctrl+Shift+V → 従来通りテキストが入る。
5. Claude Code 起動中のペインにドロップ → Claude Code がパスを認識し画像読込。
6. アップロード中に別ペインにドロップ → `uploadBusy` トースト。
7. クリップボード権限が拒否された状態で Ctrl+Shift+V → `clipboardPermission` トースト + テキストパスにフォールバック。

## 8. スコープ外

- xterm.js 内のインライン画像表示 (Sixel / iTerm2 inline image / Kitty graphics)。`@xterm/addon-image` 等の追加は本設計に含めない。
- staging ディレクトリの自動掃除 (古いファイル削除)。
- staging を Files サイドバーから閲覧する UI 強化。
- 「cwd にファイルを upload」したい用途のターミナルペイン側 UI 提供。サイドバー Files の既存機能を案内するに留める。
