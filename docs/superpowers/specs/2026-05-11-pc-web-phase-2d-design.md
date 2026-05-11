# ZenTerm PC Web Phase 2d (TerminalPane mount 永続化 + Terminal UX 改善) — Design Spec

> 状態: Phase 2d 完了 (2026-05-11) — `web-pc-phase-2d-done` タグ付き

> Phase 2d: PC Web の TerminalPane を Files タブ往復で unmount しない構造に改修し、ターミナル UX を強化する。Phase 2c で deferred になっていた "TerminalPane 完全マウント保持" を回収する。

- 作成日: 2026-05-11
- 担当: Phase 2d
- 前提: Phase 2c 完了 (`origin/main` / `web-pc-phase-2c-done` タグ)
- ブランチ: `feature/web-pc-phase-2d`
- 完了タグ (予定): `web-pc-phase-2d-done`

---

## 1. ゴール / 非ゴール

### 1.1 ゴール

- **TerminalPane mount 永続化**: Files タブとの往復で xterm が unmount されない。Sessions に戻ると scrollback と PTY 接続が保持されている
- **接続状態 UX 改善**: ヘッダーに状態 badge (text + chip) + reconnecting カウントダウン + 手動 Reconnect ボタン
- **Copy / Paste + 右クリックメニュー**: 選択時の自動コピー (opt-in)、右クリックで Copy / Paste / Clear / Reconnect
- **ヘッダー改善**: 生 sessionId ではなく displayName + tmux window 名 [index] を表示。sessionId をクリップボードにコピーするボタン
- **フォントズーム**: Ctrl+ / Ctrl- / Ctrl+0 ショートカット + ヘッダー内 −/+ ボタン (Settings store の `fontSize` を駆動)
- **i18n (en / ja)**: 上記すべての文字列
- 既存 Phase 2a / 2b / 2c の機能 (Sessions / Settings / Files) を破壊しない

### 1.2 非ゴール (Phase 2d では実装しない)

- **session/window 単位の複数 keep-alive** (LRU 等): 1 active session のみ永続化する。Sidebar から別 session に切り替えた場合は xterm はそのままで WS のみ再接続 (現状挙動を踏襲)
- **scrollback 内検索** (@xterm/addon-search): Phase 2d スコープから除外 (オプション選択されず)
- **GPU レンダリング** (@xterm/addon-webgl / -canvas): 現状の DOM renderer のままで十分。負荷課題が出てから検討
- **session ごとの独立な scrollback DB / disk 永続化**: ブラウザ unload 時に scrollback は消える。tmux 側の history は別物
- **PWA / Service Worker**: 別 Phase
- **WebGL/canvas renderer 切替設定**: 別 Phase
- **xterm `serialize` addon でのスナップショット保存**: ブラウザリロード時の復元は YAGNI

### 1.3 success criteria

- `/web/sessions` で操作後 `/web/files` に切り替えて戻ってくると:
  - xterm 内 scrollback が保持されている
  - WebSocket がアクティブのまま (reconnect が発生していない)
  - フォーカスを戻すとそのままタイプ可能
- 接続切断時に Reconnect ボタンが表示され、押下で再接続が走る
- 右クリックメニューで Copy / Paste / Clear / Reconnect が動作する
- ヘッダーに displayName + window 名 [index] + sessionId copy ボタン + フォントズーム UI が表示
- Ctrl+= / Ctrl+- / Ctrl+0 がフォントサイズを変更する (Settings store と同期)
- Phase 2c までの vitest スイートが壊れない
- Phase 2c までの Playwright E2E が壊れない
- Phase 2d で追加する vitest 単体/統合テストが全部 pass する
- Phase 2d で追加する Playwright E2E (mount-preservation / reconnect / context-menu / font-zoom) が全部 pass する
- `npm run type-check` `npm run build` clean

---

## 2. アーキテクチャ概要

### 2.1 mount 永続化戦略

#### 採用: `display: none` + `isVisible` prop

現状 (`AuthenticatedShell.tsx:213-222`):

```tsx
{isFilesRoute ? (
  <FilesViewerPane client={filesClient} token={token} />
) : (
  <TerminalPane gatewayUrl=... token=... sessionId=... windowIndex=... />
)}
```

→ `isFilesRoute=true` 時に TerminalPane が unmount → XtermView の cleanup → `Terminal.dispose()` + `WebSocket.close(1000)`。Files から戻ると新しい xterm + 新しい WS が立ち上がる (scrollback 消失、PTY は tmux 側に残るが再 attach のため `term.reset()` で画面初期化)。

