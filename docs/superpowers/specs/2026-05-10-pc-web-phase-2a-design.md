# PC (Web) 版 ZenTerm Phase 2a 設計

> 作成日: 2026-05-10
> 状態: 設計確定 / 実装プラン未着手
> 親 spec: `docs/superpowers/specs/2026-05-09-pc-web-design.md`
> 前 phase: `docs/superpowers/plans/2026-05-09-pc-web-phase-1.md` (完了 — タグ `web-pc-phase-1-done`)

## 背景と目的

Phase 1 (Bootstrap) で「ログイン → セッション一覧 → 単一ターミナル動作」までが揃った。Phase 2a はこの上に、Sidebar の **CRUD と realtime 同期** を載せて単一ペインの機能パリティ基盤を作る。

親 spec § 段階的リリース で Phase 2 を 8 項目一括としていたものを、リスク低減のため `2a → 2b → 2c` の 3 段階に分割した。Phase 2a はその第 1 段で、後続が依存する**基盤**を担う。

## スコープ

### In scope (Phase 2a)

- **events 購読**: `/ws/events` WebSocket 接続、`sessions-changed` / `windows-changed` / `monitor-restart` イベントを sessions store に伝播
- **session 操作**: create / rename / delete (UI + API クライアント + ストア)
- **window 操作**: create / rename / delete (UI + API クライアント + ストア)
- **Sidebar 完成**: ホバー kebab メニュー、インライン編集、確認モーダル、トースト、空/ロード/エラー状態、`+ 新規セッション` フッター
- **Phase 1 残課題のうち 2 件**: XtermView の `onStatusChange` dep 安定化、`FONT_FAMILY` 重複の theme/tokens 集約

### Out of scope (Phase 2a)

- Files panel / Settings panel (Phase 2b)
- Claude Limits / Codex Limits / SystemStatus (Phase 2b)
- i18n 8 言語化 (Phase 2c)
- 右クリックメニュー (Phase 4)
- マルチペイン (Phase 3)
- KB ショートカット (Phase 4) — ただし inline edit / dialog 内の Esc / Enter は local handler で動かす

### 触らないもの

- Phase 1 で確定した API / WS プロトコル / `/embed/terminal`
- Gateway の既存 API ルート (Phase 2a で新規作成不要 — `/api/sessions/*` および window 操作 API は既存)
- shared 型の既存定義 (`TmuxEvent` の **追加移管**のみ)
- Phase 1 の認証フロー、persist key (`zenterm-auth`)

## 設計判断のサマリ

ブレストで確定した UX 上の 4 つの判断:

| 判断 | 採用 | 却下案 |
|---|---|---|
| rename/delete のトリガ | ホバー kebab メニュー | 右クリック前倒し / 編集モードトグル / 機能後回し |
| rename UX | インライン編集 | モーダル / ポップオーバー / ダブルクリック直起動 |
| delete 確認 | モーダル + window 数明示 | インライン confirm / トースト undo |
| state 更新方針 | API response で即反映 + events で refetch backup | events 単独 / optimistic + rollback / 手動 refresh |

## アーキテクチャ

### スタック追加

なし。Phase 1 のスタック (React 19 / Vite 6 / TypeScript 5.7 / zustand 5 / xterm.js v5.5+ / vitest 4 / Playwright 1.58) で完結。

modal / inline edit / popover / toast はすべて **自前実装**（軽量・依存最小化のため、headlessui / radix-ui 等は導入しない）。modal は HTML `<dialog>` 要素を使う。

### モジュール構成

