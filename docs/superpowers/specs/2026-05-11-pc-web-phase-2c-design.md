# ZenTerm PC Web Phase 2c (Files タブ) — Design Spec

> 状態: Phase 2c 完了 (2026-05-11) — `web-pc-phase-2c-done` タグ付き

> Phase 2c: PC Web ブラウザに Files タブを追加し、ホームディレクトリ配下のブラウズ・閲覧・編集・mutation を完全実装する。Mobile アプリの `FilesPanel` (1630 行モノリス) を参考にしつつ、PC 向けに decompose し直す。

- 作成日: 2026-05-11
- 担当: Phase 2c
- 前提: Phase 2a (events + sidebar CRUD) + Phase 2b (settings + i18n) 完了済み (`origin/main` へマージ済み)
- ブランチ: `feature/web-pc-phase-2c`
- 完了タグ: `web-pc-phase-2c-done`

---

## 1. ゴール / 非ゴール

### 1.1 ゴール

- Sidebar の **Files タブを enable** にして `/web/files` 経由で navigate 可能にする
- 以下の機能パリティを Mobile と揃える:
  - ホームディレクトリ (`~`) を起点としたディレクトリブラウズ
  - パンくずナビゲーション
  - 並び替え (name asc / name desc / size desc / modified desc)
  - 隠しファイル表示トグル
  - テキスト/画像/markdown プレビュー
  - **テキスト編集** (CodeMirror 6 ベース、`Ctrl/Cmd+S` で保存)
  - 新規ファイル作成 (内容を編集して保存で作成)
  - 新規フォルダ作成
  - リネーム
  - 削除 (確認 dialog + 単一/複数)
  - 詳細表示 (size / modified / permissions)
  - 選択モード (long-press 相当 = `Ctrl/Cmd+Click` または ⋮ メニューから "選択")
  - クリップボード (copy / cut → paste)
  - **アップロード** (ファイルピッカー + ドラッグ&ドロップ)
  - **ダウンロード** (`/api/files/raw` から fetch + Blob URL → `<a download>`)
  - i18n (en / ja)
- レイアウト: **Sidebar 内に FilesPanel + 右ペインに FilesViewerPane**
- 既存 Phase 2a/2b の機能 (Sessions / Settings / TerminalPane mount preservation) を破壊しない

### 1.2 非ゴール (Phase 2c では実装しない)

- WebSocket ベースのファイル変更通知 (Mobile も polling/refresh ベース)
- 大きなテキスト編集 (Gateway 側 `MAX_FILE_SIZE = 512KB` の上限を拡張する作業はやらない)
- バイナリエディタ
- 検索/grep
- 圧縮ファイルの展開
- terminal でのファイル open / その他コマンド連携
- Phase 2b で deferred になった TerminalPane 完全マウント保持 (Files に切り替えた瞬間 unmount される)
  - **理由**: 右ペインを Files が "全面乗っ取り" するためどうしても TerminalPane は隠れる。Sessions に戻った時には再 mount されるが xterm 状態は失われる。Phase 2d 以降で hidden 維持の戦略 (CSS `display:none` 切り替え等) を再検討
- multipart アップロードの `dest` validation 改善 (Gateway 既存の挙動を踏襲)
- Treeview (再帰的展開ツリー) — flat な list + breadcrumbs で十分

### 1.3 success criteria

- `/web/files` を開くと `~` がブラウズ可能
- 既存 Phase 2a/2b の vitest スイート (233 テスト) が壊れない
- Phase 2a/2b の Playwright E2E (15 テスト) が壊れない
- Phase 2c で追加する vitest 単体/統合テストが全部 pass する
- Phase 2c で追加する Playwright E2E (browse / preview / edit-save / upload / delete / rename / mkdir / copy-paste) が全部 pass する
- `npm run type-check` `npm run build` clean

---

## 2. アーキテクチャ概要

### 2.1 ルーティング & レイアウト

現状 (Phase 2b 後):
- `App.tsx`: `/web/files` は `<Navigate to="/web/sessions" replace />`
- `AuthenticatedShell.tsx` は **Sidebar + TerminalPane** を常時並べる構造
  - `Sidebar` の panel は URL から `activePanel` を導出 (`sessions` / `files` / `settings`)
  - `TerminalPane` は活性 session が無くても idle 表示で常駐

