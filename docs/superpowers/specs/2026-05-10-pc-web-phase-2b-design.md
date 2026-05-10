# PC (Web) 版 ZenTerm — Phase 2b 設計 (Settings + i18n + Limits + SystemStatus)

> 作成日: 2026-05-10
> 状態: 設計完了 / 実装計画中
> 親仕様: `docs/superpowers/specs/2026-05-09-pc-web-design.md`
> 前 Phase: `docs/superpowers/specs/2026-05-10-pc-web-phase-2a-design.md` (events + Sidebar CRUD 完了)
> 関連: mobile `app/src/components/layout/SettingsPanel.tsx`, `app/src/components/{ClaudeLimits,CodexLimits,SystemStatus,LimitsRow}.tsx`

## 背景と目的

Phase 1 (Bootstrap) と Phase 2a (events 購読 + Sidebar CRUD) で Sessions タブが完成した。Phase 2b では PC Web の **機能パリティ単一ペイン** のうち以下を実装する:

- **Settings タブ** (Sidebar 3rd タブ): Appearance / Terminal / Gateway / SystemStatus / Rate limits の 5 セクション
- **i18n インフラ + en/ja 2 言語** (8 言語のうち 2 つ。残り 6 つは Phase 2c+ で順次追加)
- **Theme: dark/light/system 3 モード** (Phase 1/2a は dark 固定だった)
- **ClaudeLimits / CodexLimits ウィジェット** (mobile 移植)
- **SystemStatus ウィジェット** (mobile 移植、5s polling)

Files タブは Phase 2c に分離する。

## スコープ

### In scope

- `packages/web/src/routes/settings.tsx` 新規作成 (`/web/settings` ルート)
- `packages/web/src/components/settings/` 配下に SettingsPanel + 5 セクションコンポーネント + Limits/Status/QR/Reauth 関連
- `packages/web/src/stores/settings.ts` 新規 (themeMode / language / fontSize、zustand persist)
- `packages/web/src/i18n/` 新規 (i18next 初期化、en/ja locale JSON)
- `packages/web/src/theme/tokens.ts` 拡張 (lightTokens 追加)
- `packages/web/src/theme/index.ts` 改修 (`useTheme()` が settings store + matchMedia から resolved theme を返す)
- `packages/web/src/theme/terminalColors.ts` 拡張 (light xterm theme)
- `packages/web/src/api/client.ts` 拡張 (`getSystemStatus` / `getClaudeLimits` / `getCodexLimits` 追加)
- `packages/web/src/components/Sidebar.tsx` 改修 (3 タブ全て interactive、URL pathname → activePanel)
- `packages/web/src/components/terminal/XtermView.tsx` 改修 (resolvedTheme と fontSize を購読)
- `packages/web/src/App.tsx` 改修 (`/web/settings` ルート追加)
- 既存 Phase 2a UI 全体に i18n keys を導入 (Sidebar/Sessions/Login/CRUD ダイアログ等)
- ユニット / コンポーネント / フロー / E2E テスト一式

### Out of scope (Phase 2c+ に分離)

- Files パネル (`/web/files`、ファイルツリー、エディタ、D&D アップロード)
- 残り 6 言語 (es / fr / de / pt-BR / zh-CN / ko)
- Limits の自動 polling (mobile 同様、refresh button のみ)
- Multi-pane (Phase 3)
- Command Palette / KB ショートカット (Phase 4)

### 触らないもの

- Gateway のすべてのコード (API は既存)
- `packages/shared/src/` (既存型のみ使用)
- `/embed/terminal` (mobile WebView)
- iPad / mobile アプリ (`app/`)
- Phase 2a の events 関連、Sidebar Sessions タブのロジック (i18n key 化のみ追加)

## 設計原則 (Phase 2a 踏襲)

1. **mobile parity**: SettingsPanel の構造・LimitsRow の collapsed/expanded UX・SystemStatus の 5s polling を mobile 既存実装から移植する。コードは共有しないが構造を揃える。
2. **既存パターン踏襲**: zustand persist (Phase 2a auth/sessionView と同じ)、useTheme() context (既存)、wrappedClient による 401 intercept (Phase 2a)。
3. **YAGNI**: Limits の自動 polling、language picker の sheet UI、theme の system 以外の prefers-* media query 追従などは入れない。
4. **forward compat**: Language picker は HTML `<select>` で 8 言語まで対応可能な UI にしておく。i18n key は最初から全 UI に展開する (en/ja 2 つだけ実体)。