```
packages/web/src/
├── api/
│   └── client.ts                          ← 拡張: createSession/renameSession/killSession/createWindow/renameWindow/killWindow
├── stores/
│   ├── sessions.ts                        ← 拡張: create/rename/remove/refetch アクション、merge ロジック
│   ├── sessionView.ts                     ← 既存 close() を fallback で使用 (拡張不要)
│   ├── events.ts                          ← 新規: { status, reconnectAttempt, lastEvent }
│   └── ui.ts                              ← 新規: { confirmDialog, toasts }
├── lib/
│   └── events/
│       ├── client.ts                      ← 新規: TmuxEventsClient (WS + heartbeat + reconnectBackoff 流用)
│       ├── parseEvent.ts                  ← 新規: TmuxEvent type narrow
│       └── __tests__/
├── hooks/
│   ├── useEventsSubscription.ts           ← 新規: SessionsRoute で 1 度だけ呼ぶ singleton effect
│   ├── useInlineEdit.ts                   ← 新規: enter/escape/blur 制御 + validate
│   └── __tests__/
├── components/
│   ├── ui/
│   │   ├── ConfirmDialog.tsx              ← 新規: <dialog> ベースのモーダル
│   │   ├── InlineEdit.tsx                 ← 新規: text input + Enter/Esc/blur + validate UI
│   │   ├── Toast.tsx                      ← 新規: 1 件のトースト
│   │   ├── ToastViewport.tsx              ← 新規: トースト集合の root portal
│   │   └── __tests__/
│   ├── sidebar/
│   │   ├── SessionRow.tsx                 ← 新規: 1 セッション行 (kebab 含む)
│   │   ├── WindowRow.tsx                  ← 新規: 1 window 行 (kebab 含む)
│   │   ├── RowActionsMenu.tsx             ← 新規: kebab popover [Rename, Delete]
│   │   ├── NewSessionButton.tsx           ← 新規: フッター "+ 新規セッション"
│   │   ├── NewWindowButton.tsx            ← 新規: WindowRow リスト末尾の "+ window"
│   │   └── __tests__/
│   ├── SessionsListPanel.tsx              ← リファクタ: SessionRow に委譲、ヘッダ + リスト + フッター 3 段
│   └── XtermView.tsx                      ← 微修正: onStatusChange dep 安定化
└── theme/
    └── tokens.ts                          ← FONT_FAMILY 集約 (重複削除)

packages/shared/src/
└── index.ts                               ← TmuxEvent type を移管 (gateway → shared)

packages/gateway/src/services/
└── tmuxControl.ts                         ← TmuxEvent 定義削除、import に変更
```

### コンポーネント API

```ts
// SessionRow.tsx
interface SessionRowProps {
  session: TmuxSession;
  isActive: boolean;
  isExpanded: boolean;
  activeWindowIndex: number | null;
  onSelect: (sessionId: string, windowIndex?: number) => void;
  onToggleExpand: (sessionName: string) => void;
}

// WindowRow.tsx
interface WindowRowProps {
  sessionDisplayName: string;
  window: TmuxWindow;
  isActive: boolean;
  onSelect: () => void;
}

// RowActionsMenu.tsx
// kebab ボタン直下に絶対位置 (kebab の getBoundingClientRect 起点で position:fixed)。
// 画面右端に近い場合は左寄せに flip。Sidebar スクロール中の追従は Phase 4 まで放置 (open 中はスクロールロックで対処)。
interface RowActionsMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  items: Array<{ label: string; onClick: () => void; destructive?: boolean }>;
  onClose: () => void;
}

// InlineEdit.tsx
interface InlineEditProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  onCancel: () => void;
  validate?: (next: string) => string | null; // returns error message or null
  autoFocus?: boolean;
  maxLength?: number;
  placeholder?: string;
}

// ConfirmDialog.tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;       // default "削除"
  cancelLabel?: string;        // default "キャンセル"
  destructive?: boolean;       // default false (true → 確認ボタン赤)
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

// NewSessionButton.tsx / NewWindowButton.tsx
interface NewEntityButtonProps {
  onCreate: (name?: string) => Promise<void>;
}
```

### ストア定義

