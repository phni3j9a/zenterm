# PC (Web) 版 ZenTerm 設計

> 作成日: 2026-05-09
> 状態: ブレスト完了 / 実装プラン未着手
> 関連リポジトリ: phni3j9a/zenterm（server）, phni3j9a/zenterm-app
> 前提仕様: `app/docs/superpowers/specs/2026-05-07-ipad-multi-platform-design.md`

## 背景と目的

ZenTerm の PC ブラウザ版を再構築する。

旧 `packages/web`（React + Vite + xterm.js, Phase 1〜7 完成）は 2026-05-06 に削除済み。「中途半端な Web 実装が AI を引っ張ってしまう」「UI/UX とコンセプトをモバイルと揃えたかった」という理由で、まっさらに戻して綺麗に作り直す方針。

iPad 対応（2026-05-07 spec）の延長として、iPad regular レイアウト（Sidebar + TerminalPane の Master-Detail）の **設計の型**を React で書き直す。コードは共有しないが、構造・トークン・API・i18n は写す。

PC は物理キーボード前提で iPad より広い画面を持つので、以下を PC 固有として加える:
- プリセット 5 種のマルチペイン（最大 4 ペイン、splitter ドラッグ可変）
- キーボードショートカット / Command Palette / 右クリックメニュー / ホバー
- D&D ファイルアップロード / URL ディープリンク / ターミナル内検索

## スコープ

### In scope（v1）

- `server/packages/web` パッケージ新規作成（React + Vite + TS + zustand + xterm.js）
- Gateway が `/web/*` で SPA を配信（既存 `/`, `/embed/terminal`, `/api/*`, `/ws/*`, `/lp/*`, `/support.html` は無変更）
- Gateway 起動時ログに `Web URL` を追加表示、`zenterm-gateway info` / `qr` サブコマンドを追加
- 認証: 4桁 token をログイン画面で入力 → `/api/auth/verify` → localStorage 保存
- 機能パリティ: Sessions / Files / Settings / Terminal（モバイル iPad と同等）
- マルチペイン: プリセット 5 種（1 / 2列 / 3列 / 2×2 / 主+副2）+ splitter ドラッグ可変
- PC 機能 8 項目: KB ショートカット / Command Palette / 右クリック / Sidebar ドラッグ可変 / D&D アップロード / URL ディープリンク / ホバー / ターミナル内検索

### Out of scope（v2 以降）

- マルチサーバー UI（Web は 1 Gateway = 1 SPA = 1 タブの構造的単一サーバー。複数 Gateway はブラウザのタブ/ブクマで管理）
- Cloudflare 等 CDN 配信（同 SPA の追加配信先として将来検討。HTTPS Gateway が前提条件のため v2 以降）
- PWA インストール / Service Worker / オフライン
- デスクトップ通知（ジョブ完了検出ロジックが難しい）
- SpecialKeys 縦バー / ChatMode（モバイル入力補助なので PC 不要）
- ペイン分割の自由ツリー（tmux 流）/ ドラッグ&ドロップでのペイン構成変更（VS Code 流）
- ターミナル本体の PC 専用機能拡張（必要になったら直マウントは v1 で済んでいるので拡張可能）

### 触らないもの

- `server/packages/gateway` の既存 API / WebSocket 仕様 / ルート（`/web/*` 追加と起動ログ表示と CLI サブコマンド以外）
- `server/packages/gateway/public/terminal/index.html`（モバイル WebView 用）
- `server/packages/shared/src/` の API 型・トークン（追加は OK、変更不可）
- `app/`（モバイルアプリ）配下のすべて
- `docs/roadmap.md` の「触らないもの」に列挙された配信物

## 設計原則

1. **設計の型を写す、コードは共有しない**: iPad の `AdaptiveLayout` / `Sidebar` / `TerminalPane` / `paneStore` の構造を React で書き直す。RNW（React Native Web）は再導入しない（旧 `packages/web` 削除と Expo Web ターゲット削除の方針を尊重）。