## アーキテクチャ

### ディレクトリ追加・変更

```
packages/web/src/
├── routes/
│   ├── login.tsx                       (既存・i18n key 化)
│   ├── sessions.tsx                    (既存・i18n key 化)
│   └── settings.tsx                    ★ 新規
├── components/
│   ├── Sidebar.tsx                     (改修: 3 タブ interactive、URL 連動)
│   ├── SessionsListPanel.tsx           (既存・i18n key 化)
│   ├── LoginForm.tsx                   (既存・i18n key 化)
│   ├── TerminalPane.tsx                (既存・i18n key 化)
│   ├── sidebar/                        (既存・i18n key 化)
│   ├── ui/                             (既存・i18n key 化)
│   ├── terminal/
│   │   └── XtermView.tsx               (改修: resolvedTheme / fontSize 購読)
│   └── settings/                       ★ 新規ディレクトリ
│       ├── SettingsPanel.tsx           5 セクション composer
│       ├── AppearanceSection.tsx       Theme 3 button + Language <select>
│       ├── TerminalSection.tsx         Font size +/- stepper
│       ├── GatewaySection.tsx          URL/Token/Copy/QR/Re-enter/Logout/Version
│       ├── SystemStatusSection.tsx     5s polling、4 行 (uptime/load/mem/tmux)
│       ├── RateLimitsSection.tsx       Refresh button + ClaudeLimits + CodexLimits
│       ├── ClaudeLimits.tsx            mobile 移植
│       ├── CodexLimits.tsx             mobile 移植
│       ├── LimitsRow.tsx               mobile 移植 (collapsed/expanded)
│       ├── QrModal.tsx                 qrcode.react ラップ
│       └── ReauthDialog.tsx            token 再入力 (LoginForm 再利用)
├── stores/
│   └── settings.ts                     ★ 新規 (themeMode/language/fontSize)
├── theme/
│   ├── tokens.ts                       (改修: lightTokens 追加 + export both)
│   ├── index.ts                        (改修: useTheme() → settings store + matchMedia)
│   └── terminalColors.ts               (拡張: light xterm theme)
├── i18n/                               ★ 新規ディレクトリ
│   ├── index.ts                        i18next init + store subscribe
│   ├── useTranslation.ts               型補強 wrapper (optional)
│   └── locales/
│       ├── en.json
│       └── ja.json
├── api/
│   └── client.ts                       (改修: getSystemStatus/getClaudeLimits/getCodexLimits 追加)
└── lib/
    └── qr.ts                           ★ 新規 (zenterm:// URL 組立て)
```

### 新規依存

| パッケージ | バージョン例 | 用途 | 推定サイズ (gzip) |
|---|---|---|---|
| `react-i18next` | ^15.x | i18n hook | ~10 KB |
| `i18next` | ^23.x | i18n core | ~20 KB |
| `qrcode.react` | ^4.x | QR コード SVG | ~50 KB |

### Gateway 側変更

**なし。** Phase 1 で既に提供済みのエンドポイントのみ使用:

- `GET /api/system/status` → `{ uptimeSeconds, loadAvg, memoryTotalBytes, memoryFreeBytes, tmuxRunning, gatewayVersion, ... }`
- `GET /api/claude/limits` → `ClaudeLimitsResponse` (shared 型)
- `GET /api/codex/limits` → `CodexLimitsResponse` (shared 型)
- `POST /api/auth/verify` (Token 再入力で再利用)

すべて既存 Bearer middleware が認証済み。

## Stores

### `stores/settings.ts`

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ja';

export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 20;
export const DEFAULT_FONT_SIZE = 14;

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  fontSize: number;
  setThemeMode(mode: ThemeMode): void;
  setLanguage(lang: Language): void;
  setFontSize(size: number): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      language: 'ja',
      fontSize: DEFAULT_FONT_SIZE,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      setFontSize: (size) =>
        set({ fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size))) }),
    }),
    {
      name: 'zenterm-web-settings',
      version: 1,
    },
  ),
);
```

### Theme: `theme/index.ts`

```ts
import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import { darkTokens, lightTokens, type Tokens } from './tokens';

function useSystemDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDark;
}

export function useTheme(): { tokens: Tokens; resolvedTheme: 'light' | 'dark' } {
  const mode = useSettingsStore((s) => s.themeMode);
  const systemDark = useSystemDark();
  const resolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  return {
    tokens: resolvedTheme === 'dark' ? darkTokens : lightTokens,
    resolvedTheme,
  };
}
```

`tokens.ts` には `lightTokens` を追加。color value は mobile の `app/src/theme/tokens.ts` の light パレットを移植。`FONT_FAMILY_MONO` は両 token で共通。

`terminalColors.ts` には light 用 xterm theme オブジェクトを追加 (背景 #ffffff、ANSI palette は mobile の light テーマ移植)。

### i18n: `i18n/index.ts`

```ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import { useSettingsStore } from '@/stores/settings';

export function initI18n() {
  const initialLang = useSettingsStore.getState().language;
  i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, ja: { translation: ja } },
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  useSettingsStore.subscribe((s) => {
    if (i18next.language !== s.language) {
      void i18next.changeLanguage(s.language);
    }
  });
}
```

`main.tsx` で `initI18n()` を `createRoot` の前に呼ぶ。

### Locale ファイル例 (`locales/en.json` 抜粋)

```json
{
  "common": { "cancel": "Cancel", "save": "Save", "loading": "Loading…" },
  "sidebar": {
    "tabs": { "sessions": "Sessions", "files": "Files", "settings": "Settings" },
    "filesComingSoon": "Coming in Phase 2c"
  },
  "sessions": { "newSession": "New session", "newWindow": "New window", … },
  "settings": {
    "appearance": { "title": "Appearance", "theme": "Theme", "themeOptions": { "light": "Light", "dark": "Dark", "system": "System" }, "language": "Language" },
    "terminal": { "title": "Terminal", "fontSize": "Font size" },
    "gateway": { "title": "Gateway", "connectedTo": "Connected to", "token": "Token", "version": "Gateway version", "copyUrl": "Copy Web URL", "showQr": "Show mobile QR", "reauth": "Re-enter token", "logout": "Logout", "qrTitle": "Pair mobile app", "qrInstructions": "Scan this QR with the ZenTerm mobile app to pair." },
    "systemStatus": { "title": "System status", "uptime": "Uptime", "loadAvg": "Load avg", "memory": "Memory", "tmux": "tmux server", "tmuxRunning": "running", "tmuxStopped": "stopped", "unavailable": "Status unavailable", "lastUpdated": "Last updated {{age}} ago" },
    "rateLimits": { "title": "Rate limits", "beta": "β", "refresh": "Refresh", "claude": "Claude", "codex": "Codex", … }
  }
}
```

`ja.json` は同じ key 構造で日本語訳。

## コンポーネント設計

### `routes/settings.tsx`

`SessionsRoute` と同じく `Sidebar + 右側` の 2-column レイアウト。Phase 2b では右側は **TerminalPane を mount 維持** (sessionView store の current selection の xterm)。

```tsx
export function SettingsRoute() {
  const auth = useAuthStore();
  if (!auth.token) return <Navigate to="/web/login" replace />;
  // SessionsRoute と同じ wrappedClient 構築 (401 intercept)
  // Sidebar (activePanel='settings' は URL から自動導出) + TerminalPane を描画
  return <SessionsLikeShell />;
}
```

実装上は `SessionsRoute` から共通 shell 部分を抽出して両方で使うのが綺麗 (`AuthenticatedShell.tsx` のような名前)。

### `components/Sidebar.tsx` 改修

```tsx
const navigate = useNavigate();
const location = useLocation();
const activePanel: SidebarPanel = (() => {
  if (location.pathname.startsWith('/web/settings')) return 'settings';
  if (location.pathname.startsWith('/web/files')) return 'files';
  return 'sessions';
})();