```ts
// stores/events.ts
interface EventsState {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  reconnectAttempt: number;
  lastEvent: TmuxEvent | null;
  setStatus: (s: EventsState['status']) => void;
  setReconnectAttempt: (n: number) => void;
  setLastEvent: (e: TmuxEvent) => void;
}

// stores/ui.ts
interface ConfirmDialogConfig {
  title: string;
  message: string;
  destructive?: boolean;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}
interface ToastEntry {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
  durationMs?: number; // default 4000
}
interface UiState {
  confirmDialog: ConfirmDialogConfig | null;
  toasts: ToastEntry[];
  showConfirm: (c: ConfirmDialogConfig) => void;
  hideConfirm: () => void;
  pushToast: (t: Omit<ToastEntry, 'id'>) => void;
  dismissToast: (id: string) => void;
}

// stores/sessions.ts (拡張部分)
interface SessionsActions {
  refetch: () => Promise<void>;
  create: (name?: string) => Promise<TmuxSession>;
  rename: (currentId: string, newName: string) => Promise<TmuxSession>;
  remove: (id: string) => Promise<void>;
  createWindow: (sessionId: string, name?: string) => Promise<TmuxWindow>;
  renameWindow: (sessionId: string, windowIndex: number, newName: string) => Promise<TmuxWindow>;
  removeWindow: (sessionId: string, windowIndex: number) => Promise<void>;
}
```

### Sidebar 構造

```
┌─ Sidebar (320px, drag 不可 — Phase 4 で可変化) ──┐
│ Active · 3                                       │ ← header (sticky)
├──────────────────────────────────────────────────┤
│ ● zen_dev          [▾]    [⋯]                   │ ← SessionRow
│   ~/projects/zenterm                             │
│   ┌─                                             │
│   · w0:main             [⋯]                     │ ← WindowRow
│   · w1:test             [⋯]                     │
│   · w2:logs             [⋯]                     │
│   + window                                       │ ← NewWindowButton (expanded 時のみ)
│                                                  │
│ ● zen_ops          [▸]    [⋯]                   │
│   ~/ops                                          │
│                                                  │
│ + 新規セッション                                  │ ← NewSessionButton (footer-pre)
├──────────────────────────────────────────────────┤
│  [⌘]  [📁]  [⚙]   ●connected                    │ ← bottom nav (Phase 1) + events status
└──────────────────────────────────────────────────┘
```

- `[⋯]` (kebab) はホバー中のみ表示。focus / aria-expanded 時は keep visible
- `[▾] / [▸]` は Phase 1 既存の expand toggle (window > 1 のみ表示)
- `+ window` 行は session expand 時にのみ末尾に表示
- events status はテキストではなく色付きドット (`●` 緑=connected, 黄=reconnecting, 赤=failed)、tooltip で詳細

## 操作フロー詳細

### 1. session create

1. フッター `+ 新規セッション` クリック
2. ボタンが InlineEdit に変身 (placeholder = "セッション名 (空欄で自動)")
3. Enter (空でも可)
4. `apiClient.createSession({name?})` → 201 で `TmuxSession` 受信
5. `sessionsStore.upsert(session)` で行追加 + InlineEdit クローズ
6. (parallel) `/ws/events` から `sessions-changed` → debounced refetch → store merge で no-op
7. エラー時: InlineEdit 内に赤 inline メッセージ、行は追加されない

### 2. session rename

1. SessionRow ホバー → kebab → Rename
2. SessionRow 名前部分が InlineEdit に変身 (現在名 prefilled, autofocus + select all)
3. Enter / blur で `apiClient.renameSession(oldId, newName)`
4. 200 → `sessionsStore.replace(oldId, updated)` → 行が新名で再描画
5. 4xx/5xx → InlineEdit に inline エラー、行名は元のまま、Esc でキャンセル可
6. 409 (名前衝突) → "同名のセッションが存在します"
7. 404 (削除済み) → toast "対象が見つかりません" + refetch

### 3. session delete