2. **width ベースの form factor 判定**: `useFormFactor()` を写す（`width >= 768 → 'regular'`）。デバイス判定（`Platform.isPad` 等）は使わない。PC は実質常に regular だが、ブラウザ幅縮小時 (< 768) は compact 用の最小レイアウトにフォールバック。

3. **`/embed/terminal` 互換を保つ**: モバイル WebView 用 HTML / WebSocket 仕様は変更しない。PC は xterm.js を直接マウントして同じ `/ws/terminal` プロトコル（shared 型）に話す。

4. **同一オリジン前提のシンプル設計**: SPA は配信元 Gateway と同一オリジン。CORS / Mixed Content の心配なし。マルチサーバーは構造的に存在しない（v2 で Cloudflare 配信時に対処）。

5. **既存判断との整合**: shared 型（`@zenterm/shared`）、i18n キー、テーマトークンを mobile と共有。新規追加 OK、既存変更は app 側影響を確認してから。

## アーキテクチャ

### スタック

- **フロントエンド**: TypeScript + React 19 + Vite + zustand + i18next + react-router + xterm.js v6 + addons（fit / unicode11 / web-links / search / clipboard）
- **ファジー検索**: fuse.js（Command Palette 用）
- **テスト**: Vitest + React Testing Library（unit/component）、Playwright（E2E）
- **共通**: `@zenterm/shared`（既存）

### ディレクトリ追加

```
server/
├── packages/
│   ├── gateway/                          (既存)
│   │   ├── public/
│   │   │   └── web/                      ← Vite ビルド出力先（gateway が静的配信）
│   │   └── src/
│   │       ├── index.ts                  (showPairingInfo に Web URL 追記)
│   │       ├── cli.ts                    (info / qr サブコマンド追加)
│   │       └── routes/
│   │           └── web.ts                ← 新規: /web/* SPA fallback
│   ├── shared/                           (既存・無変更〜微増)
│   └── web/                              ← ★ 新規パッケージ
│       ├── package.json
│       ├── vite.config.ts                (build outDir: ../gateway/public/web)
│       ├── index.html
│       ├── tsconfig.json
│       ├── public/
│       │   └── favicon.ico
│       └── src/
│           ├── main.tsx
│           ├── App.tsx                   (router root)
│           ├── routes/
│           │   ├── login.tsx
│           │   ├── sessions.tsx
│           │   ├── files.tsx
│           │   └── settings.tsx
│           ├── components/
│           │   ├── layout/
│           │   │   ├── AdaptiveLayout.tsx
│           │   │   ├── Sidebar.tsx
│           │   │   ├── TerminalPane.tsx
│           │   │   ├── SplitPane.tsx
│           │   │   ├── SessionsListPanel.tsx
│           │   │   ├── FilesPanel.tsx
│           │   │   └── SettingsPanel.tsx
│           │   ├── terminal/
│           │   │   ├── XtermView.tsx
│           │   │   └── SearchBar.tsx
│           │   ├── ui/
│           │   │   ├── Button.tsx
│           │   │   ├── Input.tsx
│           │   │   ├── Tooltip.tsx
│           │   │   ├── ContextMenu.tsx
│           │   │   ├── EmptyState.tsx
│           │   │   ├── SkeletonLoader.tsx
│           │   │   └── Toast.tsx
│           │   ├── CommandPalette.tsx
│           │   ├── LayoutSelector.tsx
│           │   ├── LoginForm.tsx
│           │   ├── SetupGuide.tsx
│           │   ├── ClaudeLimits.tsx
│           │   ├── CodexLimits.tsx
│           │   └── SystemStatus.tsx
│           ├── stores/
│           │   ├── auth.ts               (token, currentGateway)
│           │   ├── sessions.ts
│           │   ├── sessionView.ts
│           │   ├── pane.ts
│           │   ├── sidebar.ts
│           │   ├── layout.ts             (splitter ratios, sidebar width)
│           │   └── settings.ts           (theme, language, fontSize)
│           ├── api/
│           │   ├── client.ts             (REST + Bearer)
│           │   ├── events.ts             (/ws/events 購読)
│           │   └── errors.ts
│           ├── lib/
│           │   ├── terminalProtocol.ts   (WS 型)
│           │   ├── imeDedup.ts
│           │   ├── reconnectBackoff.ts
│           │   ├── shortcuts.ts          (KB マッピング)
│           │   ├── paneLayout.ts         (5 種レイアウトのジオメトリ)
│           │   └── url.ts                (deep link routing helpers)
│           ├── theme/
│           │   ├── tokens.ts             (colors / typography / spacing — app/src/theme/tokens.ts を写す)
│           │   ├── terminalColors.ts     (xterm 用 ANSI パレット — embed/terminal の themes を移植)
│           │   └── index.ts
│           ├── hooks/
│           │   ├── useFormFactor.ts
│           │   ├── useShortcuts.ts
│           │   ├── useContextMenu.ts
│           │   └── useResizeObserver.ts
│           └── i18n/
│               ├── index.ts
│               └── locales/              (en / ja / es / fr / de / pt-BR / zh-CN / ko の 8 言語)
```