// 3 button, click → navigate, Files は disabled (tooltip "Coming in Phase 2c")
// activePanel === 'sessions' → <SessionsListPanel ...props/>
// activePanel === 'settings' → <SettingsPanel/>
// activePanel === 'files' → 不到達 (disabled)
```

### `components/settings/SettingsPanel.tsx`

```tsx
export function SettingsPanel() {
  const { tokens } = useTheme();
  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: tokens.spacing.md }}>
      <AppearanceSection />
      <TerminalSection />
      <GatewaySection />
      <SystemStatusSection />
      <RateLimitsSection />
      <SettingsFooter />
    </div>
  );
}
```

### Section コンポーネント: 主要 props と挙動

- **AppearanceSection**: store 直接読み書き。Theme 3 ボタン (aria-pressed)、Language `<select>` (option: 日本語 / English)。
- **TerminalSection**: store 直接読み書き。`+`/`-` ボタンで font size 変更、min/max で disabled。
- **GatewaySection**: props で `onLogout` を受け取る (parent route が token clear + navigate)。Copy ボタンは `navigator.clipboard.writeText(window.location.origin + '/web')` → toast。QR ボタンで `QrModal` を `useState` で開く。Re-enter で `ReauthDialog` を開く。
- **SystemStatusSection**: 自前 fetch + 5s polling。`fetchStatus()` を `useEffect` で初回 + `setInterval(5000)`、unmount で clearInterval。state: `data | error | loading`。401 は wrappedClient で先に検出 → polling 停止 + logout。
- **RateLimitsSection**: `refreshKey` を `useState` で持ち、refresh ボタンで `setRefreshKey(k => k + 1)`。子の `ClaudeLimits` / `CodexLimits` は props として `refreshKey` を受け取る。
- **ClaudeLimits / CodexLimits**: mobile から移植。`useEffect [refreshKey]` で fetch、データを `LimitsRow` に渡す。
- **LimitsRow**: collapsed (status dot + chips) → click で expanded (full % + reset + bar)。color thresholds: `<50% primary, 50-90% warning, ≥90% error`。
- **QrModal**: 既存 `<dialog>` パターン (Phase 2a `ConfirmDialog`) を流用。`qrcode.react` の `<QRCodeSVG value={zenTermUrl} size={200}/>` を表示。close で focus 戻し。
- **ReauthDialog**: 既存 `LoginForm` を modal 内に再利用。verify 成功で `useAuthStore.setToken(...)` + close。

### `lib/qr.ts`

```ts
export function buildPairingUrl(origin: string, token: string): string {
  const url = new URL('zenterm://connect');
  url.searchParams.set('url', origin);
  url.searchParams.set('token', token);
  return url.toString();
}
```

### `components/terminal/XtermView.tsx` 改修

```tsx
// 既存 props に加えて、内部で useTheme() / useSettingsStore() を購読:
const { resolvedTheme } = useTheme();
const fontSize = useSettingsStore((s) => s.fontSize);

useEffect(() => {
  if (!termRef.current) return;
  termRef.current.options.theme =
    resolvedTheme === 'dark' ? darkXtermTheme : lightXtermTheme;
}, [resolvedTheme]);

useEffect(() => {
  if (!termRef.current) return;
  termRef.current.options.fontSize = fontSize;
  fitAddon.fit();
}, [fontSize]);
```

既存 `theme` / `fontSize` props は削除 (store 直購読に切替)。または props を残して上位から渡す方式でも可だが、Phase 2b では `XtermView` 自身で購読するほうが coupling が低い。

## データフロー

### 起動時

```
1. main.tsx
   - useSettingsStore.persist.rehydrate() を await
   - initI18n()
   - createRoot(<App/>)
2. App.tsx mount
   - matchMedia 購読 (useTheme 内部)
   - useTheme() が resolved tokens を返す
   - i18next が settings.language で初期化済み
3. Router 描画
   - /web/login | /web/sessions | /web/sessions/:id | /web/settings
```

### Settings 操作 → 反映

```
[Theme]
  click "Light" → setThemeMode('light')
  → store 更新 + persist
  → useTheme() 再評価 → 全コンポーネント re-render
  → XtermView useEffect [resolvedTheme] → term.options.theme = lightXtermTheme

[Language]
  <select> change → setLanguage('en')
  → store 更新 + persist
  → store subscribe → i18next.changeLanguage('en')
  → useTranslation() を使う全コンポーネント re-render