Phase 2c 後:
- `App.tsx` に `/web/files` ルートを追加 → `FilesRoute` (新規) を mount
- 既存 `AuthenticatedShell` を **共通 shell** として残しつつ、右ペインのコンテンツを **route ごとに切り替え**:
  - `/web/sessions` → `<TerminalPane />` (現状)
  - `/web/settings` → `<TerminalPane />` (Settings は Sidebar 内なので右は terminal のまま)
  - `/web/files` → `<FilesViewerPane />` (新規)
- 右ペインの切り替えは `AuthenticatedShell` 内で `useLocation()` から判定
- Sidebar の `renderPanel()` を 3 ブランチに拡張:
  - `activePanel === 'settings'` → `<SettingsPanel />`
  - `activePanel === 'files'` → `<FilesSidebarPanel />` (新規、ファイル一覧 + breadcrumbs + ツールバー)
  - default → `<SessionsListPanel />`
- Sidebar の Files タブの `disabled` を解除し、`onClick={() => navigate('/web/files')}` を有効化、`title={t('sidebar.filesComingSoon')}` の hint も削除

#### TerminalPane 取り扱い (重要トレードオフ)

- 選択肢 A (採用): `/web/files` 中は `<TerminalPane />` を unmount。xterm はその間は破棄される。Sessions に戻ると再 mount され state はリセット (但し Gateway 側の tmux session/window は生き続けるので再 attach するだけ)
- 選択肢 B (却下): `<TerminalPane />` を CSS `display:none` で隠して mount は維持。状態は保持されるが、Files 中も WebSocket は走り続けるためバックグラウンド負荷が残る + xterm の resize 計算が乱れる懸念
- 採用理由: シンプル & 既存 reconnect ロジックが活用できる。Phase 2d で再評価

### 2.2 高レベル構成図

```
App.tsx
  Routes
    /web/login      → LoginRoute
    /web/sessions   → SessionsRoute → AuthenticatedShell (mode='sessions')
    /web/files      → FilesRoute    → AuthenticatedShell (mode='files')
    /web/settings   → SettingsRoute → AuthenticatedShell (mode='settings')

AuthenticatedShell (mode を URL から判定)
  ├── <Sidebar />                       (320px)
  │     ├── tabs (sessions/files/settings)
  │     ├── panel content (mode 別)
  │     │     ├── SessionsListPanel
  │     │     ├── FilesSidebarPanel    ← Phase 2c
  │     │     └── SettingsPanel
  │     └── EventsStatusDot
  └── 右ペイン (mode 別)
        ├── TerminalPane               (sessions / settings)
        └── FilesViewerPane            ← Phase 2c (files)

FilesSidebarPanel
  ├── FilesToolbar (sort / hidden toggle / upload / new)
  ├── FilesBreadcrumbs
  ├── (selection mode header / paste bar)
  ├── FilesList (FilesItem[])
  └── (BulkActionBar)

FilesViewerPane
  ├── FilesViewerEmpty           ← 何も選択されていない
  ├── FilesTextViewer / FilesEditor (CodeMirror 6)
  ├── FilesImageViewer
  └── FilesMarkdownViewer
```

### 2.3 状態管理 (zustand)

#### 2.3.1 `stores/files.ts` (新規)

```ts
type SortMode = 'name-asc' | 'name-desc' | 'size-desc' | 'modified-desc';
type ClipboardMode = 'copy' | 'cut';

interface FilesState {
  // browse
  currentPath: string;            // '~' 起点
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  showHidden: boolean;
  sortMode: SortMode;

  // selection
  selectionMode: boolean;
  selectedNames: Set<string>;

  // clipboard
  clipboard: { items: string[]; mode: ClipboardMode } | null;

  // actions (純粋に state mutation のみ。fetch/mutation は AuthenticatedShell 経由で hook)
  setCurrentPath(path: string): void;
  setEntries(entries: FileEntry[]): void;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;
  toggleShowHidden(): void;
  setSortMode(mode: SortMode): void;
  enterSelectionMode(initialName?: string): void;
  exitSelectionMode(): void;
  toggleSelection(name: string): void;
  selectAll(): void;
  setClipboard(c: FilesState['clipboard']): void;
  clearClipboard(): void;
  reset(): void;
}
```

- persist は **しない** (currentPath はセッション中の一時状態)
- `sortMode` `showHidden` はセッション中だけで OK (Phase 2d 以降で persist 検討)

#### 2.3.2 `stores/filesPreview.ts` (新規)