1. SessionRow ホバー → kebab → Delete
2. `uiStore.showConfirm({ title:'セッションを削除', message:'zen_dev を削除しますか? (window 3 個も削除されます)', destructive:true, onConfirm })`
3. ConfirmDialog 描画、focus は Cancel ボタン (destructive 時の安全策)
4. Confirm クリック / Enter → `apiClient.killSession(id)`
5. 200 → `sessionsStore.remove(id)` + `uiStore.hideConfirm()`
6. 削除した session が `sessionViewStore.activeSessionId` と一致 → fallback ロジック発動
7. 失敗 → toast、ダイアログはそのまま (再試行可)

### 4. window create

#### Sidebar 経由
1. session expand → 末尾の `+ window` クリック
2. ボタンが InlineEdit に変身
3. Enter → `apiClient.createWindow(sessionId, {name?})` → 201
4. `sessionsStore.refetch()` で windows 配列を最新化 (window だけの差分 API がないため全体 refetch)

#### Toolbar 経由 (既存 Phase 1)
1. TerminalPane Toolbar `+` クリック → focus pane の session に新 window
2. 同 API、結果は焦点 pane で開く

### 5. window rename

1. WindowRow ホバー → kebab → Rename
2. window name 部分 (`w0:main` の `main` 部分) が InlineEdit に
3. Enter → `apiClient.renameWindow(sessionId, windowIndex, newName)`
4. 200 → store 部分更新、4xx → inline エラー

### 6. window delete

1. WindowRow ホバー → kebab → Delete
2. ConfirmDialog "w1:test を削除?" (window は子を持たないので window 数表示なし)
3. Confirm → `apiClient.killWindow(sessionId, windowIndex)`
4. 200 → refetch (window 配列 reindex があるので全体取得が安全)
5. 削除した window が現在 active なら fallback (同 session の次 window へ、無ければ session の w0、無ければ別 session)

### activeSessionId / activeWindowIndex fallback

```ts
function fallbackAfterRemove(removedSessionId: string): void {
  const view = sessionViewStore.getState();
  if (view.activeSessionId !== removedSessionId) return;
  const next = sessionsStore.getState().sessions.find(s => s.displayName !== removedSessionId);
  if (next) {
    view.open(next.displayName, next.windows[0]?.index ?? 0);
  } else {
    view.close(); // TerminalPane が "セッションを選択してください" 表示
  }
}

function fallbackAfterRemoveWindow(sessionId: string, removedIndex: number): void {
  const view = sessionViewStore.getState();
  if (view.activeSessionId !== sessionId || view.activeWindowIndex !== removedIndex) return;
  const session = sessionsStore.getState().sessions.find(s => s.displayName === sessionId);
  if (!session || session.windows.length === 0) {
    return fallbackAfterRemove(sessionId); // session も実質空 → session fallback
  }
  // 同 session の次 window (index 順で removed の次、なければ前)
  const sorted = [...session.windows].sort((a, b) => a.index - b.index);
  const next = sorted.find(w => w.index > removedIndex) ?? sorted[sorted.length - 1];
  view.open(sessionId, next.index);
}
```

## events 購読

### TmuxEventsClient (`lib/events/client.ts`)

```ts
interface TmuxEventsClientOptions {
  url: string;                       // ws://host/ws/events?token=xxx
  onEvent: (event: TmuxEvent) => void;
  onStatusChange: (status: EventsState['status'], attempt: number) => void;
}

class TmuxEventsClient {
  start(): void;
  stop(): void;                      // close 1000, no reconnect
  triggerReconnect(): void;          // for "再接続" button
}
```

- 内部で `createReconnectBackoff` (Phase 1 の既存 `lib/reconnectBackoff.ts`) を使用
- 1000 → no reconnect, 1006 → reconnect, 1008 → no reconnect (auth fail) — Phase 1 XtermView 同様
- メッセージは JSON.parse 後 `parseEvent` でナロー、不正なら無視
- WS heartbeat は Gateway 側から ping が来るので client は何もしない (`pong` は ws ライブラリが自動返却)

### useEventsSubscription