### Gateway 側の追加・変更

**新規ルート** (`server/packages/gateway/src/routes/web.ts`)
- `GET /web/*` → `public/web/index.html` を返す（client-side router 用 SPA fallback）
- `GET /web/assets/*` → `public/web/assets/*` を Cache-Control で配信
- 認証は不要（ページ自体は公開、API 呼び出し時に認証）

**`showPairingInfo()` 改修** (`server/packages/gateway/src/index.ts`)
```diff
  console.log(`  LAN:       http://${lan}:${config.PORT}`);
+ console.log(`  Web (LAN): http://${lan}:${config.PORT}/web`);
  console.log(`  Tailscale: http://${tailscale}:${config.PORT}`);
+ console.log(`  Web (Ts):  http://${tailscale}:${config.PORT}/web`);
  console.log(`  Token:     ${config.AUTH_TOKEN}`);
```
※ Web URL に token は含めない（ログイン画面で入力）

**CLI サブコマンド追加** (`server/packages/gateway/src/cli.ts`)
- `zenterm-gateway info`: 現在の `.env` + `os.networkInterfaces()` から URL / Token / QR を再構成して表示
- `zenterm-gateway qr`: QR だけ再表示
- 実装は `showPairingInfo()` を export して再利用

**互換性**
- 既存ルート全部温存
- モバイル WebView (`/embed/terminal`) 影響なし
- `npm publish` での npm 公開版に含まれる必要あり

### データフロー

```
Browser
  ├─ http://gateway:18765/web → SPA load (Vite bundle)
  ├─ /web/login → 4桁 token 入力 → POST /api/auth/verify
  ├─ ストア初期化（zustand persist 復元 + useServersStore (single)）
  ├─ /ws/events?token=xxx 接続（events 用 WS 1 本）
  ├─ Sessions 一覧 取得 (REST)
  ├─ ペインで terminal 開く → /ws/terminal?sessionId=...&windowIndex=...&token=xxx
  └─ Settings 操作 → REST + UI 更新
```

## 認証 & 起動フロー

### URL 設計

- **Web URL**: `http://{ip}:{port}/web` （token は含まない）
- **モバイル QR URL**: `zenterm://connect?url=...&token=xxx` （変更なし）
- **API**: `http://{ip}:{port}/api/*` （変更なし）
- **WebSocket**: `ws://{ip}:{port}/ws/*?token=xxx` （変更なし）

### ブートストラップ