```ts
type PreviewKind = 'text' | 'image' | 'markdown' | 'unsupported';

interface FilesPreviewState {
  selectedPath: string | null;       // 選択中のファイル絶対パス
  selectedName: string | null;       // 表示用ファイル名
  selectedKind: PreviewKind | null;
  textContent: string | null;        // text/markdown
  textLines: number;
  textTruncated: boolean;
  loadingPreview: boolean;
  previewError: string | null;

  isEditing: boolean;
  editContent: string;
  isDirty: boolean;
  saving: boolean;

  showMarkdownRendered: boolean;     // markdown のとき rendered ↔ source

  // actions
  selectFile(path: string, name: string, kind: PreviewKind): void;
  setText(content: string, lines: number, truncated: boolean): void;
  setLoadingPreview(b: boolean): void;
  setPreviewError(msg: string | null): void;
  startEditing(): void;
  cancelEditing(): void;
  setEditContent(s: string): void;
  setSaving(b: boolean): void;
  finishSave(savedContent: string): void;
  toggleMarkdownRendered(): void;
  clear(): void;
}
```

### 2.4 API クライアント

`packages/web/src/api/client.ts` の `ApiClient` クラスに以下のメソッドを追加:

```ts
listFiles(path: string, showHidden: boolean): Promise<FileListResponse>
getFileContent(path: string): Promise<FileContentResponse>
writeFileContent(path: string, content: string): Promise<FileWriteResponse>
deleteFile(path: string): Promise<FileDeleteResponse>
renameFile(path: string, newName: string): Promise<FileRenameResponse>
copyFiles(sources: string[], destination: string): Promise<FileCopyResponse>
moveFiles(sources: string[], destination: string): Promise<FileMoveResponse>
createDirectory(path: string): Promise<FileMkdirResponse>
buildRawFileUrl(path: string): string                // image/binary preview/download 用
uploadFile(file: File, destPath: string): Promise<FileUploadResponse>   // multipart/form-data
```

#### 2.4.1 `buildRawFileUrl` の使い分け

- Image preview: `<img src={buildRawFileUrl(path)} />` — ただし Bearer token を Authorization ヘッダで渡す必要があるので **fetch + Blob URL** にする (`useObjectUrl(rawUrl, token)` のような hook を新設)
- Download: 同様に fetch + Blob URL → `<a href={blobUrl} download={filename}>` を programmatic click

#### 2.4.2 upload 仕様

- Gateway は `POST /api/upload?dest=<path>&preserveName=true` を multipart で受ける
- Web 側は `FormData` に `file: File` を入れて `fetch` で送信。`preserveName=true` を必ず付ける (これにより衝突時は `_1`, `_2` の suffix が付く挙動)
- 401 は wrappedClient で intercept

### 2.5 i18n (`packages/web/src/i18n/locales/{en,ja}.json`)

`files` namespace を追加。Mobile の `files.*` キー (約 60 キー) を流用しつつ PC 用に若干調整:

