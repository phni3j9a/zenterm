# ZenTerm Browser Rebuild

> 最終更新: 2026-05-06

旧 `packages/web` 実装は、ブラウザ版を作り直すため削除済み。

現在 server 側に残すブラウザ配信物は以下だけ:

- `/`: ランディングページ
- `/support.html`: サポートページ
- `/lp/*`: ランディングページ用アセット
- `/embed/terminal`: モバイルアプリ WebView 用ターミナル
- `/terminal/lib/*`: モバイル WebView 用 xterm.js アセット

次のブラウザ版は、モバイルアプリが依存する Gateway API と `/embed/terminal` の互換性を壊さない前提で設計する。