新構造:

```tsx
<div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
  <TerminalPane
    gatewayUrl=... token=... sessionId=... windowIndex=...
    isVisible={!isFilesRoute}
  />
  {isFilesRoute && <FilesViewerPane client={filesClient} token={token} />}
</div>
```

- `TerminalPane` は常時 mount。内部 root に `style={{ display: isVisible ? 'grid' : 'none' }}` を適用
- `FilesViewerPane` は Files route 時のみ mount (Files 側のリソースは引き続き unmount で開放)
- 両者は同じ flex item。Files が表示されている時は TerminalPane の DOM はあるが幅 0 (display:none)

#### display:none の罠への対処

xterm は container が display:none の間:
- ResizeObserver の通知が来ない (browser 側挙動)
- `fit()` を呼んでも 0×0 を測ろうとして無効化
- `term.write()` 自体は引き続き動作する (内部 buffer に書き込まれる)

→ **解決**: `XtermView` に `isVisible: boolean` prop を追加し、

1. `useEffect(..., [isVisible])` で `isVisible: false → true` に切り替わった時:
   - `requestAnimationFrame` で 1 回 `fit()` を呼ぶ (DOM が表示反映された次フレームで)
   - 新しい cols/rows が前回と異なれば `ws.send(encodeResize(cols, rows))` を送る
   - `term.focus()`
2. ResizeObserver は `isVisible: false` の間は早期 return (無駄な fit 呼びを避ける)
3. WebSocket は `isVisible` に関係なく接続維持 (PTY 出力は xterm buffer に積まれ続ける)

#### session / window 切替時の挙動 (現状踏襲)

- `useEffect(..., [gatewayUrl, token, sessionId, windowIndex])` の依存変化で WebSocket は再接続される
- xterm Terminal インスタンスは `useEffect(..., [])` で 1 回しか作られない (現状通り)
- 切替時に `term.reset()` が `ws.onopen` で呼ばれ、画面初期化 → 新セッションへ attach
- これは Phase 2d スコープ外: マルチ session 並列保持は YAGNI

### 2.2 接続状態 UX 改善

#### ヘッダー status badge (TerminalHeader 内)

| status         | chip 色             | 表示 text                                        | 補助 UI                            |
|----------------|---------------------|--------------------------------------------------|-------------------------------------|
| `connected`    | `colors.success`    | "接続中" / "Connected"                           | なし                                 |
| `reconnecting` | `colors.warning`    | "再接続中… N 秒後 (試行 a/20)"                    | Cancel ボタン (進行中の retry を停止) |
| `disconnected` | `colors.textMuted`  | "切断" / "Disconnected"                          | Reconnect ボタン                     |
| `error`        | `colors.error`      | "エラー: backoff 枯渇" / "Error: backoff exhausted" | Reconnect ボタン                     |

#### Reconnect 制御 (XtermView API 拡張)

- 新 prop: `reconnectNonce: number` — 値が変わったら強制再接続
  - 内部の `useEffect(..., [gatewayUrl, token, sessionId, windowIndex, reconnectNonce])` の依存に追加
  - `useEffect` 自身の cleanup で旧 WS は close (`1000`)、再 mount で connect 走る
- 新 prop (callback): `onReconnectInfo?: (info: ReconnectInfo | null) => void`
  - `ReconnectInfo`: `{ attempt: number; etaMs: number; exhausted: false }` または `null` (idle 時)
  - reconnecting セット時に呼ばれる。setTimeout 内で eta カウントダウンしたい場合は TerminalPane 側で `Date.now() + etaMs` を保持
- TerminalPane で `[nonce, setNonce] = useState(0)` を持ち、Reconnect ボタンクリックで `setNonce((n) => n + 1)`

#### Cancel reconnecting の意味

- reconnecting 中に Reconnect を押すと nonce++ で即時 retry が走る (待ち時間スキップ)
- Cancel は当面実装しない (UX 簡潔さ優先)。最初は Reconnect ボタンのみで OK

→ 上の表は更新: reconnecting 中は **Reconnect ボタン (= 「すぐ再接続」)** のみ表示

### 2.3 Copy / Paste + 右クリックメニュー

#### 自動コピー (opt-in)

- Settings store に `autoCopyOnSelect: boolean` を追加 (default: `false`)
- `XtermView` で `term.onSelectionChange(() => { ... })` を購読
- 選択が空でなく `autoCopyOnSelect: true` なら `navigator.clipboard.writeText(term.getSelection())`
- 失敗 (権限拒否等) は静かに無視 (toast でうるさくしない)