```ts
function useEventsSubscription(): void {
  const token = useAuthStore(s => s.token);
  const setStatus = useEventsStore(s => s.setStatus);
  const setAttempt = useEventsStore(s => s.setReconnectAttempt);
  const setLastEvent = useEventsStore(s => s.setLastEvent);
  const refetchSessions = useSessionsStore(s => s.refetch);

  useEffect(() => {
    if (!token) return;

    const isUnmounted = { current: false };
    const debounced = createDebounced(refetchSessions, 50); // 50ms 統合

    const client = new TmuxEventsClient({
      url: `${origin.replace(/^http/, 'ws')}/ws/events?token=${encodeURIComponent(token)}`,
      onEvent: (event) => {
        if (isUnmounted.current) return;
        setLastEvent(event);
        if (event.type === 'sessions-changed' || event.type === 'windows-changed') {
          debounced();
        }
        // monitor-restart: tmux 監視が再起動した、念のため refetch
        if (event.type === 'monitor-restart') {
          debounced();
        }
      },
      onStatusChange: (status, attempt) => {
        if (isUnmounted.current) return;
        setStatus(status);
        setAttempt(attempt);
      },
    });
    client.start();

    return () => {
      isUnmounted.current = true;
      client.stop();
    };
  }, [token, refetchSessions, setStatus, setAttempt, setLastEvent]);
}
```

`SessionsRoute` の最上段で 1 度だけ呼ぶ。StrictMode 二重 mount でも `isUnmounted` で安全。

### debounce 設計

連続して `sessions-changed` / `windows-changed` が来ても 50ms ウィンドウで 1 回の `refetch()` に纏める (例: tmux 操作で複数 % イベントが連発)。

## エラー処理

### HTTP エラー分類

| status | 意味 | UI 処理 |
|---|---|---|
| 200 / 201 | 成功 | store 更新、UI 状態クリア |
| 400 | validation (空文字、長すぎ、文字種) | InlineEdit 内に赤 inline メッセージ、toast なし |
| 401 | auth 失効 | Phase 1 既存の useApiAuth 経由で logout → /web/login |
| 404 | 対象不存在 (race condition) | toast「対象が見つかりません。一覧を更新します」+ 即 refetch |
| 409 | 名前衝突 | InlineEdit 内に赤「同名のセッションが存在します」 |
| 422 | 不正な引数 (server 側 zod) | InlineEdit 内に赤 inline (server からの message 表示) |
| 5xx | server error | toast「エラーが発生しました [再試行]」、再試行ボタン押下で再呼出 |
| network | timeout / DNS / 接続不能 | toast「接続できません」、events store の status 連動で reconnecting バナー |

### Client side validation

```ts
// hooks/useInlineEdit.ts または lib/validateName.ts
export function validateSessionOrWindowName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '名前を入力してください';
  if (trimmed.length > 64) return '64 文字以内で入力してください';
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return '英数字・_・- のみ使用できます';
  return null;
}
```

