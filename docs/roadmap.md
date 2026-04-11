# ZenTerm Web ロードマップ

> 最終更新: 2026-07-19

## Phase 1: Web 基盤 ✅

Web クライアントの土台を構築。

- [x] packages/web 初期セットアップ (React 19 + Vite + Zustand)
- [x] Zen テーマトークン (CSS Custom Properties, dark/light)
- [x] レイアウト (Header, Sidebar, StatusBar)
- [x] 認証 (Bearer token ログイン)
- [x] セッション管理 (一覧, 作成, リネーム, 削除)
- [x] ターミナル (xterm.js 直接統合, WebSocket)
- [x] マルチタブ (タブ切替, タブ閉じ)
- [x] ファイルマネージャ (ブラウザ, エディタ, アップロード)
- [x] Gateway 配信統合 (`/app/*` で SPA 配信)
- [x] WebSocket 自動再接続 (指数バックオフ, 最大 5 回)
- [x] セッション削除確認モーダル (カスタム UI)
- [x] ターミナルのコード分割 (xterm.js を dynamic import)
- [x] systemd / launchd サービス連携

## Phase 2: UX 磨き込み ✅

日常使いの体験を向上させる。

- [x] キーボードショートカット
  - `Ctrl+T` 新規タブ
  - `Ctrl+W` タブ閉じ
  - `Ctrl+Tab` / `Ctrl+Shift+Tab` タブ切替
- [ ] ターミナル内検索 (`Ctrl+Shift+F`, xterm.js search addon)
- [ ] コピー&ペースト改善 (選択時自動コピー, 右クリックペースト)
- [ ] ドラッグ&ドロップ — ファイルブラウザからターミナルへパス入力

## Phase 3: ファイルマネージャ強化 ✅

モバイルアプリと同等のファイル操作を Web でも。

- [x] ファイル操作 API 統合 (削除, リネーム, コピー, 移動)
- [x] 新規ファイル / 新規ディレクトリ作成
- [x] 右クリックコンテキストメニュー
- [x] ファイル検索 / フィルタ (インクリメンタル)
- [x] 画像プレビュー (モーダル表示)
- [ ] PDF プレビュー
- [ ] Markdown プレビュー

## Phase 4: ペイン分割 ✅

複数ターミナルの同時表示。

- [x] 横 / 縦分割で複数ターミナル同時表示
- [x] ドラッグでペインサイズ調整
- [x] ペインツリー構造 (Zustand store)
- [ ] tmux ウィンドウ / ペイン構造との連携
- [ ] ペインレイアウトの保存 / 復元

## Phase 5: システムモニタリング UI ✅

モバイルアプリのシステム監視機能を Web にも。

- [x] CPU / メモリ / ディスク / 温度のダッシュボード表示
- [x] リアルタイムグラフ (SVG スパークライン, 5秒間隔ポーリング)
- [x] サイドバー Monitor タブ
- [x] document.hidden 時のポーリング停止

## Phase 6: 多言語対応 (i18n) ✅

モバイルアプリと同じ多言語基盤を Web にも展開。

- [x] i18next / react-i18next 導入
- [x] Web 専用ロケールファイル (モバイルと同じキー構造)
- [x] 対応言語: EN, JA, DE, ES, FR, PT-BR, ZH-CN, KO
- [x] 設定画面の言語切替 UI
- [x] 主要コンポーネントの i18n 対応

## Phase 7: 高度な機能 ✅

- [x] ブラウザ通知 (Notification API, activity-while-away パターン)
- [x] カスタムフォント設定 UI (7種類のモノスペースフォント)
- [x] セッションのブックマーク / ピン留め (★ソート最上位)
- [x] 通知のオン/オフ設定
- [ ] マルチサーバー対応 (複数 Gateway に接続)
- [ ] コマンド履歴パネル
- [ ] SSH トンネリング対応