#### 右クリックメニュー

- xterm container を覆う div の `onContextMenu` で `e.preventDefault()` + メニュー位置 / 開閉 state を更新
- メニュー DOM はポータル風に `position: fixed` の絶対配置 (z-index 高)
- `Esc` / 外側クリック / メニュー項目クリックで close
- 項目:
  - **Copy** (選択ありの時のみ enabled): `navigator.clipboard.writeText(term.getSelection())`
  - **Paste**: `navigator.clipboard.readText().then(text => ws.send(encodeInput(text)))`
  - **Clear**: `term.clear()` (scrollback 消去)
  - **Reconnect**: nonce++ → `XtermView` 再接続

#### キーボードショートカット (xterm `attachCustomKeyEventHandler` 経由)

- `Ctrl+Shift+C`: copy (選択あり時のみ; 普通の `Ctrl+C` は SIGINT として透過)
- `Ctrl+Shift+V`: paste
- いずれも default 動作 (terminal にキー流し込む) を抑止

### 2.4 ヘッダー改善

#### 現状 (`TerminalPane.tsx:73-90`)

```
[sessionId]  · w[windowIndex]                       [status dot]
```

#### Phase 2d 後

```
[displayName]  [window名 #index]  [📋 ID]                [↺ Reconnect | font − 14 +]  [● Connected]
```

- **displayName**: `useSessionsStore` から `sessions.find(s => s.id === activeSessionId)?.displayName` で取得
  - fallback: 生 `sessionId` (sessions 未取得時)
- **window 名 [index]**: `session.windows[activeWindowIndex]?.name ?? ""` + `[w${index}]`
- **📋 ID** ボタン: クリックで `navigator.clipboard.writeText(sessionId)` + toast "Session ID copied"
- **font ズーム**: 後述 2.5
- **status badge**: 2.2

新 component: `packages/web/src/components/terminal/TerminalHeader.tsx`
- TerminalPane から切り出し (現状 inline)
- props: `{ sessionId, windowIndex, displayName, windowName, status, reconnectInfo, fontSize, onReconnect, onCopySessionId, onZoomIn, onZoomOut, onZoomReset }`

### 2.5 フォントズーム

#### Settings store 既存

`fontSize` は `MIN_FONT_SIZE=10` 〜 `MAX_FONT_SIZE=20` で `clampFontSize` 適用済み。`DEFAULT_FONT_SIZE=14`。

#### Phase 2d 追加

- ヘッダー内 zoom UI:
  - `−` ボタン (disabled if `fontSize <= MIN_FONT_SIZE`): `setFontSize(fontSize - 1)`
  - 現在サイズ表示 (例 `14`) — クリックで `setFontSize(DEFAULT_FONT_SIZE)` (リセット)
  - `+` ボタン (disabled if `fontSize >= MAX_FONT_SIZE`): `setFontSize(fontSize + 1)`
- xterm 内ショートカット (xterm `attachCustomKeyEventHandler`):
  - `Ctrl+=` / `Ctrl++`: zoom in
  - `Ctrl+-`: zoom out
  - `Ctrl+0`: reset to DEFAULT_FONT_SIZE
- フォント変更時に `XtermView` の既存 `useEffect(..., [resolvedTheme, fontSize])` で `fit()` が走る → resize イベント送信は ResizeObserver で発火する

---

## 3. 影響範囲

### 3.1 変更ファイル

| File | 変更内容 |
|------|----------|
| `packages/web/src/components/AuthenticatedShell.tsx` | TerminalPane を常時 mount + `isVisible` prop。FilesViewerPane を sibling で並列配置 |
| `packages/web/src/components/TerminalPane.tsx` | `isVisible` prop 受け、display:none 適用。Reconnect 状態を持ち、TerminalHeader へ委譲 |
| `packages/web/src/components/terminal/XtermView.tsx` | `isVisible` / `reconnectNonce` / `onReconnectInfo` props。表示復帰時の fit。Selection auto-copy。CustomKeyEvent (Copy/Paste/Zoom) |
| `packages/web/src/components/terminal/TerminalHeader.tsx` | **新規**: displayName + window 名 + ID copy + status badge + zoom UI + Reconnect ボタン |
| `packages/web/src/components/terminal/TerminalContextMenu.tsx` | **新規**: 右クリックメニュー (Copy / Paste / Clear / Reconnect) |
| `packages/web/src/stores/settings.ts` | `autoCopyOnSelect: boolean` + `setAutoCopyOnSelect` を追加 (persist) |
| `packages/web/src/components/settings/*` | Settings タブに `autoCopyOnSelect` トグル UI を追加 |
| `packages/web/src/i18n/locales/{en,ja}.json` | `terminal.*` namespace を拡張 |

