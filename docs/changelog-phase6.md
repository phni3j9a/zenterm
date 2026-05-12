# Phase 6 (UI/UX 完成度) Changelog

> Branch: `feature/web-pc-phase-6-ui-polish`
> Spec: `docs/superpowers/specs/2026-05-12-pc-web-phase-6-ui-polish.md`
> Plan: `docs/superpowers/plans/2026-05-12-pc-web-phase-6-ui-polish.md`
> Final tag: `web-pc-phase-6-done`

## 目的

Phase 5b で機能完成した PC Web 版を、アプリ版 (iOS) と並べても遜色のない体験まで磨き込む。新規機能の追加は最小限で、視覚階層・空状態・オンボーディング・マイクロインタラクションを徹底的に仕上げた。

## 完了タスク

### F. 基盤プリミティブ (3 件)

- **F1**: デザイントークン拡張 — `shadows.{sm,md,lg}` / `surfaceSunken` / `overlay` / `focusRing` を追加。light `textMuted` / `focusRing` / `surfaceSunken` を AA 基準に再調整。contrast テスト 12 件で常時保護
- **F2**: 共通 UI プリミティブ 7 件 — `Card / EmptyState / Stepper / Spinner / Skeleton / Badge / IconButton` を新設。56 ユニットテスト付き
- **F3**: lucide-react 統一 — `components/ui/icons/index.ts` で 35 アイコン barrel。Unicode 雑居から SVG ベースへ移行 (tree-shakable、bundle 影響なし)

### G. 画面別リファイン (7 件)

- **G4**: Login 刷新 — `IconTerminal` ロゴ + tagline + Card 包み + OTP 4 マス入力 (paste/矢印/Backspace/autocomplete=one-time-code) + alert アイコン
- **G5**: LeftRail 構造変更 — フッタタブを廃止し 64px 左縦タブバーに統合 (Sessions/Files/Settings + Logout)。ArrowUp/Down キーボードナビ + `aria-selected` + Tooltip。`<nav>` 直下に `<div role="tablist">` の正規構造で WCAG AA 維持
- **G6**: Sessions リスト — 8px 状態ドット (active/idle/detached) + chevron icon + active 行の elevated card + heading 拡大 + `+ New Session` の pill 化
- **G7**: Files 刷新 — Toolbar を IconButton row へ + `IconHome` + `IconChevronRight` breadcrumb + folder/file accent icon + 空状態 `EmptyState` 化
- **G8**: Terminal Header シンプル化 — `[w0]` 角括弧除去 + ID/Reconnect を IconButton + 接続ステータスを Badge primitive (success/warning/error/neutral + Wifi icon)
- **G9**: Settings リファイン — 5 セクションを Card で分離 + Gateway CTA を grid 配置 (primary/secondary/danger 序列) + SystemStatus を 3 列 grid + memory bar + RateLimits の "B" を Badge + plan i18n
- **G10**: 空状態統一 — SessionsListPanel / MultiPaneArea / TerminalPane / FilesList / FilesViewerEmpty の 5 箇所すべて `EmptyState` プリミティブ化

### H. オンボーディング / マイクロ (3 件)

- **H11**: Onboarding 3 ステップガイド — Card + Stepper + IconRocket。セッション 0 件かつ dismissOnboarding=false で sessions タブに表示。settings store persist v2→v3 マイグレーション付き
- **H12**: トランジション + Skeleton — `.zen-fade-*` ユーティリティ + `prefers-reduced-motion: reduce` で無効化。SessionsList / FilesList の初回 fetch を Skeleton placeholder 化。`index.css` の orphan 問題も修正 (main.tsx から import)
- **H13**: Focus ring + keyboard tour — グローバル `:focus-visible` outline (CSS 変数 `--zen-focus-ring` を ThemeProvider から動的注入)。`tests/manual/keyboard-tour.md` で WCAG 2.1.1 / 2.4.7 手動チェックリスト

### E. 番外: 安全性改善 (1 件)

- **E1**: e2e tmux socket 分離 — gateway は `execFileSync('tmux', args)` を直接呼ぶため `HOME` だけ分離してもユーザーの作業用 tmux と `/tmp/tmux-$EUID/default` を共有してしまう問題を解消。`createGatewayEnv()` ヘルパで `TMUX_TMPDIR` を独立 `mkdtempSync` ディレクトリに設定し、28 spec 全てを refactor。CLAUDE.md にルールも追記

## 非機能要件 (Phase 5b 水準維持)

| 項目 | 基準 | 結果 |
|---|---|---|
| WCAG AA contrast | >= 4.5:1 | ✅ axe-core a11y.spec 5/5 pass |
| `focusRing` 非テキストコントラスト | >= 3:1 | ✅ contrast テストで保護 |
| i18n | 8 言語 (en, ja, es, fr, de, pt-BR, zh-CN, ko) | ✅ 全 locale に新規キー追加 |
| reduced motion | `prefers-reduced-motion: reduce` でアニメ無効 | ✅ phase6-reduced-motion.spec.ts 4/4 pass |
| 既存テスト | web 670+ / gateway 143+ / e2e pass 維持 | ✅ web 764 / gateway 143 (合計 907 unit) |
| tsc | clean | ✅ |

## 主な commit (21 件、新しい順)

| SHA | サマリ |
|---|---|
| e9af022 | test(e2e): isolate tmux socket per spec via TMUX_TMPDIR (E1) |
| 7225791 | feat(web): global :focus-visible ring + manual keyboard tour (H13) |
| 972acfe | feat(web): add zen-fade CSS + Skeleton loading + reduced-motion e2e (H12) |
| 02d47e5 | feat(web): add 3-step onboarding guide for first-run users (H11) |
| 908863f | feat(web): unify empty states with EmptyState primitive (G10) |
| 46b9346 | feat(web): Card-based Settings + rateLimitsWarning wiring (G9) |
| 5b738c0 | feat(web): simplify Terminal header with Badge + IconButton (G8) |
| a8cdf12 | feat(web): refresh Files toolbar/breadcrumb/items with icons (G7) |
| a863587 | feat(web): refresh Session row with state dot + chevron (G6) |
| 1f50fed | fix(web): resolve aria-required-children by moving non-tab elements out of tablist (G5 retro) |
| fc848bd | feat(web): redesign Login with logo + tagline + OTP input (G4) |
| 247962b | refactor(web): replace footer tabs with vertical LeftRail (G5) |
| 72d801d | feat(web): add lucide-react icon barrel (F3) |
| 5843eaa | feat(web): add 7 UI primitives (F2) |
| 6fa09b2 | feat(web): extend theme tokens with shadows, surfaceSunken, overlay, focusRing (F1) |
| 8625e6c | docs(phase-6): add spec and plan for UI/UX polish phase |

加えて plan 単独 fix が 5 件 (a5032a3 / 9379084 / a2a727f / 82fec77 / 1495c6d)、合計 21 commits。

## 残作業

- **Phase 7 root-cause fix**: gateway の `runTmux()` を `tmux -L $TMUX_SOCKET ...` 経由に変更し、tmux socket を gateway インスタンス単位で永続的に分離する (Phase 6 では env 経由の workaround で済ませた)
- **rateLimitsWarning データソース**: `useRateLimitsWarning` hook は実装済みだが、Claude/Codex の rate-limits データはコンポーネント local state にしかないため現状常に `false`。global store を作る Phase で配線
- **スクリーンショット再撮影**: `tests/manual/screenshot.spec.ts` 5 件は外部 gateway 起動前提のため、手動 walkthrough と並行して `docs/screenshots/web-pc-*` を撮り直す