```
1. main.tsx: createRoot(<App />)
2. App.tsx 初期化:
   - i18n (localStorage の lang)
   - theme (localStorage の theme or prefers-color-scheme)
   - useAuthStore.hydrate()
3. ルーティング判定:
   ├─ localStorage に token あり → GET /api/auth/verify
   │     ├─ 200 → /web/sessions へ
   │     └─ 401 → token 削除 → /web/login へ
   └─ token なし → /web/login へ
4. Login 画面: 4桁 token 入力 → POST /api/auth/verify
   ├─ 200 → useAuthStore.set({ token, gateway: window.origin }) → /web/sessions
   └─ 401/エラー → "Token が違います" 表示、リトライ
5. /web/sessions:
   - listSessions / /ws/events 接続
   - Sidebar + TerminalPane 描画
```

### Settings の Gateway 表示

```
Settings > Gateway
  ┌─────────────────────────────────────┐
  │  Connected to                       │
  │  http://10.203.100.26:18765        │
  │                                     │
  │  Token: ••••                        │
  │                                     │
  │  [Web URL をコピー]                  │
  │  [モバイル用 QR を表示]               │
  │  [Token を再入力]                    │
  │  [Logout]                           │
  └─────────────────────────────────────┘
```

- "Web URL をコピー": `${origin}/web` をクリップボードへ
- "モバイル用 QR": `zenterm://connect?url=...&token=...` の QR を表示（モバイルにペアリング誘導）
- "Token を再入力": Login 画面に戻る
- "Logout": localStorage クリア → Login へ

## レイアウト & ペイン

### form factor 判定

iPad spec と同じ `useFormFactor()` を写す:
- `width >= 768 → 'regular'`
- `< 768 → 'compact'`

PC は通常 regular。Stage Manager 風の狭窓やブラウザを縮めた状態は compact にフォールバック（Sidebar 全画面 / TerminalPane 全画面の切替）。

### regular レイアウト

```
┌─────────────────┬─────────────────────────────────────────────┐
│                 │ ◀ zen_dev · w0:main   +  ⊟▾   ●            │ ← Toolbar
│   Sidebar       ├─────────────────────────────────────────────┤
│   320px         │                                              │
│   (drag可変)     │                                              │
│                 │       Multi-pane area                        │
│   Sessions      │       (1〜4 ペイン、レイアウト次第)            │
│   ▼ zen_dev (3) │                                              │
│     · w0:main   │                                              │
│     · w1:test   │                                              │
│     · w2:logs   │                                              │
│     zen_ops     │                                              │
│   + 新規         │                                              │
│                 │                                              │
│ [⌘][📁][⚙]    │                                              │
└─────────────────┴─────────────────────────────────────────────┘
```

### Sidebar

- 上部: アクティブパネルの内容（Sessions / Files / Settings 切替）
- 下部: 3 アイコン bottom nav
- 幅: デフォルト 320px、240〜480px の範囲でドラッグ可変、`useLayoutStore` に persist
- 折りたたみ: ⌘B または toolbar の ◀ ボタン

### TerminalPane Toolbar

- ◀ Sidebar 折りたたみトグル
- セッション・window 名（テキストのみ、タブ列はなし — iPad 完全踏襲）
- `+` 新規 window 追加（focus pane の session に作成）
- `⊟▾` レイアウト切替メニュー（5 種から選択）
- `●` 接続ステータスドット（focus pane のもの）

### プリセットレイアウト 5 種

| キー | 構造 | splitter | 用途 |
|---|---|---|---|
| `single` | 1 ペイン | なし | デフォルト |
| `cols-2` | 縦 2 列 | 縦 1 本 | 横並び比較 |
| `cols-3` | 縦 3 列 | 縦 2 本 | 3 つを横並び |
| `grid-2x2` | 2×2 グリッド | 縦 1 本 + 横 1 本（行/列共通） | 4 つを並列稼働 |
| `main-side-2` | 主 + 副 2 段 | 縦 1 本（主/副）+ 横 1 本（副の上下） | 1 つを大きく見つつサブ 2 |