server 側は `min(1).max(64)` のみ。client 側で tmux 名として安全な文字種に絞る (PC web からは `\` `/` `.` `:` 等を含めて作らせない)。

### concurrent edit

- **A タブで rename → B タブの events 購読が refetch → B も新名表示** (期待動作)
- **A タブで rename 中 (InlineEdit open) に B タブで同 session を delete → events で A も refetch → A の InlineEdit save 時に 404 → InlineEdit 自動キャンセル + toast** (race-safe)
- **A タブで rename → 同時に B タブで delete → どちらか先勝ち → 後者は 404** (server-side 整合)

### a11y

- ConfirmDialog: `<dialog>` 要素 (`role='dialog'` 自動付与)、`aria-labelledby`, `aria-describedby`
- InlineEdit: `aria-label="セッション名を編集"` または `aria-label="window 名を編集"`、`aria-invalid={!!error}`、`aria-describedby={errorId}`
- RowActionsMenu: `role='menu'`、項目は `role='menuitem'`、Esc で閉じる、上下矢印で移動、Tab で abandon
- kebab ボタン: `aria-haspopup='menu'`, `aria-expanded={open}`, `aria-label="アクション"`
- Toast: info → `role='status'`, error → `role='alert'`
- focus 制御: ConfirmDialog open 時は dialog 内の最初の button (destructive 時は Cancel) に focus、close 時は元の trigger に戻す
- focus trap: `<dialog>` のネイティブ挙動で十分 (Tab で dialog 内ループ)

## state 管理の詳細

### store action 実装方針

```ts
// stores/sessions.ts
const useSessionsStore = create<SessionsState & SessionsActions>((set, get) => ({
  sessions: [],
  loading: false,
  error: null,

  refetch: async () => {
    set({ loading: true });
    try {
      const sessions = await apiClient.listSessions();
      set({ sessions, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      set({ loading: false, error: message });
      uiStore.getState().pushToast({ type: 'error', message: `一覧取得に失敗: ${message}` });
    }
  },

  create: async (name) => {
    const created = await apiClient.createSession({ name });
    set({ sessions: [...get().sessions, created] });
    return created;
  },

  rename: async (currentId, newName) => {
    const updated = await apiClient.renameSession(currentId, { name: newName });
    set({
      sessions: get().sessions.map(s =>
        s.displayName === currentId ? updated : s
      ),
    });
    // sessionView の active も新 displayName へ追従
    const view = sessionViewStore.getState();
    if (view.activeSessionId === currentId) {
      view.open(updated.displayName, view.activeWindowIndex ?? 0);
    }
    return updated;
  },

  remove: async (id) => {
    await apiClient.killSession(id);
    set({ sessions: get().sessions.filter(s => s.displayName !== id) });
    fallbackAfterRemove(id);
  },

  // window 操作も同様 (refetch ベース)
}));
```

### merge ロジック

events 由来の `refetch` 結果と mutation 由来の即時更新が race した場合:
- mutation の方が早ければ store 内に既に最新状態
- refetch 結果は server-truth なので **常に refetch 結果で上書き**
- 結果として最終 state は server-truth に収束

これは Phase 1 の zustand store 設計と同じ「最後に書いた者勝ち」ポリシーで、複雑な diff merge は実装しない。

## テスト方針

### ユニット (vitest)

```
packages/web/src/
├── stores/__tests__/
│   ├── sessions.test.ts                ← 拡張: create/rename/remove/refetch + fallback
│   ├── events.test.ts                  ← 新規: setStatus / setLastEvent
│   └── ui.test.ts                      ← 新規: confirmDialog set/clear, toast push/dismiss/queue
├── lib/events/__tests__/
│   ├── client.test.ts                  ← 新規: open/message/close → reconnect, 1006/1008 分岐
│   └── parseEvent.test.ts              ← 新規: 各 TmuxEvent 種別のナロー
├── hooks/__tests__/
│   ├── useEventsSubscription.test.tsx  ← 新規: mount で接続, unmount で close, debounce refetch
│   └── useInlineEdit.test.tsx          ← 新規: enter→save, esc→cancel, blur→save, validate 表示
└── api/__tests__/
    └── client.test.ts                  ← 拡張: createSession/renameSession/killSession + window 同等
```

### コンポーネント (vitest + RTL)

```
packages/web/src/components/
├── sidebar/__tests__/
│   ├── SessionRow.test.tsx             ← hover で kebab 表示, click で onSelect, kebab→Rename で InlineEdit
│   ├── WindowRow.test.tsx              ← 同上の window 版
│   ├── RowActionsMenu.test.tsx         ← Esc 閉じる, 矢印移動, click outside で閉じる, focus 復帰
│   ├── NewSessionButton.test.tsx       ← click → InlineEdit 展開 → Enter で onCreate
│   ├── NewWindowButton.test.tsx        ← 同上
│   └── SessionsListPanel.test.tsx      ← loading / empty / error / 通常 4 状態
└── ui/__tests__/
    ├── ConfirmDialog.test.tsx          ← open=false で非描画, Esc cancel, Enter confirm, focus trap, Cancel autofocus
    ├── InlineEdit.test.tsx             ← validate 表示, autofocus, maxLength, blur save
    ├── Toast.test.tsx                  ← auto dismiss, manual close
    └── ToastViewport.test.tsx          ← queue 順序, 同時複数表示
```

### 統合 (vitest + RTL + jsdom)

```
packages/web/src/__tests__/
└── flows/
    ├── session-create-flow.test.tsx    ← Sidebar → "+ 新規" → 入力 → API mock → 行追加
    ├── session-rename-flow.test.tsx    ← kebab → Rename → 入力 → 200/409 各 path
    ├── session-delete-flow.test.tsx    ← kebab → Delete → ConfirmDialog → Confirm → 行削除 + fallback
    ├── window-crud-flow.test.tsx       ← window create / rename / delete を 1 ファイルで網羅
    └── events-refetch-flow.test.tsx    ← events WS mock → message → debounced refetch
```

### E2E (Playwright)

```
server/tests/e2e/web/
├── login.spec.ts                       (Phase 1 既存)
├── terminal.spec.ts                    (Phase 1 既存)
├── sessions-crud.spec.ts               ← 新規
├── windows-crud.spec.ts                ← 新規
└── events-realtime.spec.ts             ← 新規 (2 context = 2 タブ相当で events 反映確認)
```

`events-realtime.spec.ts` 内容例:
1. context A / B を spawn、両方 login
2. context A で `+ 新規セッション` → 名前入力 → Enter
3. context B の Sidebar に新セッションが 1 秒以内に出ることを expect
4. context B で session を rename
5. context A で名前変更が 1 秒以内に反映されることを expect

### 手動検証 (Phase 2a 完了時)

- 4 桁 token で 2 ブラウザ同時接続して events 目視
- セッション 0 / 1 / 5 / 20 個での Sidebar スクロール
- session 名に絵文字 / 日本語 / 空白を試して validation エラー表示
- WS 切断 (Gateway を `systemctl --user restart`) で reconnect バナー → 自動復帰
- delete 中に 5xx 返す mock で toast → 再試行
- session を 5 個連続作成して debounce 動作目視 (各イベントで refetch するのではなく、まとめて 1 回)
- 大量 session (50 個) 作成で UI パフォーマンス確認

### 回帰防止

- Phase 1 の既存テスト 59 件 PASS 維持
- Gateway 既存テスト 143 件 PASS 維持 (TmuxEvent 移管後も)
- E2E Phase 1 既存 3 件 + Phase 2a 追加 5 件で計 8 件

## 段階的実装方針

Phase 2a は以下の論理単位で実装プランを立てる (writing-plans skill で具体化):

| 単位 | 内容 | 想定タスク数 |
|---|---|---|
| **基盤** | TmuxEvent shared 移管 / events store / TmuxEventsClient / useEventsSubscription / 接続ステータス UI | 5-6 |
| **API + store** | apiClient 拡張 / sessionsStore 拡張 (create/rename/remove + window 版) / fallback ロジック | 4-5 |
| **UI primitives** | ConfirmDialog / InlineEdit / RowActionsMenu / Toast / ToastViewport / uiStore | 6-7 |
| **Sidebar** | SessionRow / WindowRow / NewSessionButton / NewWindowButton / SessionsListPanel リファクタ | 5-6 |
| **flows** | 6 操作フロー (session × 3, window × 3) のワイヤリング + flow tests | 3-4 |
| **E2E + 残課題** | sessions-crud / windows-crud / events-realtime + Phase 1 残 2 件 | 3-4 |

合計 26-32 タスク想定。Phase 1 (25 タスク) と同程度。

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| events 購読の StrictMode 二重 mount で WS 重複 | gateway に過剰接続 | Phase 1 XtermView と同じ `isUnmounted` パターン、cleanup で確実に close |
| events debounce が 50ms で短すぎ / 長すぎ | UI ラグ or 過剰 fetch | デフォルト 50ms、Phase 5 ポリッシュで実測調整 |
| inline edit 中に events 経由 refetch で session が削除/改名される | onSave 時に 404 / 入力が無効化 | InlineEdit は内部 state を持つので row 再レンダで入力は消えない。onSave で 404 になった場合は toast「対象が見つかりません」+ refetch で UI を最新化、ユーザーは新状態で操作再開 |
| 同名 session を別経路 (CLI) で作成中に web から作成 | 409 衝突で UX 悪化 | 409 を inline エラーで分かりやすく表示、refetch 推奨ボタン付き |
| ConfirmDialog の `<dialog>` ブラウザ互換 | Safari 旧版で動かない | Safari 15.4+ でネイティブ対応、Phase 5 で必要なら polyfill |
| Toast 同時多発 | 画面占有 | 最大 5 件、超過は古いものから自動 dismiss、queue 制限 |
| events 切断中の mutation 結果が UI に反映されない | "操作したのに見えない" | mutation 自体は API response で即反映するので events 切断と独立、再接続時に refetch で同期 |
| TmuxEvent shared 移管で gateway test が壊れる | 既存テスト失敗 | 移管時に gateway 側 import パス変更、test も同時に更新 |
| Phase 1 残課題の onStatusChange dep 安定化が events 統合で再発 | 不要な再接続 | useCallback + useRef で status 変化通知を separation、events 接続自体は token 変化のみで再起動 |

## 互換性

- **Phase 1 と完全互換**: ログインフロー、API 呼び出し、persist key、xterm.js 設定は変更なし
- **モバイル無影響**: `/embed/terminal` / `/api/*` / `/ws/*` の振る舞い変化なし
- **shared 型は追加のみ**: `TmuxEvent` 移管は app 側でも問題ない (app は `/ws/events` を購読していない)
- **既存セッション保護**: Phase 2a は tmux データを破壊しない (UI からの delete は明示操作のみ)

## 触らないもの

- Phase 1 で確定した認証フロー
- Phase 1 のテーマトークン構造 (`FONT_FAMILY` 集約は theme/tokens.ts 内のリファクタのみ、エクスポート shape は不変)
- Gateway の既存ルート、API、WS プロトコル
- `/embed/terminal` HTML、モバイル WebView
- mobile app (zenterm-app)

## Phase 2b / 2c への引き継ぎ

Phase 2a が用意する基盤を Phase 2b / 2c が使う:

- **events store / useEventsSubscription**: Phase 2b の Files / Settings panel が同じ events から自分用の更新を受ける
- **uiStore (ConfirmDialog / Toast)**: Phase 2b の Files 削除確認 / Settings 変更通知で再利用
- **InlineEdit / RowActionsMenu**: Phase 2b の Files rename / delete でも再利用
- **sessionsStore / sessionViewStore**: Phase 2b の Limits / SystemStatus が session 情報を参照

Phase 2c (i18n) は全コンポーネントの文字列を i18next キーに置換する横断作業なので、Phase 2a の段階では **日本語ハードコード** で OK。Phase 2c で一括置換時に grep しやすいよう、UI 文字列は const 化せず JSX 内に直書きで構わない。

## 完了条件

Phase 2a は以下を満たして tag `web-pc-phase-2a-done` を打つ:

1. ✅ 6 操作フロー (session × 3, window × 3) が動作
2. ✅ 別タブで作成/変更/削除した結果が events 経由で 1 秒以内に反映
3. ✅ WS 切断 → 自動 reconnect → 復帰 (手動検証で確認)
4. ✅ Phase 1 既存テスト 全 PASS (59 web + 143 gateway + 3 E2E)
5. ✅ Phase 2a 新規テスト 全 PASS (想定: 30+ unit, 15+ component, 5 flow, 3 E2E)
6. ✅ Phase 1 残課題 2 件 (onStatusChange dep, FONT_FAMILY) 解消
7. ✅ ブラウザ実機で 4 桁 token ログイン → セッション作成 → window 追加 → rename → delete までを目視確認