### 3.2 新規依存

- `@xterm/addon-search` は **追加しない** (検索は非ゴール)
- 新規 npm 依存はゼロ

### 3.3 互換性

- Phase 2c の Files E2E は `/web/files` に navigate する経路を踏むため、TerminalPane が並列 mount された状態で Files が動作することを確認する必要あり
- 既存 `useSessionsStore` の `sessions` slice をヘッダーで購読することで、AuthenticatedShell 経由で props 伝播せずに済む (ただし TerminalPane 自身が store を購読する形に)
- `autoCopyOnSelect` の Settings persist の `version` を 1 → 2 に上げるか? — 既存ユーザーで undefined → false にデフォルト fallback されれば version 据え置きで問題ない (zustand persist は schema 不整合でも未定義キーを default 値にしない場合あり)。**安全側で `version: 2` + `migrate` を書く**
- フォントズームショートカットはブラウザ自体の `Ctrl++` (ページズーム) と衝突する可能性あり。**xterm container にフォーカスがある時のみ** intercept (CustomKeyEvent は xterm focus 時のみ呼ばれるため自然に達成される)

---

## 4. テスト戦略

### 4.1 vitest 単体 / 統合

- `XtermView.visibility.test.tsx` — `isVisible: false → true` の切替で fit + resize 送信 + focus が走ることを確認 (Terminal モック)
- `XtermView.reconnect.test.tsx` — `reconnectNonce` 増分で WS が close → 再 open することを確認
- `XtermView.autoCopy.test.tsx` — `autoCopyOnSelect: true` 設定下で `term.onSelectionChange` 発火時に `navigator.clipboard.writeText` が呼ばれる
- `XtermView.shortcuts.test.tsx` — `Ctrl+Shift+C` / `Ctrl+Shift+V` / `Ctrl+=` / `Ctrl+-` / `Ctrl+0` が CustomKeyEvent 経由で intercept される
- `TerminalHeader.test.tsx` — displayName 表示 / sessionId copy ボタン / status badge 色 / zoom 上下 disabled 境界
- `TerminalContextMenu.test.tsx` — 開閉、項目クリックで callback 起動、Esc で閉じる、外側クリックで閉じる
- `TerminalPane.reconnect.test.tsx` — Reconnect ボタンクリックで XtermView の reconnectNonce が増える (mock XtermView)
- `flows/AuthenticatedShell.terminalKeepAlive.test.tsx` — Files navigate 中も TerminalPane が DOM に存在すること、Files から戻った時に同じ XtermView インスタンスであること
- `stores/settings.test.ts` 拡張 — `autoCopyOnSelect` の get/set + persist round-trip + migration

### 4.2 Playwright E2E

ports: 18807 〜 で連番 (Phase 2c が 18800-18806)。各 spec は `mkdtempSync` で fresh HOME + Gateway を spawn。

- `tests/e2e/web/terminal-mount-preservation.spec.ts` (port 18807)
  - login → session 作成 → terminal 何か入力 → Files に切替 → Sessions に戻る → scrollback が保持されている
- `tests/e2e/web/terminal-reconnect.spec.ts` (port 18808)
  - login → session → Gateway 側 WS を強制 close (Playwright route ハック or サーバーリスタート) → "Reconnect" ボタンが見える → クリックで再接続される
- `tests/e2e/web/terminal-context-menu.spec.ts` (port 18809)
  - 右クリック → メニューが出る → Clear クリックで `term.clear()` 確認 (selector で空状態確認)
- `tests/e2e/web/terminal-font-zoom.spec.ts` (port 18810)
  - "+" ボタンクリックで font 表示 +1。Ctrl+= キーで +1。Ctrl+0 で DEFAULT_FONT_SIZE に戻る

### 4.3 jsdom polyfill

- `navigator.clipboard.writeText` / `readText` は jsdom 25 で undefined。`setupTests.ts` に既存ある場合はそのまま、無ければ `Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(), readText: vi.fn() } })` を追加
- xterm の `Terminal` mock — 既存の `vi.mock('@xterm/xterm', () => ({ Terminal: ... }))` パターン (Phase 2a の test を参照) を再利用

---

## 5. リスク & トレードオフ

### 5.1 display:none 中の xterm 内部状態