- 切替は toolbar `[layout ▾]` から
- splitter ドラッグで比率変更、最小幅 320px、比率は `useLayoutStore` に persist
- ペイン数が減る切替（例: `grid-2x2` → `single`）は focus 中の pane を残し、他は close

### paneStore

```ts
type PaneTarget = { sessionId: string; windowIndex: number };

type LayoutMode = 'single' | 'cols-2' | 'cols-3' | 'grid-2x2' | 'main-side-2';

// layout ごとの slot 数 (single=1, cols-2=2, cols-3=3, grid-2x2=4, main-side-2=3)
const SLOT_COUNT: Record<LayoutMode, number> = {
  'single': 1, 'cols-2': 2, 'cols-3': 3, 'grid-2x2': 4, 'main-side-2': 3,
};

interface PaneState {
  layout: LayoutMode;
  panes: (PaneTarget | null)[];          // 長さ = SLOT_COUNT[layout]
  focusedIndex: number;                  // 0 ≤ idx < panes.length
  ratios: Record<LayoutMode, number[]>;  // splitter 比率（persist）
}
```

### Sidebar 操作とペインの関係

- セッション行クリック / window 行クリック → focusedIndex のペインに開く
- 同 (sessionId, windowIndex) が他ペインで既に開かれている場合: window 行を ⛔ + グレーアウト
- 右クリック → "別のペインで開く" メニュー → ペイン番号選択

### Files / Settings パネル

- iPad 同様 Sidebar 内に表示
- Files 選択 → TerminalPane の領域に内容を表示（master-detail）
- Sessions タブ以外を選択中はペイン分割を一時的に解除（`single` に戻す）。Sessions に戻ると分割を復元（iPad ルール踏襲）

## ターミナルクライアント

### XtermView

1 ペイン = 1 XtermView インスタンス = 1 xterm.Terminal + 1 WebSocket。

```ts
interface XtermViewProps {
  sessionId: string;
  windowIndex: number;
  isFocused: boolean;
  fontSize: number;
  theme: 'dark' | 'light';
  onStatusChange: (s: TerminalStatus) => void;
  onSessionInfo?: (s: TmuxSession) => void;
}
```

### xterm.js セットアップ

- `Terminal({ allowProposedApi: true, scrollback: 5000, fontFamily, fontSize, theme })`
- Addon: FitAddon / Unicode11Addon / WebLinksAddon / SearchAddon / ClipboardAddon
- テーマ: `theme/terminalColors.ts` の dark / light パレット（`embed/terminal` の themes を TS 移植）

### WebSocket 通信

- 接続: `wss?://{host}/ws/terminal?sessionId=...&windowIndex=...&token=...`
- プロトコル: shared 型 `ClientMessage` / `ServerMessage` 完全準拠
  - C→S: `input` / `resize` / `signal`
  - S→C: `output` / `sessionInfo` / `exit` / `error`
- `term.onData(data) → ws.send({type:'input', data})`
- `ws.onmessage({type:'output'}) → term.write(data)`

### IME dedup

`embed/terminal` の `_imeLastData` / `_imeLastTime` / `_IME_DEDUP_MS = 100` を TS 移植。`compositionend` + `input` の二重発火を 100ms 以内の同一データで抑止。

### 自動再接続

`embed/terminal` と同じ:
- 初回 1 秒 → 倍々 → 上限 30 秒、最大 20 回
- ペイン下部に "再接続中 N/20" ステータス表示
- 上限到達後は "クリックで再接続" 待機

### リサイズ

- `ResizeObserver` でペイン要素サイズ変化を検知
- `fitAddon.fit()` → `ws.send({type:'resize', cols, rows})`
- ウィンドウリサイズ / splitter ドラッグ / Sidebar 開閉すべてに追従

### フォーカス管理