[Font size]
  + click → setFontSize(15)
  → store 更新 + persist
  → XtermView useEffect [fontSize] → term.options.fontSize = 15 + fitAddon.fit()
```

### Gateway セクション

```
[Copy URL]
  navigator.clipboard.writeText(`${window.location.origin}/web`)
  → 成功 toast "Web URL copied"
  → 失敗 toast "Copy failed — please copy manually" + URL を選択可能なテキストで表示

[Show QR]
  qrUrl = buildPairingUrl(origin, token)
  → setQrOpen(true) → QrModal 描画

[Re-enter token]
  → setReauthOpen(true) → ReauthDialog 描画 (LoginForm 内蔵)
  → verify 成功で auth store に新 token 保存 + close

[Logout]
  → ConfirmDialog (既存 uiStore.showConfirm)
  → 確認後 useAuthStore.clear() + navigate('/web/login')
```

### SystemStatus polling

```
SystemStatusSection mount:
  fetchStatus() (initial)
  intervalId = setInterval(fetchStatus, 5000)
unmount:
  clearInterval(intervalId)

エラー時:
  fetchError state を保持、warning 行 "Status unavailable" を直前データの下に表示
  次回 poll で成功 → 自動復旧 (state 更新)

401 検出:
  wrappedClient が先に intercept → token clear + navigate('/web/login')
  → unmount → polling 停止
```

### Limits refresh

```
RateLimitsSection:
  state: refreshKey (number)
  initial mount で ClaudeLimits + CodexLimits が refreshKey=0 で fetch
  refresh button click → setRefreshKey(k => k + 1)
  → 子の useEffect [refreshKey] が再 fetch