```json
{
  "files": {
    "title": "Files",
    "noServerConfigured": "Gateway not configured.",
    "fetchFailedDesc": "Failed to load directory.",
    "loadFailed": "Failed to load",
    "loadFailedDesc": "...",
    "saved": "Saved",
    "saveFailed": "Save failed",
    "saveFailedDesc": "...",
    "uploadFile": "Upload",
    "uploadComplete": "Upload complete",
    "uploadFailed": "Upload failed",
    "uploadFailedDesc": "...",
    "downloadFailed": "Download failed",
    "downloadFailedDesc": "...",
    "deleteConfirmTitle": "Delete?",
    "deleteConfirmMessage": "Delete {{name}}? This cannot be undone.",
    "deleteConfirmMultiple": "Delete {{count}} items? This cannot be undone.",
    "deleteSuccess": "Deleted",
    "deleteFailed": "Delete failed",
    "deleteFailedDesc": "...",
    "rename": "Rename",
    "renameSuccess": "Renamed",
    "renameFailed": "Rename failed",
    "renameFailedDesc": "...",
    "delete": "Delete",
    "copy": "Copy",
    "cut": "Cut",
    "paste": "Paste",
    "details": "Details",
    "copySuccess": "Copied to clipboard",
    "cutSuccess": "Cut to clipboard",
    "pasteSuccess": "Pasted",
    "pasteFailed": "Paste failed",
    "pasteFailedDesc": "...",
    "createNewFile": "New File",
    "newFolder": "New Folder",
    "fileNamePlaceholder": "filename.ext",
    "folderNamePlaceholder": "folder name",
    "mkdirSuccess": "Folder created",
    "mkdirFailed": "Create folder failed",
    "mkdirFailedDesc": "...",
    "overwriteTitle": "Overwrite?",
    "overwriteDesc": "{{name}} already exists. Overwrite?",
    "overwriteAction": "Overwrite",
    "selectedCount": "{{count}} selected",
    "selectAll": "Select all",
    "deselectAll": "Deselect all",
    "clipboardItems": "{{count}} item(s) on clipboard",
    "sortNameAsc": "Name (A→Z)",
    "sortNameDesc": "Name (Z→A)",
    "sortSizeDesc": "Size (large first)",
    "sortModifiedDesc": "Modified (newest)",
    "sort": "Sort",
    "toggleSort": "Toggle sort",
    "toggleHiddenFiles": "Toggle hidden files",
    "goUp": "Go up",
    "cannotOpen": "Cannot open",
    "cannotOpenDesc": "{{name}} cannot be previewed.",
    "cannotFetchFiles": "Cannot fetch files",
    "previewTitle": "No file selected",
    "previewDescription": "Select a file in the sidebar to preview.",
    "emptyDirectoryTitle": "Empty directory",
    "emptyDirectoryDescription": "There are no files here.",
    "truncatedIndicator": "Truncated at {{lines}} lines",
    "detailsSize": "Size: {{size}}",
    "detailsModified": "Modified: {{date}}",
    "detailsPermissions": "Permissions: {{permissions}}",
    "openLinkFailedDesc": "Failed to open symlink",
    "edit": "Edit",
    "save": "Save",
    "cancel": "Cancel",
    "rendered": "Rendered",
    "source": "Source",
    "download": "Download",
    "uploadDropHint": "Drop files here to upload",
    "unsavedChangesTitle": "Unsaved changes",
    "unsavedChangesMessage": "You have unsaved changes. Discard?"
  },
  "sidebar": {
    "tabs": { "files": "Files" }     // 既存値、変更なし
    // filesComingSoon は削除
  }
}
```

ja は対応する日本語訳を追加。

### 2.6 新規/追加依存

- `@uiw/react-codemirror` ^4.x (CodeMirror 6 を React で使う公式 wrapper、basic setup 込み)
  - 内部で `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/search` を pulled in
- `@codemirror/lang-javascript` (TS/JS/JSX/TSX)
- `@codemirror/lang-json`
- `@codemirror/lang-markdown`
- `@codemirror/lang-python`
- `@codemirror/lang-html`
- `@codemirror/lang-css`
- `@codemirror/theme-one-dark` (dark テーマ)
- `react-markdown` ^9.x + `remark-gfm` ^4.x (markdown rendering)

これらは全て web のみ追加。Editor/MarkdownViewer は **lazy import** (`React.lazy`) で chunk 分割し、Files タブを開かない限りバンドルされないようにする。

---

## 3. ディレクトリ構成 (実装後)

