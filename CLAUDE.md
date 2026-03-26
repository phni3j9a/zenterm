# ZenTerm Server — エージェント指示

## プロジェクト概要
マルチ端末ターミナル接続システム（サーバー側）
iPhone アプリ + PC Web から Raspberry Pi に接続し、tmux セッションを共有する。

## パッケージ構成
| パッケージ | 概要 |
|-----------|------|
| `packages/gateway` | Fastify + WebSocket + node-pty ターミナルゲートウェイ |
| `packages/web` | React + Vite PC向け Web クライアント |
| `packages/shared` | 共通型定義 |

## 技術スタック
- **Gateway**: Node.js, TypeScript, Fastify, ws, node-pty, tmux, zod
- **Web**: React 19, Vite, React Router, zustand, xterm.js (npm直接import), CSS Modules
- **共通**: npm workspaces, TypeScript

## 開発コマンド
```bash
npm install                 # 全パッケージ依存インストール
npm run dev:gateway         # Gateway 開発サーバー
npm run dev:web             # Vite dev server (port 5173, proxy → gateway)
npm run build:gateway       # Gateway ビルド（web ビルドも自動実行）
npm run build:web           # Web ビルド → gateway/public/app/ に出力
```

## 配信アーキテクチャ
- **開発時**: Vite dev (5173) → proxy → Gateway (18765)
- **本番**: `npm run build:web` → `gateway/public/app/` → Gateway が `/app/*` で配信
- **モバイル**: Gateway が `/embed/terminal` を配信 → WebView で表示
- **systemd**: `zenterm-gateway.service` でローカルプロジェクトから直接起動

## 設計方針
- Web: xterm.js を npm パッケージとして直接 import（WebView 不要）
- 認証は Bearer token（.env の AUTH_TOKEN）
- tmux セッションの prefix は `zen_`
- テーマは mobile/web 共通の Zen カラートークン（dark/light）

## 注意事項
- xterm.js v6 では `allowProposedApi: true` が必須
- Mobile 用 xterm.js は CDN ではなく `public/terminal/lib/` に自前ホスト（iOS WebView の制約）
- Web 用 xterm.js は npm パッケージから Vite でバンドル
- `gateway/public/app/` はビルド成果物のため git 管理外
- gateway の `.env` は git 管理外（`.env.example` を参照）
- モバイルアプリは別リポジトリ（zenterm-app）で管理
- 拡張計画は `docs/roadmap.md` を参照