- `isFocused === false` → `term.options.disableStdin = true`
- ペインクリック → `paneStore.setFocusedIndex(idx)`
- 親側 KeyboardEvent listener が `Cmd/Ctrl/Alt + 既定キー` を capture-phase で intercept → preventDefault → アプリ処理

### スクロールバック検索 (⌘F)

- `SearchAddon` をラップ
- ⌘F でフォーカスペイン上部に検索バー（sticky）
- 大文字小文字 / 正規表現 / 単語境界

### ライフサイクル

```
mount: Terminal 作成 → addon 装着 → DOM 装着 → fit → WS connect
update (windowIndex/sessionId 変化): WS 再接続 (term.reset() + new WebSocket)
update (isFocused): disableStdin 切替
unmount: WS close (1000) → term.dispose()
```

## PC 特有機能（8 項目）

### 1. キーボードショートカット

`hooks/useShortcuts.ts` がグローバル keydown を capture phase で listen。プラットフォーム別マッピング（macOS ⌘ / others Ctrl）。

| キー | アクション |
|---|---|
| ⌘T | focus pane の session に新 window |
| ⌘W | focus pane の現 window 削除（確認ダイアログ） |
| ⌘1〜9 | focus pane 内の window 切替 |
| ⌘[ / ⌘] | ペイン index 移動（focus 切替） |
| ⌘\ | レイアウト切替メニュー |
| ⌘K | Command Palette |
| ⌘F | ターミナル内検索 |
| ⌘B | Sidebar 折りたたみ |
| ⌘, | Settings パネル |

### 2. Command Palette

`components/CommandPalette.tsx`:
- ⌘K で全画面オーバーレイ + 入力欄
- ファジー検索（fuse.js）
- アクション: セッション/window へジャンプ、create session、layout 変更、theme 切替、settings、files

### 3. 右クリックメニュー

`components/ui/ContextMenu.tsx`:
- カスタム実装（`onContextMenu={preventDefault}` してから React で描画）
- 出現箇所: Sidebar 全行（rename / delete / open in pane …）、ターミナルエリア（copy / paste / search / new pane …）

### 4. Sidebar / ペイン splitter ドラッグ可変

- splitter は `<div>` を `cursor: col-resize / row-resize`、pointermove で width/height state 更新
- 最小幅 240px (sidebar) / 320px (pane)、最大 480px (sidebar)
- 比率は `useLayoutStore` (zustand persist) で localStorage 保存

### 5. D&D ファイルアップロード

- Files パネル: `onDragOver` / `onDrop` で表示中ディレクトリにアップロード
- ターミナルエリア: ドロップでセッションの cwd にアップロード（ホバー中ガイド表示）
- 既存 `POST /api/upload` (multipart) 利用、進捗バー + 完了トースト

### 6. URL ディープリンク

react-router で:
- `/web/login` → ログイン画面
- `/web/sessions` → デフォルト
- `/web/sessions/:id` → セッション開く
- `/web/sessions/:id/window/:index` → window 指定
- `/web/files/:path*` → Files パネルでパス開く
- `/web/settings`, `/web/settings/gateway` → Settings 内サブセクション

ペイン分割状態は long URL になるので fragment で圧縮。

### 7. ホバーツールチップ

`components/ui/Tooltip.tsx`:
- アイコンボタン全般、status dot、session 行の path 全表示
- 500ms 遅延、ARIA `aria-describedby` 対応

### 8. ターミナル内検索

xterm SearchAddon ラップ、⌘F でフォーカスペイン上部に input + Next/Prev/オプション。

## デザイントークンと i18n

### トークン

- `theme/tokens.ts`: colors / typography / spacing / radii — `app/src/theme/tokens.ts` を写す
- `theme/terminalColors.ts`: xterm 用 ANSI パレット — `embed/terminal/index.html` の `themes.dark` / `themes.light` オブジェクトを TS 移植
- `breakpoints` / `layout` は `@zenterm/shared` から import（既存）

### i18n

