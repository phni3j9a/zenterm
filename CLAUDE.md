# palmsh — エージェント指示

## プロジェクト概要
iPhone → Raspberry Pi ターミナル接続システム（モノレポ）

## パッケージ構成
| パッケージ | 概要 |
|-----------|------|
| `packages/gateway` | Fastify + WebSocket + node-pty ターミナルゲートウェイ |
| `packages/mobile` | Expo / React Native モバイルクライアント |
| `packages/shared` | 共通型定義 |

## 技術スタック
- **Gateway**: Node.js, TypeScript, Fastify, ws, node-pty, tmux, zod
- **Mobile**: Expo SDK 54, React Native, expo-router, react-native-webview, zustand, zod
- **共通**: npm workspaces, TypeScript

## 開発コマンド
```bash
npm install                 # 全パッケージ依存インストール
npm run dev:gateway         # Gateway 開発サーバー
npm run dev:mobile          # Expo dev server
npm run build:gateway       # Gateway TypeScript ビルド
```

## 設計方針
- terminal 描画は WebView + xterm.js（ネイティブ実装ではない）
- 認証は Bearer token（.env の AUTH_TOKEN）
- tmux セッションの prefix は `psh_`
- WebView ↔ RN 間通信は postMessage bridge

## 注意事項
- xterm.js v6 では `allowProposedApi: true` が必須
- xterm.js は CDN ではなく `public/terminal/lib/` に自前ホスト
- iOS WebView では CDN 読み込みが不安定なため
- gateway の `.env` は git 管理外（`.env.example` を参照）