エラーは widget 内に独立に表示。Claude が失敗しても Codex は表示し続ける。
```

### 401 ハンドリング (Phase 2a パターン踏襲)

`SettingsRoute` 内で `useMemo` した `wrappedClient` を `SettingsPanel` に context で配る (または props drill)。各 fetch は wrappedClient を経由し、401 を検出すると `useAuthStore.clear()` + `navigate('/web/login')` を実行。

## エラーハンドリング

### 認証 (401)

| 操作 | 401 検出時 |
|---|---|
| Settings 初回描画 (status / limits fetch) | wrappedClient で intercept → token clear → /web/login |
| SystemStatus polling | poll 中 401 → polling 停止 + token clear → navigate |
| Limits refresh | 同上 |
| Re-enter token verify | ReauthDialog 内で "Invalid token" 表示、再入力許可 |

### Network / サーバーエラー

| 状況 | UI |
|---|---|
| SystemStatus 初回 fetch 失敗 | "Status unavailable" + error message。次回 poll で復旧試行 |
| SystemStatus polling 中の失敗 | 直前値を dim で表示 + "Last updated Ns ago · retrying" |
| ClaudeLimits / CodexLimits 失敗 | widget 内に error メッセージ。Refresh で再試行可 |
| Copy URL 失敗 (Permissions API 拒否) | toast "Copy failed — please copy manually" + URL を `<input readonly>` で表示 |
| QR 生成失敗 | modal 内に "QR generation failed" + URL テキスト fallback |

### Limits API state

| state | UI |
|---|---|
| `unconfigured` | "Not configured" + ドキュメントリンク (mobile と同じ URL) |
| `pending` | "Calculating…" |
| `unavailable` | "Unavailable" + 詳細 message |
| `stale` | warning ドット + "Last updated Nm ago" footer |

### Persist

- `localStorage` disabled (private mode 等): zustand persist が silent fail → in-memory のみ動作。reload で消える。
- quota 超過: 同上。
- corrupted: zustand 既定 merge で default にフォールバック。

### i18n

- missing key: i18next が key 文字列をそのまま返す (fallback 既定)。
- 言語ロード失敗: 起動時 `import` で static bundle 化のため発生しない。

### Theme race

- `themeMode !== 'system'`: matchMedia 変更を無視
- `themeMode === 'system'`: matchMedia 変更を即時反映

### Sidebar タブ遷移

- Sessions → Settings: TerminalPane mount 維持、WS 接続継続、xterm 出力受信し続ける
- Settings → Sessions: 何も切断せずタブ表示のみ切替

## テスト方針

### Unit (Vitest)

| ファイル | 内容 |
|---|---|
| `stores/__tests__/settings.test.ts` | initial state, set 各種, clamp (font size min/max), persist key |
| `theme/__tests__/tokens.test.ts` (拡張) | lightTokens shape, darkTokens 既存 |
| `theme/__tests__/useTheme.test.ts` | mode 'system' + matchMedia mock、'dark'/'light' 固定 |
| `theme/__tests__/terminalColors.test.ts` (拡張) | light xterm theme |
| `i18n/__tests__/index.test.ts` | en/ja key roundtrip、missing key fallback |
| `lib/__tests__/qr.test.ts` | zenterm:// URL 組立て (encode/escape) |
| `api/__tests__/client.test.ts` (拡張) | getSystemStatus / getClaudeLimits / getCodexLimits の Bearer + 401 |

### Component (Vitest + RTL)

| ファイル | 内容 |
|---|---|
| `components/settings/__tests__/AppearanceSection.test.tsx` | theme 3 ボタン aria-pressed、language select onChange |
| `components/settings/__tests__/TerminalSection.test.tsx` | font size +/- + min/max disabled |
| `components/settings/__tests__/GatewaySection.test.tsx` | URL 表示、Token mask、Copy → toast、QR → modal、Re-enter → dialog、Logout → confirm |
| `components/settings/__tests__/SystemStatusSection.test.tsx` | initial fetch、5s polling (fake timers)、エラー表示、unmount で polling 停止 |
| `components/settings/__tests__/RateLimitsSection.test.tsx` | refresh で refreshKey++ |
| `components/settings/__tests__/ClaudeLimits.test.tsx` | unconfigured / pending / unavailable / configured の 4 state |
| `components/settings/__tests__/CodexLimits.test.tsx` | 同上 |
| `components/settings/__tests__/LimitsRow.test.tsx` | collapsed/expanded toggle、color thresholds (50/90)、stale 表示 |
| `components/settings/__tests__/QrModal.test.tsx` | open/close、URL を SVG に渡す、close で focus 戻し |
| `components/settings/__tests__/ReauthDialog.test.tsx` | 入力 → verify 成功で close、401 で error 表示 |
| `components/__tests__/Sidebar.test.tsx` (拡張) | 3 タブ全て interactive、URL pathname → activePanel、Settings click で navigate |
| `routes/__tests__/settings.test.tsx` | SettingsRoute が SettingsPanel + TerminalPane を描画、未認証時は redirect |

### Flow integration

| ファイル | 内容 |
|---|---|
| `__tests__/flows/settings-theme-flow.test.tsx` | Settings タブ → theme 'light' 選択 → tokens 切替 + xterm theme 切替 |
| `__tests__/flows/settings-language-flow.test.tsx` | language 'en' 選択 → ja → en に翻訳済み key 切替を確認 |
| `__tests__/flows/settings-gateway-flow.test.tsx` | Copy URL (clipboard mock) → toast、Logout → /web/login |
| `__tests__/flows/settings-limits-flow.test.tsx` | Refresh ボタンで Claude+Codex 両方 fetch 発火 |

### E2E (Playwright)

| ファイル | 内容 |
|---|---|
| `tests/e2e/web/settings-tab.spec.ts` | Sessions ↔ Settings 切替、URL 同期、TerminalPane が mount 維持 |
| `tests/e2e/web/settings-theme.spec.ts` | 3 ボタンで theme 切替、reload 後も persist |
| `tests/e2e/web/settings-language.spec.ts` | en/ja 切替、UI ラベルが切替わる |
| `tests/e2e/web/settings-fontsize.spec.ts` | +/- で xterm font 変更、reload 後も persist |
| `tests/e2e/web/settings-gateway.spec.ts` | Copy URL、QR モーダル開閉、Logout で /web/login へ |

### iPad リグレッション

- `app/` 側の jest テストには触らない
- `packages/shared/src/` 変更なし
- `/embed/terminal` 影響なし

### 手動検証 (Phase 2b 完了時)

- `localStorage` を disabled にした private window で動作確認 (silent fail でクラッシュしない)
- macOS / Windows / Linux ブラウザで `prefers-color-scheme` 切替時の theme 追従
- QR スキャンで実機モバイル (iPad) からペアリング成功
- 5 sessions 同時 + Settings 開いて 5min 放置 → polling リーク・FPS 劣化なし

### カバレッジ目標

Phase 2a と同水準: 新規ファイルは行カバレッジ 80%+、Limits/SystemStatus は state 全パス + エラー path をテスト。

## 段階的実装の目安

| サブフェーズ | 内容 |
|---|---|
| **2b-1: Theme/i18n 基盤** | settings store、lightTokens 追加、useTheme() 改修、i18n init、locale ファイル骨格、XtermView 改修 |
| **2b-2: Settings ルートと Sidebar 改修** | SettingsRoute、Sidebar 3 タブ interactive、AuthenticatedShell 抽出 |
| **2b-3: Appearance / Terminal セクション** | 2 セクション + ユニット/コンポーネントテスト |
| **2b-4: Gateway セクション** | URL/Token/Copy/QR/Reauth/Logout/Version + 関連 modal |
| **2b-5: SystemStatus セクション** | polling + state UI |
| **2b-6: Limits セクション** | ClaudeLimits / CodexLimits / LimitsRow 移植 + Refresh |
| **2b-7: 既存 Phase 2a UI の i18n key 化** | Sidebar / Sessions / CRUD ダイアログ等の hardcoded 文字列を t() で置換 |
| **2b-8: Flow tests + E2E + ポリッシュ** | flows 4 本 + E2E 5 本 + Phase 2c 向け Files タブのラベル更新 |

合計 30-40 タスク程度を見込む (Phase 2a と同等規模)。具体タスク数は writing-plans phase で確定。

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| Phase 2a 既存 UI の hardcoded 文字列が多く、i18n key 化のスコープが広がる | 想定タスク数増 | 2b-7 として独立サブフェーズ化、key naming convention を最初に決めて並列化 |
| `react-i18next` を入れたあと既存テストの assertion (英語固定) が壊れる | 既存テスト fail 連鎖 | locale を test setup で `'en'` 固定し、既存 assertion をそのまま温存 |
| matchMedia が jsdom で動かない | useTheme テスト失敗 | setupTests.ts に matchMedia polyfill 追加 (Phase 2a でも追加済み箇所流用) |
| Light theme で xterm の selection / cursor の可視性が悪い | 視認性低下 | mobile light テーマ完全移植 + 手動目視確認 |
| qrcode.react の bundle size 増 | 初期ロード劣化 | dynamic import で QrModal を lazy load (open 時のみロード) |
| Settings panel の vertical scroll が長すぎる | UX 低下 | scrollable container + section header に sticky 効果 (要確認) は Phase 2c 以降 |
| Limits の `unconfigured` 状態でユーザーが混乱する | サポート負荷 | mobile と同じドキュメントリンクに誘導 |

## 実装順序の目安 (依存関係)

```
2b-1 (基盤) ─┬─ 2b-2 (ルート + Sidebar)
              ├─ 2b-3 (Appearance/Terminal)
              ├─ 2b-4 (Gateway)
              ├─ 2b-5 (SystemStatus)
              ├─ 2b-6 (Limits)
              └─ 2b-7 (i18n key 化)
                            │
                            └─ 2b-8 (Flow + E2E + ポリッシュ)
```

2b-3 〜 2b-6 は基盤完了後は並行可能 (subagent-driven development で並列タスク化)。

## 留意点

- **mobile parity を優先**: Limits / SystemStatus / SettingsPanel の構造は mobile 既存実装を踏襲。新発明しない。
- **i18n key naming**: `<domain>.<scope>.<key>` (例 `settings.appearance.theme`)。8 言語化を見越して階層化。
- **wrappedClient 統一**: `SettingsRoute` でも `SessionsRoute` と同じ wrappedClient パターンで 401 intercept。`AuthenticatedShell` に共通化することを推奨 (Phase 2a IMP-1 follow-up と兼ねる)。
- **dynamic import**: QrModal は lazy load で OK (qrcode.react は重め)。
- **Phase 2c へのフック**: Files タブの label を "Coming in Phase 2c" に更新、`/web/files` ルートは未実装でも 404 にせず redirect でフォールバック。
- **既存 Phase 2a 互換**: events 購読 / Sidebar Sessions / TerminalPane の挙動は変更しない。i18n key 化のみ。