```
packages/web/src/
├── api/
│   └── client.ts                              # 既存 + Files メソッド追加
├── stores/
│   ├── files.ts                               # 新規
│   └── filesPreview.ts                        # 新規
├── lib/
│   ├── filesPath.ts                           # 新規 (buildEntryPath, getParentPath, breadcrumbs)
│   ├── filesSort.ts                           # 新規 (sortFiles)
│   ├── filesIcon.ts                           # 新規 (getFileIconType, getPreviewKind)
│   ├── filesFormat.ts                         # 新規 (formatFileSize, formatFileDate)
│   └── languageForFilename.ts                 # 新規 (拡張子 → CodeMirror 言語)
├── hooks/
│   └── useAuthorizedBlobUrl.ts                # 新規 (Bearer 付き fetch → Blob URL → cleanup)
├── components/
│   ├── AuthenticatedShell.tsx                 # 既存 → 右ペイン分岐拡張
│   ├── Sidebar.tsx                            # 既存 → Files タブ enable + FilesSidebarPanel branch
│   └── files/
│       ├── FilesSidebarPanel.tsx              # 新規
│       ├── FilesToolbar.tsx                   # 新規 (sort / hidden / upload / new menu)
│       ├── FilesBreadcrumbs.tsx               # 新規
│       ├── FilesList.tsx                      # 新規
│       ├── FilesItem.tsx                      # 新規 (1 行)
│       ├── FilesSortMenu.tsx                  # 新規 (popover or <dialog>)
│       ├── FilesNewMenu.tsx                   # 新規 (new file / new folder)
│       ├── FilesNewNameDialog.tsx             # 新規 (name 入力 + Cancel/OK)
│       ├── FilesContextMenu.tsx               # 新規 (rename/copy/cut/delete/details)
│       ├── FilesDetailsDialog.tsx             # 新規
│       ├── FilesSelectionHeader.tsx           # 新規 (count + select-all + close)
│       ├── FilesBulkActionBar.tsx             # 新規 (copy/cut/delete bottom bar)
│       ├── FilesPasteBar.tsx                  # 新規 (clipboard + paste)
│       ├── FilesUploadDropZone.tsx            # 新規 (drag&drop overlay)
│       ├── FilesViewerPane.tsx                # 新規 (右ペイン root)
│       ├── FilesViewerEmpty.tsx               # 新規
│       ├── FilesViewerHeader.tsx              # 新規 (filename + edit/save/cancel/download)
│       ├── FilesTextViewer.tsx                # 新規 (line numbers + content, read-only)
│       ├── FilesImageViewer.tsx               # 新規 (Blob URL based)
│       ├── FilesMarkdownViewer.tsx            # 新規 (react-markdown, lazy)
│       └── FilesEditor.tsx                    # 新規 (CodeMirror 6, lazy)
├── routes/
│   └── files.tsx                              # 新規 (4 行 wrapper, AuthenticatedShell 利用)
├── i18n/locales/
│   ├── en.json                                # 既存 + files namespace
│   └── ja.json                                # 既存 + files namespace
├── App.tsx                                    # 既存 → /web/files Navigate を本物に置換
└── __tests__/
    ├── lib/
    │   ├── filesPath.test.ts                  # 新規
    │   ├── filesSort.test.ts                  # 新規
    │   └── filesFormat.test.ts                # 新規
    ├── stores/
    │   ├── files.test.ts                      # 新規
    │   └── filesPreview.test.ts               # 新規
    ├── hooks/
    │   └── useAuthorizedBlobUrl.test.ts       # 新規
    ├── components/files/
    │   ├── FilesBreadcrumbs.test.tsx          # 新規
    │   ├── FilesList.test.tsx                 # 新規
    │   ├── FilesItem.test.tsx                 # 新規
    │   ├── FilesSidebarPanel.test.tsx         # 新規
    │   ├── FilesToolbar.test.tsx              # 新規
    │   ├── FilesViewerPane.test.tsx           # 新規
    │   ├── FilesTextViewer.test.tsx           # 新規
    │   ├── FilesViewerHeader.test.tsx         # 新規
    │   ├── FilesContextMenu.test.tsx          # 新規
    │   ├── FilesNewNameDialog.test.tsx        # 新規
    │   ├── FilesDetailsDialog.test.tsx        # 新規
    │   ├── FilesPasteBar.test.tsx             # 新規
    │   ├── FilesBulkActionBar.test.tsx        # 新規
    │   └── FilesSelectionHeader.test.tsx      # 新規
    └── flows/
        ├── files-browse.test.tsx              # 新規
        ├── files-edit.test.tsx                # 新規
        ├── files-mutations.test.tsx           # 新規 (rename/delete/mkdir)
        ├── files-clipboard.test.tsx           # 新規 (copy/cut/paste)
        └── files-upload.test.tsx              # 新規

packages/web/tests/e2e/web/
├── files-browse.spec.ts                       # 新規
├── files-preview.spec.ts                      # 新規
├── files-edit-save.spec.ts                    # 新規
├── files-rename-delete.spec.ts                # 新規
├── files-mkdir.spec.ts                        # 新規
├── files-copy-paste.spec.ts                   # 新規
└── files-upload-download.spec.ts              # 新規
```

---

## 4. 詳細設計 (主要コンポーネント)

### 4.1 `AuthenticatedShell.tsx` (改修)

- `useLocation()` で pathname を取得し、右ペインを 3 way 分岐
- TerminalPane は `pathname.startsWith('/web/files')` のとき unmount
- FilesViewerPane は `/web/files` のときのみ mount

