# ZenTerm Browser Rebuild

## Status: 完了 (2026-05-12 web-pc-phase-6-done)

Phase 1〜6 全て main にマージ済。タグ: `web-pc-phase-{1, 2a, 2b, 2c, 2d, 3, 4a, 4b, 5a, 5b, 6}-done`

Phase 6 では UI/UX 完成度を総仕上げ: 共通 UI プリミティブ 7 件 + lucide-react アイコン基盤 + LeftRail 縦タブバー + Login/Sessions/Files/Terminal/Settings の画面別リファイン + EmptyState 統一 + Onboarding 3 ステップガイド + reduced-motion 対応 transition + `:focus-visible` 統一。あわせて e2e の tmux socket 分離 (TMUX_TMPDIR) で開発者作業中の tmux を保護。

> 最終更新: 2026-05-12

旧 `packages/web` 実装は、ブラウザ版を作り直すため削除済み。

現在 server 側に残すブラウザ配信物は以下だけ:

- `/`: ランディングページ
- `/support.html`: サポートページ
- `/lp/*`: ランディングページ用アセット
- `/embed/terminal`: モバイルアプリ WebView 用ターミナル
- `/terminal/lib/*`: モバイル WebView 用 xterm.js アセット

次のブラウザ版は、モバイルアプリが依存する Gateway API と `/embed/terminal` の互換性を壊さない前提で設計する。