- 8 言語（en / ja / es / fr / de / pt-BR / zh-CN / ko）
- `app/locales/*.json` を写し、PC 専用キーを追加（KB ショートカット、Command Palette、context menu、layout 名等）

## 段階的リリース

| Phase | 期間目安 | 内容 |
|---|---|---|
| Phase 1 | 2-3 日 | Gateway 改修（/web ルート, showPairingInfo, info/qr CLI）+ SPA 雛形 + 認証 + 単一ターミナル |
| Phase 2 | 3-4 日 | 機能パリティ単一ペイン（Sidebar 完成 / Files / Settings / 8 言語 / window 操作 / events 購読 / Claude/Codex Limits / SystemStatus） |
| Phase 3 | 2-3 日 | マルチペイン（paneStore + 5 レイアウト + splitter ドラッグ + 重複ガード） |
| Phase 4 | 3-4 日 | PC 機能 8 項目（KB / Command Palette / 右クリック / ドラッグ可変 / D&D / deep link / hover / 検索） |
| Phase 5 | 2-3 日 | ポリッシュ（a11y / パフォーマンス / エッジケース / ブラウザ互換 / docs / スクショ） |
| **合計** | **2-3 週間** | |

### ブランチ戦略

- 各 Phase で `feature/web-pc-phase-N` を server リポジトリに切る
- Phase 内は論理単位で複数 PR に分けて main へマージ
- Phase 完了時に動作確認 → tag 打ち（`web-pc-phase-N-done`）→ 次 Phase へ

## テスト方針

### ユニット

- Stores（`paneStore` / `auth` / `sessions` / `sessionView` / `sidebar` / `layout` / `settings`）
- Logic（`terminalProtocol` / `imeDedup` / `reconnectBackoff` / `urlAuth` / `shortcuts` / `paneLayout`）
- ツール: Vitest

### コンポーネント

- LoginForm / Sidebar / TerminalPane (toolbar) / SplitPane / XtermView / CommandPalette / ContextMenu / LayoutSelector / SetupGuide
- ツール: Vitest + React Testing Library

### 統合

- 起動ブートストラップ（token あり/なし両パス）
- ログイン成功/失敗
- WS 切断 → 再接続バックオフ
- イベント反映（events WS → ストア更新 → UI）
- ペイン分割 → window 切替
- 同 (s,w) 重複ガード

### E2E（Playwright、`server/tests/e2e/web/`）

- `login.spec.ts` / `sessions.spec.ts` / `terminal.spec.ts` / `pane-split.spec.ts` / `shortcuts.spec.ts` / `command-palette.spec.ts` / `files.spec.ts` / `deep-link.spec.ts` / `multi-pane-windows.spec.ts`
- 既存 server リポジトリの Playwright 設定を踏襲、CI で gateway を spawn してテスト

### 手動検証（Phase 5 完了時）

- ブラウザ互換: Chrome / Firefox / Safari、Edge は best-effort
- OS 別 KB: macOS ⌘ / Windows Ctrl / Linux Ctrl
- 高 DPI: Retina / 4K
- ネットワーク劣化: DevTools throttling Slow 3G で再接続バックオフ
- サスペンド/レジューム: ノート PC スリープ復帰で WS 自動再接続
- 同時接続: 4 ペイン + events = 5 WS、Gateway 上限 10 内
- 大量出力: `yes` 30 秒で描画追従 / メモリリークなし
- 特殊文字: UTF-8 / 絵文字 / CJK / ANSI escape

### iPad リグレッション防止