```tsx
return (
  <div style={{ display: 'flex', height: '100vh' }}>
    <Sidebar {...sidebarProps} />
    {isFilesRoute ? (
      <FilesViewerPane wrappedClient={wrappedClient} />
    ) : (
      <TerminalPane gatewayUrl={...} token={...} sessionId={...} windowIndex={...} />
    )}
  </div>
);
```

- `wrappedClient` を Files 側にも 401 intercept パターンで渡す
- (Phase 2b で IMP-1 として残った wrappedClient memoize 問題は Phase 2c でも踏襲。改善は別タスク)

### 4.2 `routes/files.tsx`

```tsx
import { AuthenticatedShell } from '@/components/AuthenticatedShell';
export function FilesRoute() { return <AuthenticatedShell />; }
```

### 4.3 `Sidebar.tsx` (改修)

- `renderPanel()` に files ブランチ追加
- Files タブの `disabled`/`title` を解除し、`onClick={() => navigate('/web/files')}` を追加
- aria-pressed の挙動はそのまま (`activePanel === 'files'`)

### 4.4 `FilesSidebarPanel.tsx`

- `useFilesStore` を購読
- 初回 mount で `~` をロード (`AuthenticatedShell` から渡される loader callback で fetch、結果を `setEntries` + `setCurrentPath`)
- 構成:
  ```
  FilesToolbar       (上端、固定)
  FilesBreadcrumbs   (固定)
  FilesSelectionHeader / FilesPasteBar (条件付き)
  FilesList          (overflow-y: auto)
  FilesBulkActionBar (条件付き、下端)
  ```
- Loading 時は SessionsListPanel と同じスケルトン pattern (既存 `SkeletonRows` があれば流用、無ければ inline で OK — Phase 2a 既存の loading 表現に合わせる)

### 4.5 `FilesViewerPane.tsx` (右ペイン root)

- `useFilesPreviewStore` を購読
- `selectedKind` で分岐:
  - `null` → `<FilesViewerEmpty />`
  - `'text'` → `<FilesTextViewer />` または `isEditing` で `<FilesEditor />`
  - `'image'` → `<FilesImageViewer />`
  - `'markdown'` → `<FilesMarkdownViewer />` (rendered) または `<FilesTextViewer />` (source)
  - `'unsupported'` → `<FilesViewerEmpty mode="unsupported" />`
- ヘッダ `<FilesViewerHeader />` は常に上端に固定

### 4.6 `FilesEditor.tsx` (CodeMirror 6)

- `@uiw/react-codemirror` の `<CodeMirror>` を使用
- 言語拡張は `lib/languageForFilename.ts` 経由で動的選択
- ダーク/ライト切替は `useTheme()` から
- 保存は親 (`FilesViewerHeader`) から `onSave` prop。Editor 内部では `Cmd/Ctrl+S` のキーマップだけ提供 (`Prec.high(keymap.of([{ key: 'Mod-s', run: () => { onSave(); return true; } }]))`)
- `onChange` で `useFilesPreviewStore.setEditContent` を呼ぶ
- **Lazy load**: `const FilesEditor = React.lazy(() => import('./FilesEditor'))`

### 4.7 `FilesMarkdownViewer.tsx`

- `react-markdown` + `remark-gfm`
- Lazy load (同上)

### 4.8 アップロード

- `FilesToolbar` の Upload ボタン → `<input type="file" hidden ref multiple>` → `onChange` で各 file を順次 `uploadFile(file, currentPath)`
- `FilesUploadDropZone`: `FilesViewerPane` または `FilesSidebarPanel` 内に常時 mount される overlay。`dragenter`/`dragover` で表示、`drop` でファイル配列を取得 → upload
  - Drop は `/web/files` のときだけ有効化

### 4.9 ダウンロード

- `FilesViewerHeader` の Download ボタン
- `useAuthorizedBlobUrl(path, token)` で Blob URL を取得し、`<a href={blobUrl} download={filename}>` を programmatic click

---

## 5. テスト戦略

### 5.1 単体 (vitest)

- `lib/filesPath.test.ts`: buildEntryPath / getParentPath / buildBreadcrumbSegments
- `lib/filesSort.test.ts`: directories first + each sort mode
- `lib/filesFormat.test.ts`: formatFileSize / formatFileDate (locale を fix)
- `lib/languageForFilename.test.ts`: 拡張子マッピング (.ts → javascript, .py → python, etc.)
- `stores/files.test.ts`: 各 action の state mutation
- `stores/filesPreview.test.ts`: 同上
- `hooks/useAuthorizedBlobUrl.test.ts`: fetch mock + URL.createObjectURL/revokeObjectURL の確認

