# ZenTerm PC Web 版 — Phase 6 (UI/UX 完成度) 設計書

> 状態: Phase 1〜5b すべて main にマージ済 (`web-pc-phase-{1, 2a, 2b, 2c, 2d, 3, 4a, 4b, 5a, 5b}-done`)。本 Phase は機能完成後の **UI/UX 完成度総仕上げ**。新規機能の追加は最小限で、視覚階層・空状態・オンボーディング・マイクロインタラクションを徹底的に磨く。

## 背景

Phase 5b 完了時点で PC Web 版は機能上 v1 リリース可能だが、アプリ版 (zenterm-app, iOS) と並べたとき次の体験差がある:

| # | 差分 | 影響 |
|---|---|---|
| 1 | アプリは明るい背景 + 白い "島カード"。Web は全面フラット黒で奥行きが弱い | 質感 |
| 2 | アプリの Sessions 行は "パス + タイムスタンプ + 状態ドット" 三層構成。Web は等幅パスのみ | 情報密度の偏り |
| 3 | アプリの空状態はアイコン + 見出し + 説明 + CTA。Web は単一行プレーンテキスト | エンプティ体験 |
| 4 | アプリには 3 ステップオンボーディング (gateway 起動 / QR / ブラウザ案内) | 初回体験 |
| 5 | アプリ Files は色付きフォルダ + breadcrumb 階層 + `>` シェブロン | 視認性 |
| 6 | アプリ Terminal header は `Connected` chip + セッション名のみ。Web は `p1 term1 [w0] [ID] − 14 +` で開発者向け密度 | 認知負荷 |
| 7 | アプリは bottom tab がアイコン主体で active 視認性高い。Web の footer は橙ドット意味不明 + 弱いトーン | ナビ視認性 |
| 8 | アプリの Login は QR で自動。Web は素朴な card で字間広い placeholder | 第一印象 |
| 9 | アプリ Settings はカード分割。Web は縦長 1 カラムで CTA 4 連続が地味 | 序列 |
| 10 | アプリは iOS native トランジション。Web は hover 以外のフィードバック乏しい | マイクロ体験 |
| 11 | アプリは見出し太字 + 補助グレーで階層明瞭。Web は wieght 差が弱い | タイポ階層 |
| 12 | カラーは共通トークン (Zen palette) を使用しているが、`primarySubtle` がほぼ未使用 / surface 段差が薄い | カラー運用 |

トークン (`packages/web/src/theme/tokens.ts`) はアプリ版と同名で揃っているため、**新規トークンの追加は最小限とし、未活用トークンの活用 + プリミティブ拡充 + 画面ごとの再構成**で完成度を上げる。

## 目的

PC Web 版を「アプリ版と並べても遜色のない、むしろデスクトップ生産性が際立つ」体験に仕上げる。具体的には:

- 全画面で奥行き / 階層 / 空状態 / 序列がアプリ版と同等以上
- 初回ユーザーが迷わず token 入力 → セッション接続まで到達できる
- Sessions / Files / Settings の主要操作が "視線移動 1 回 + クリック 1 回" で完結
- Phase 5b で確立した非機能要件 (WCAG AA / 6 言語 i18n / prefers-reduced-motion) は退行させない

## スコープ

### In scope（Phase 6, 13 タスク）

#### F. 基盤プリミティブ（3 件）

