# ZenTerm Server — エージェント指示

## プロジェクト概要
マルチ端末ターミナル接続システム（サーバー側）
iPhone アプリ + PC Web から macOS / Linux サーバーに接続し、tmux セッションを共有する。

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
- **systemd**: `zenterm-gateway.service` は npm 公開版の `zenterm-gateway` パッケージを npx キャッシュ経由で起動する。ローカル変更を反映するには `npm publish` 後に再インストールが必要（このリポジトリを直接 systemd から起動しているわけではない）。設定ファイル実体は `~/.config/systemd/user/zenterm-gateway.service`、ユーザースコープで稼働
- **tmux セッションと CGroup**: Gateway の子プロセスとして tmux が起動するため、`systemctl --user stop zenterm-gateway` は既存 tmux セッションも巻き込んで落とす可能性あり。停止前に稼働中セッションを確認すること

## 設計方針
- Web: xterm.js を npm パッケージとして直接 import（WebView 不要）
- 認証は Bearer token（.env の AUTH_TOKEN）
- tmux セッションの prefix は `zen_`
- テーマは mobile/web 共通の Zen カラートークン（dark/light）

## Git / ブランチ運用
- この repo では `main` への直接作業・直接コミットを避け、`main` から `feature/...`、`fix/...`、`chore/...` を切って作業する
- `app` も同時に変更する場合は、両 repo で同じブランチ名を使う
- 常設の `develop` ブランチは前提にしない。必要性が明確な場合のみ導入を検討する
- 未コミット変更がある場合は、勝手に branch 切替や stash をしない

### 運用フロー
1. 未コミット変更がなければ `main` を最新化してから `git switch -c feature/...`、`fix/...`、`chore/...` を作る
2. 既に未コミット変更がある場合は、その状態のまま `git switch -c <branch-name>` で作業ブランチへ移す
3. `app` も同時に変更する場合は、両 repo で同じブランチ名を使う
4. 作業中のコミットは作業ブランチに積み、`main` には未完成の変更を入れない
5. 作業完了後は PR またはレビュー可能な差分を作成し、確認後に `main` へマージする
6. マージ後は不要になった作業ブランチを削除する

## 注意事項
- xterm.js v6 では `allowProposedApi: true` が必須
- Mobile 用 xterm.js は CDN ではなく `public/terminal/lib/` に自前ホスト（iOS WebView の制約）
- Web 用 xterm.js は npm パッケージから Vite でバンドル
- `gateway/public/app/` はビルド成果物のため git 管理外
- gateway の `.env` は git 管理外（`.env.example` を参照）
- モバイルアプリは別リポジトリ（zenterm-app）で管理
- 拡張計画は `docs/roadmap.md` を参照