### 5.2 コンポーネント (vitest + RTL)

- 各コンポーネントの render + interactive 動作 (click / keydown / form submit)
- jsdom polyfill 既設 (`<dialog>`, `matchMedia`, etc.)

### 5.3 統合フロー (vitest + RTL)

- `flows/files-browse.test.tsx`: mount → 初期ロード → ディレクトリクリック → breadcrumbs 戻る
- `flows/files-edit.test.tsx`: ファイル選択 → preview → edit → save → toast
- `flows/files-mutations.test.tsx`: rename / delete / mkdir / new file
- `flows/files-clipboard.test.tsx`: 複数選択 → copy → 別ディレクトリ paste
- `flows/files-upload.test.tsx`: file input → upload → list 更新

### 5.4 E2E (Playwright)

ポート 18800-18810 を予約 (Phase 2a/2b は 18790-18794 を消費済み)。各 spec で fresh gateway を spawn。

- `files-browse.spec.ts`: `/web/files` 開く → ホームディレクトリのファイル一覧表示 → サブディレクトリへ navigate → breadcrumbs クリックで戻る
- `files-preview.spec.ts`: テキストファイル選択 → 内容表示
- `files-edit-save.spec.ts`: 編集 → Cmd+S → toast 表示 → 再 fetch で永続化確認
- `files-rename-delete.spec.ts`: 一時ファイル作成 → rename → delete (Confirm dialog 経由)
- `files-mkdir.spec.ts`: New folder → 名前入力 → 作成確認
- `files-copy-paste.spec.ts`: ファイル選択 → copy → 別ディレクトリへ paste
- `files-upload-download.spec.ts`: 小さいファイル upload → download (Blob URL チェック)

### 5.5 既存テストへの影響

- Phase 2b の Sidebar test (Sidebar.test.tsx:131-132) で `expect(filesTab).toBeDisabled()` と `expect(filesTab.getAttribute('title')).toMatch(/Phase 2c/)` がある
- Phase 2c で Files タブを有効化するため、これらの assertion を **更新**:
  - `expect(filesTab).not.toBeDisabled()`
  - `title` 属性は削除
  - 新規 assertion: 「Files タブクリックで `/web/files` にナビゲートする」
- App.tsx の `/web/files` Navigate を削除するため、関連 routing test があれば見直し
- `settings-tab.spec.ts` の TerminalPane mount preservation 関連は現状維持 (Files への切り替えは想定外、Sessions ↔ Settings の往復のみ検証)

---

## 6. パフォーマンス・セキュリティ・UX

### 6.1 パフォーマンス

- 大きなディレクトリ (1000+ ファイル) は **virtualization なし** で OK (Mobile も全 entries を FlatList で render してる; 将来 react-virtuoso 等を検討)
- CodeMirror / react-markdown は lazy split (`React.lazy` + `Suspense`)
- 画像 preview は Blob URL を `useEffect` cleanup で必ず `URL.revokeObjectURL`

### 6.2 セキュリティ

- Gateway 側のホームディレクトリ限定 + symlink resolve は既存通り (`packages/gateway/src/services/filesystem.ts`)
- Web 側は Bearer token を localStorage に保持 (Phase 2a 既存パターン)
- `<img>` の src を Blob URL にすることで Authorization ヘッダ問題を回避
- file 名・パスをそのまま innerHTML する箇所は無し (React の自動エスケープに任せる)
- markdown は `react-markdown` のデフォルト (HTML 無効) を使い、生 HTML は許可しない

### 6.3 UX 細部

- Loading 中は SkeletonRows (Phase 2a 既存パターン)
- Error は inline ErrorState (Phase 2a 既存)
- Toast は `useUiStore.pushToast` を流用 (Phase 2a 既存)
- Confirm dialog は `useUiStore.showConfirm` を流用 (Phase 2a 既存)
- 編集中に未保存のままファイル切替 / route 離脱 → `unsavedChangesTitle` で確認 dialog
- 並び替えは小さい popover (`<details>`) + ラジオで OK (Mobile の ActionSheet 相当)

---

## 7. リスク・未決事項