##### F1. デザイントークン拡張
- 新規追加: `shadows.{sm, md, lg}`, `surfaceSunken`, `overlay` (modal backdrop), `focusRing`
- 既存追加: `primarySubtle` (現状 #2C3328) を使い込めるように surface との明度差を見直す
- `darkTokens` / `lightTokens` の両方で WCAG AA を維持 (textMuted 等は Phase 5b で対応済 = 退行禁止)
- 受入: `tests/e2e/web/a11y.spec.ts` が引き続き 0 violation。`packages/web/src/theme/__tests__/tokens.test.ts` (新規) で全 text/bg ペアの contrast >= 4.5:1 を保証

##### F2. 共通 UI プリミティブ追加
- 新設ファイル: `components/ui/Card.tsx`, `EmptyState.tsx`, `Stepper.tsx`, `Spinner.tsx`, `Skeleton.tsx`, `Badge.tsx`, `IconButton.tsx`
- 各コンポーネントに variant prop と stories 代替の `__tests__/*.test.tsx` を完備
- 受入: 各 primitive がアクセシビリティ要件 (role / aria-label / focus ring) を満たし、ユニットテスト >= 5 件ずつ

##### F3. アイコン基盤統一
- 現状 `≡ ⌄ ↑ ⚙` 等の Unicode 雑居をやめ、`lucide-react` または同等の lightweight tree-shakable icon を採用
- 新規ファイル: `components/ui/icons/index.ts` で使用アイコンの re-export を集約 (`Sessions`, `Folder`, `FolderOpen`, `Settings`, `Plus`, `ChevronRight`, `Search`, `Copy`, `Trash`, `Upload`, `Download`, `Eye`, `EyeOff`, `SortAsc`, `RefreshCw`, `Power`, `Wifi`, `WifiOff`, `Loader2`, `X`, `Check`, `Info`, `AlertTriangle`, `XCircle`, `Rocket`, `Terminal`, `QrCode`)
- bundle size 増加は gzip <= +25KB に抑える
- 受入: 既存 Unicode アイコンを全て置換、bundle size 計測コメントを `packages/web/vite.config.ts` 横に記す

#### G. 画面別リファイン（7 件）

##### G4. Login 画面リフレッシュ
- ロゴ + "ZenTerm" タイトル + tagline (`login.tagline` i18n) を追加
- token 入力を **4 桁個別マス UI** (`OtpInput`) に変更。`<input>` 内の自動 split、矢印キー移動、paste 対応、validation 表示
- Gateway URL を chip 表示 (mono font + コピーボタン)
- 背景: 中央 card に subtle shadow + bgElevated、Dark/Light で奥行き付与
- `error` 表示は inline alert (icon + text) で復活
- 受入: Tab で `OTP[0] → OTP[1] → ... → Sign in` の順に移動。token 不一致時 shake アニメ (reduced-motion 時はスキップ)。i18n 6 言語の文字列を Phase 5 で投入したファイルに `login.tagline` 追加

##### G5. AuthenticatedShell 全体構造
- 現状 1 ペイン Sidebar + main の単純構成を **3 zone (LeftRail / SidebarPanel / Main)** に再編
- LeftRail: 幅 64px 固定の縦タブバー (Sessions / Files / Settings + 区切り + Logout)。active タブは accent bar + 強調アイコン
- SidebarPanel: タブで切替わる中央リストペイン (現状の Sessions/Files/Settings の中身)
- 旧フッターの "Sessions / Files / Settings" 横タブは廃止し、LeftRail に統合
- 受入: 既存テストの role 期待 (`navigation`, `tablist`) を新構造で再現。Keyboard navigation (Tab / Arrow / Enter) を維持。URL fragment による状態保存も継続

##### G6. Sessions リスト再構成
- 各 SessionRow を **Card 風 (surface 背景 + 角丸 + hover でわずかに浮く)** に変更
- 行レイアウト: `[状態ドット (8px solid)]` `[セッション名 (heading)]` `[パス (small, mono)]` `[右側に lastActivity 相対時間 (small, muted)]` `[> chevron]`
- 状態ドット: `success` (attached / active) / `warning` (running but idle > 5min) / `muted` (detached) を意味付け。tooltip で説明
- `+ New Session` を pill ボタン化 (primary 塗りつぶし、+ icon 付き)、リスト下部から先頭直下へ移動
- `ACTIVE · N` ヘッダを heading サイズ (18px) に。アプリ版と同等
- 受入: 既存テスト (`__tests__/SessionsListPanel.test.tsx`) を新構造で更新。新 prop `lastActivityAt` を `TmuxSession` に追加するなら shared 型を拡張、なければ表示しない (現状 `windows` から推測)。フォーカスフロー (Tab/Enter/F2/Delete) は退行禁止

##### G7. Files ページ刷新
- Toolbar: アクション 4 つ (`Sort` `Toggle hidden` `Upload` `New`) を **icon-only IconButton + tooltip** で横並び 1 行化、Sort と Hidden は左寄せ、Upload と New は右寄せ (primary)
- Breadcrumb: ホームアイコン + `>` 区切り + 各セグメントクリック可能、最後セグメントは強調
- FilesItem: アイコンを folder/file 別の Lucide icon + アクセント色 (folder = primaryMuted, file = textSecondary)、右に `>` chevron、size/mtime を二行目に compact 表示
- Empty: `EmptyState` プリミティブで rocket icon + "このフォルダは空です" + "ファイルをドラッグして追加" の説明
- ViewerEmpty: 既存メッセージを `EmptyState` に置換 (icon + 見出し + 説明)
- 受入: 既存 e2e `files-browse` 系のセレクタを退行させずに更新 (`aria-label` 維持)。i18n キー `files.toolbar.*` を追加で多言語化

##### G8. Terminal Header シンプル化
- 既存 `p1 term1 [w0] [ID] − 14 +` を **アプリ版相当の最小情報** に再構成
- 表示: `[セッション名 (heading)] [Window N (small, muted)]` 左寄せ + `[Font size spinner (− 14 +)] [Reconnect IconButton] [Connected/Disconnected Badge]` 右寄せ
- pane 番号 (`p1` 等) と pane ID は `aria-label` 内に格納し、視覚表示は削除 (focus indicator は別途)
- ステータス badge: `success` chip (Connected) / `error` chip (Disconnected) で意味付け。アイコン + テキスト
- 受入: 既存 TerminalHeader テストを更新。コンテキストメニューや `data-testid` の互換は保つ

##### G9. Settings リファイン
- Appearance / Terminal / Gateway / System Status / Rate Limits を **Card プリミティブ** で分離 (現状細線のみ → 立体感)
- ボタン序列: `Sign out` (danger outline) は最下部に隔離、`Re-enter token` (secondary), `Copy Web URL` / `Show mobile QR` (primary outline) を 1 行 grid 配置
- SystemStatus を 3 列 grid (Uptime / Load / Memory) + Memory バー可視化
- Rate Limits の "B" バッジ意味不明問題を解決: Claude/Codex 別タブで grouping + setup guide リンクを CTA 化
- 受入: 既存 SettingsPanel テストを更新。CTA グループは既存挙動を維持

##### G10. 空状態統一
- 以下 5 箇所すべてを `EmptyState` プリミティブ化:
  1. `SessionsListPanel`: セッションなし
  2. `FilesList`: ディレクトリ空
  3. `FilesViewerEmpty`: ファイル未選択
  4. `MultiPaneArea`: pane 未割当時 (現状はセッション選択促し)
  5. `AuthenticatedShell`: メイン未選択 ("Select a session from the sidebar to start.")
- 各 EmptyState には icon + 見出し + 説明 + 任意 CTA を持たせる
- 受入: 各画面で空状態 e2e を 1 件以上カバー (新規 `tests/e2e/web/phase6-empty-states.spec.ts`)

#### H. オンボーディング / マイクロ（3 件）

##### H11. Onboarding 3 ステップガイド
- 新規ファイル: `components/onboarding/OnboardingGuide.tsx`
- 表示条件: `settingsStore.dismissOnboarding === false` AND セッション数 === 0 のとき、Sessions タブ右ペイン中央に表示
- 内容: アプリ版と揃えて **3 番号付きカード**
  1. "Gateway を起動" — `npx zenterm-gateway` コマンドのコピー可能 code block
  2. "Token を入力" — 既に Login 突破済みなら ✓ で skip 表示
  3. "セッション作成" — `+ New Session` ボタンへスクロールハイライト
- 末尾に "Don't show again" toggle + dismissOnboarding を localStorage 永続化
- 受入: `__tests__/OnboardingGuide.test.tsx` で表示条件 / dismiss / step 表示を網羅

##### H12. トランジション / スケルトン
- 主要遷移にトランジション付与 (`prefers-reduced-motion: reduce` 時は無効化):
  - Tab 切替: 150ms opacity fade
  - SidebarPanel 開閉: 200ms width
  - SessionRow hover: 100ms surface-color transition
- ローディング表示: 初回 fetch 中の SessionsList / FilesList に `Skeleton` プリミティブを使った placeholder
- 受入: `prefers-reduced-motion: reduce` 環境ではトランジションが発火しない (e2e で `emulateMedia({ reducedMotion: 'reduce' })`)

##### H13. Focus ring / Tooltip 統一
- 全 interactive 要素に統一の `:focus-visible` outline (`tokens.colors.focusRing`, 2px solid)
- Tooltip primitive を `IconButton` のデフォルトに組込み (Phase 5b で `Tooltip.tsx` 修正済をベース)
- 受入: a11y e2e で違反 0 を維持。手動でキーボード操作の focus 可視性を `tests/manual/keyboard-tour.md` に追加

#### I. ドキュメント（範囲外: 別タスク不要）

- スクショ刷新は Phase 6 完了時に既存 `tests/manual/screenshot.spec.ts` を再実行するだけ。仕様変更タスクとしては立てない (Phase 6 タスク群の "完了の証" として merge 後に実施)。

### Out of scope

- 機能追加 (新規ページ / 新規 API)
- 多デバイス対応の専用最適化 (iPad は引き続き互換維持のみ)
- Service Worker / PWA
- アプリ版本体 (Swift) の改修
- gateway 側の `/embed/terminal` の改修 (モバイル WebView は無変更)

## 非機能要件 (Phase 5b 水準維持)

| 項目 | 基準 | 確認方法 |
|---|---|---|
| WCAG | AA (contrast >= 4.5:1) | `tests/e2e/web/a11y.spec.ts` (axe-core) 0 violations |
| i18n | 6 言語 (en, ja, es, fr, de, pt-BR, zh-CN, ko の Phase 5a 投入分) | 新規キーは全 locale ファイルへ追加 (英語 fallback 可だが英語値必須) |
| reduced motion | `prefers-reduced-motion: reduce` でアニメ無効 | Playwright `emulateMedia({ reducedMotion: 'reduce' })` |
| bundle | gzip <= +30KB (icon ライブラリ + プリミティブ) | `vite build` の dist 出力サイズ計測 |
| 既存テスト | 670 web unit / 143 gateway unit / 40 e2e すべて緑 | CI = `npm test` + Playwright |

## リスク

| リスク | 緩和 |
|---|---|
| LeftRail 構造変更で既存 Sessions/Files/Settings ナビ e2e が広範囲に壊れる | G5 (LeftRail) を最初に実装 + 既存 nav e2e の selector を共通定数化してから G6 以降へ |
| Lucide-react 依存追加で SSR / Vite 構成が変わる | Phase 5 まで SSR 無し / Vite 5 構成は固定 = 影響軽微。ただし import path だけ厳密に統一 |
| Card 化で `surface` トークンの背景が見えなくなり、Dark テーマで暗すぎる印象 | F1 で `bg`/`surface`/`bgElevated` の段差を見直し、Dark でも 5〜7% の明度差を確保 |
| OTP マス入力で日本語 IME / paste で挙動が壊れる | G4 で paste handler を専用実装 (paste で 4 桁全自動入力)。IME 入力中は数字以外を `setSelectionRange` でガード |
| Onboarding がアクセシビリティで音読みされない | H11 で `role="region"` + `aria-labelledby`、step ごとに `aria-current` を切替 |

## 受入

Phase 6 全タスク完了時:

1. `npm test` (web 670+ / gateway 143+) green
2. `npx playwright test --project=web-pc` で a11y / phase5 / phase6-empty / coverage の全 spec green
3. `tsc --noEmit` clean
4. ローカルで Mac mini Chrome / Firefox にて 5 画面手動 walkthrough OK
5. アプリ版スクショと並べた docs/screenshots/web-pc-* 5 枚を再撮影し、Gap マトリクスの 12 項目が "解消" または "意図的に PC dense を選択" になっていること
6. gzip bundle size 増加が +30KB 以内

## 実装順序の指針

依存を考えると次の順:

```
F1 tokens → F2 primitives → F3 icons
  ↓
G5 LeftRail (構造変更)
  ↓
G4 Login / G6 Sessions / G7 Files / G8 Terminal / G9 Settings (並列可能だが順番に Subagent 実行)
  ↓
G10 EmptyState 統一 / H11 Onboarding / H12 transitions / H13 focus
```

各タスクは TDD + Subagent-Driven + two-stage review。詳細は別途 plan ファイル (`docs/superpowers/plans/2026-05-12-pc-web-phase-6-ui-polish.md`)。