- xterm はバックグラウンドで `term.write()` を受け続け、内部 buffer に積む (これは xterm の通常挙動)
- 表示復帰時に何も操作せず buffer が反映されるはずだが、念のため reveal 時に明示的な `refresh(0, term.rows - 1)` を呼ぶケースが必要かもしれない
- → **実装後に動作確認**: 必要なら `refresh()` を追加

### 5.2 表示復帰時のサイズずれ

- Files 表示中にウィンドウサイズが変わっていた場合、reveal 時に新サイズで `fit()` → cols/rows が変わる → resize 送信
- tmux 側は最終 attach client のサイズを採用するが、複数 client (mobile + web) 同居時に競合する可能性
- → 既存仕様のまま (Phase 2c までと変わらない)

### 5.3 navigator.clipboard の available 性

- HTTPS 環境 + ユーザー操作起点でのみ動作
- Gateway のローカル開発 (`http://localhost`) でも `localhost` は secure context として扱われる
- file:// or 非 secure 環境では失敗する → toast で "クリップボード操作が拒否されました" を出す
- → エラーハンドリング: `await ... .catch(err => pushToast(...))`

### 5.4 ブラウザのページズームと Ctrl+= 衝突

- 上述 2.5 のとおり xterm focus 時のみ intercept されるため、ブラウザ側へは届かない
- ただし xterm focus が外れている時は通常通りページズーム動作。これは仕様

### 5.5 Settings persist migration

- `version: 1 → 2` に上げる
- `migrate(state, version)`: version 1 から来た state には `autoCopyOnSelect: false` を補完
- 既存ユーザーへの影響: 無し (自動 false fallback)

### 5.6 useSessionsStore 購読の追加先

- TerminalHeader が `displayName` / `windowName` を取るために `useSessionsStore` を購読
- store の sessions 配列が変わると TerminalHeader が re-render するが、`React.memo` + selector で active 1 件だけ取れば軽い
- → selector で `useSessionsStore((s) => s.sessions.find(...)?.displayName)` 形式

---

## 6. 実装サブフェーズ

| # | 内容 | 概算タスク数 |
|---|------|--------------|
| 2d-1 | mount 永続化 (XtermView `isVisible` prop + AuthenticatedShell 並列レイアウト) | 6 |
| 2d-2 | Reconnect ボタン (XtermView `reconnectNonce` + `onReconnectInfo` + TerminalPane 統合) | 5 |
| 2d-3 | TerminalHeader 切り出し + displayName + window 名 + sessionId copy ボタン | 5 |
| 2d-4 | フォントズーム (ヘッダー UI + xterm CustomKeyEvent ショートカット) | 4 |
| 2d-5 | Copy / Paste + 右クリックメニュー (TerminalContextMenu + Settings autoCopyOnSelect) | 6 |
| 2d-6 | i18n + Settings UI (autoCopyOnSelect トグル) | 3 |
| 2d-7 | Playwright E2E (4 spec) | 4 |
| 2d-8 | 最終検証 (type-check / build / 全 vitest / 全 e2e / merge prep) | 2 |

合計 約 **35 タスク**。Phase 2c (62) より小ぶり。

---

## 7. オープンクエスチョン

1. **`autoCopyOnSelect` のデフォルト**: `false` で確定 (侵襲的なので opt-in)。Settings UI 側で説明文を添える
2. **Cancel reconnecting ボタン**: 当面なし。Reconnect ボタンが「待ち時間スキップ」を兼ねる
3. **Reconnect 中の xterm 表示**: 現状は黒画面のまま (`term.reset()` が onopen で走るので)。reconnecting 中に xterm 上にオーバーレイ "Reconnecting..." を出すかは UX 改善の追加候補だが Phase 2d スコープから外す (ヘッダー表示で十分)
4. **multi-session keep-alive (LRU 等)**: Phase 2e 以降で再検討
5. **xterm `serialize` でブラウザリロード復元**: Phase 2e 以降で再検討

---

## 8. ロールバック戦略

- 機能ごとに細かくコミット (サブフェーズ単位)
- 問題発生時は該当サブフェーズの commit を `git revert`
- `feature/web-pc-phase-2d` ブランチ上で完結するため main には影響なし
- 完了タグ `web-pc-phase-2d-done` 付与後にも、必要なら revert PR を作る

---

## 9. ドキュメント

- 完了時にこのファイルの先頭に `> 状態: Phase 2d 完了 (YYYY-MM-DD) — web-pc-phase-2d-done タグ付き` を追記
- `docs/roadmap.md` に Phase 2d の項目を追加 (もし roadmap がそういう構造なら)