| リスク | 対策 |
|--------|------|
| CodeMirror のバンドルサイズ (~300KB+) | lazy import + chunk 分割で初期画面に影響しないようにする |
| TerminalPane unmount による xterm 状態消失 | Phase 2d で hidden 戦略を再評価 (Spec 2.1 に記載) |
| Drag&drop の zone が広すぎ/狭すぎ | 初期実装は FilesViewerPane 全面 + dragOver 中だけ overlay 表示で様子見 |
| Phase 2b の wrappedClient 非 memoize 問題 | Phase 2c で再現するが、Phase 2c 内では fix しない (Phase 2b の retrospective に追加) |
| Markdown の XSS | react-markdown の rehype-raw を **使わない** + `transformLinkUri` で `javascript:` を除外 |
| 多 byte ファイル名のパンくず幅 | CSS で `text-overflow: ellipsis` + `max-width` で対応 |

---

## 8. 受け入れチェックリスト

- [ ] `/web/files` にアクセス → ホームディレクトリ一覧表示
- [ ] サブディレクトリに navigate → breadcrumbs 表示 + 戻るボタン
- [ ] ソート切替 (4 mode) が動く
- [ ] 隠しファイル表示トグルが動く
- [ ] テキストファイルクリック → preview 表示
- [ ] 画像ファイルクリック → image preview 表示
- [ ] markdown ファイルクリック → rendered/source 切替可能
- [ ] バイナリ等 → 「プレビューできない」表示 + ダウンロードリンク
- [ ] テキストファイルを編集 → Cmd+S 保存 → toast → 永続化
- [ ] 新規ファイル作成 → 内容入力 → 保存 → list に出現
- [ ] 新規フォルダ作成
- [ ] リネーム
- [ ] 削除 (single + bulk、destructive confirm dialog 経由)
- [ ] 詳細表示 (size / modified / permissions)
- [ ] 選択モード進入 → 複数選択 → bulk delete/copy/cut
- [ ] copy → 別ディレクトリ paste で複製
- [ ] cut → 別ディレクトリ paste で移動
- [ ] アップロード (ファイルピッカー)
- [ ] アップロード (drag&drop)
- [ ] ダウンロード
- [ ] i18n (en/ja) 切替で Files 関連文字列が切り替わる
- [ ] Sidebar の Files タブ enable + active highlight
- [ ] Sessions ↔ Files ↔ Settings 切替が壊れない
- [ ] 既存 vitest スイート全 pass
- [ ] 既存 Playwright E2E 全 pass
- [ ] 新規 vitest テスト全 pass
- [ ] 新規 Playwright E2E 全 pass
- [ ] type-check / build clean

---

## 9. 段階分け (sub-phases) と概算

| Sub-phase | 内容 | task 概算 |
|-----------|------|-----------|
| 2c-1 | Foundation: API client + lib/utils + stores + types | 8 |
| 2c-2 | Sidebar Files panel basic (browse + breadcrumbs + sort + hidden) | 10 |
| 2c-3 | Right pane viewer (text + image + markdown) | 7 |
| 2c-4 | Editor (CodeMirror) + save flow + unsaved guard | 6 |
| 2c-5 | Mutation actions (rename / delete / mkdir / new file) | 8 |
| 2c-6 | Selection mode + clipboard (copy/cut/paste) | 6 |
| 2c-7 | Upload (picker + drag&drop) | 4 |
| 2c-8 | Download | 2 |
| 2c-9 | i18n + Sidebar enable + AuthenticatedShell 分岐 + 既存テスト更新 | 4 |
| 2c-10 | Playwright E2E + final review + 完了タグ | 7 |
| **合計** | | **~62 タスク** |

> 注: 1 ブランチで 60+ タスクは Phase 2b (35) より大きいが、各タスクは小さい (10-20 分目安)。subagent-driven で連続実行する想定。

---

## 10. 参考

- Mobile FilesPanel: `/home/server/projects/zenterm/app/src/components/layout/FilesPanel.tsx` (1630 行) — 設計の元ネタ
- Gateway Files API: `packages/gateway/src/routes/files.ts` + `packages/gateway/src/services/filesystem.ts`
- Gateway Upload API: `packages/gateway/src/routes/upload.ts`
- Phase 2b Spec: `docs/superpowers/specs/2026-05-10-pc-web-phase-2b-design.md`
- Phase 2b Plan: `docs/superpowers/plans/2026-05-10-pc-web-phase-2b.md`
- AuthenticatedShell: `packages/web/src/components/AuthenticatedShell.tsx`
- Sidebar: `packages/web/src/components/Sidebar.tsx`