- iPad の既存 jest テスト（`app/src/components/layout/__tests__/`）は無変更
- `packages/shared/src/` を変更した場合は app 側 jest テストも回す
- `/embed/terminal` HTML / `/api/*` / `/ws/*` の振る舞い変化は許さない

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| 4 ペイン同時稼働でメモリ・帯域過負荷 | 操作不能 / Gateway 接続上限 | xterm scrollback を 5000 で制限、WS 上限 10 内に余裕、Phase 5 で `yes` 大量出力テスト |
| splitter ドラッグ中の xterm リフロー過負荷 | UI カクつき | `requestAnimationFrame` で fit を debounce、ドラッグ中は薄いオーバーレイで更新を抑止 |
| 同 (s,w) 重複が UI 操作で起きてしまう | tmux echo / 表示崩れ | `paneStore` の setter で衝突検証、UI でグレーアウト、E2E で固定検証 |
| ⌘W で誤って window 削除 | 作業ロスト | 確認ダイアログ必須、KB ショートカットで削除は確認をスキップしない |
| Token を URL に含めない設計 → 初回ログインが面倒 | 入り口 UX 悪化 | 4 桁数字なので入力 1 秒。localStorage 保存で 2 回目以降は自動 |
| /web/ 以下の SPA fallback がモバイル WebView の `/embed/terminal` と干渉 | モバイル接続不可 | パスが完全に分離（`/embed/*` vs `/web/*`）、Phase 1 で互換テスト |
| Gateway 古い + SPA 新しい のバージョンずれ | API 不整合 | SPA bootstrap で gateway version をチェック、不整合時は警告表示 |
| LAN HTTP のみのユーザーが「Web は HTTPS が必要」と誤解 | 採用阻害 | README に「同一 Gateway 配信なので HTTPS 不要」を明記、QR/install ガイドにも追記 |

## モバイルとの差分（明示）

| 観点 | モバイル | PC Web |
|---|---|---|
| 配布 | App Store の独立バイナリ | Gateway が `/web/*` で配信する SPA |
| マルチサーバー | 複数 Gateway をアプリ内で管理・切替 | 1 Gateway = 1 SPA = 1 タブ。複数はブラウザのタブ/ブクマで管理 |
| 認証 | QR スキャン → 自動ペアリング | 4 桁 token をフォームで入力、URL 共有のみで token は流さない |
| ターミナル描画 | WebView で `/embed/terminal` HTML | xterm.js を React 内に直接マウント |
| KB ショートカット | なし（タッチ前提） | ⌘T/W/1-9/\/K/F/B/, など |
| マルチペイン | 縦 2 分割のみ（regular のみ） | 5 種プリセット（最大 4 ペイン）、splitter ドラッグ可変 |
| Window 切替 | Sidebar expand / iPhone は WindowTabs + swipe pager | Sidebar expand のみ（タブ無し、iPad 完全踏襲） |
| SpecialKeys / ChatMode | あり | v1 では不要（物理キーボード前提） |

## Web 版第二弾（v2 候補）への参照ポイント

将来の v2 / Cloudflare 配信版が本仕様を参照する際:

- `/web/*` パスと `showPairingInfo` の Web URL 表示は維持
- `auth` ストアは「外部 URL からの token 注入」も受け付けられる shape にしておく（fragment `#token=xxx` 等）
- API クライアントの `gateway URL` は localStorage 駆動なので、SPA を Cloudflare に置いて Gateway URL を別経路で受け取る設計にも拡張可能
- ペイン状態 / 設定 / 言語等の persist key は origin 単位なので、Cloudflare 配信時は origin が変わる前提で migration 不要

## 留意点

- **`/embed/terminal` を変更しない**: モバイル WebView の互換維持。
- **shared 型は追加 OK / 変更不可**: 既存 `TmuxSession` / `ClientMessage` 等を破壊する変更は app 側影響を確認してから。
- **コードベース分岐の濫用を避ける**: `Platform.OS === 'web'` 等を新規導入しない（spec の精神）。
- **i18n キー**: 新規 UI 全部に i18n キーを追加、8 言語ファイル全部に展開。
- **CSP**: `Content-Security-Policy` で外部スクリプト禁止、xterm の WebGL レンダラ無効（XSS 対策）。
- **Logout / token 失効**: 401 を全 API レスポンスで検出して自動ログイン画面遷移。
