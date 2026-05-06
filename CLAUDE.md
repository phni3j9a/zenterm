# ZenTerm Server — エージェント指示

## プロジェクト概要
マルチ端末ターミナル接続システム（サーバー側）
iPhone アプリから macOS / Linux サーバーに接続し、tmux セッションを共有する。

## パッケージ構成
| パッケージ | 概要 |
|-----------|------|
| `packages/gateway` | Fastify + WebSocket + node-pty ターミナルゲートウェイ |
| `packages/shared` | 共通型定義 |

## 技術スタック
- **Gateway**: Node.js, TypeScript, Fastify, ws, node-pty, tmux, zod
- **共通**: npm workspaces, TypeScript

## 開発コマンド
```bash
npm install                 # 全パッケージ依存インストール
npm run dev:gateway         # Gateway 開発サーバー
npm run build:gateway       # Gateway ビルド
```

## 配信アーキテクチャ
- **モバイル**: Gateway が `/embed/terminal` を配信 → WebView で表示
- **ブラウザ版**: 旧 `packages/web` は削除済み。新しいブラウザ版は別途再構築する
- **systemd**: `zenterm-gateway.service` は npm 公開版の `zenterm-gateway` パッケージを npx キャッシュ経由で起動する。ローカル変更を反映するには `npm publish` 後に再インストールが必要（このリポジトリを直接 systemd から起動しているわけではない）。設定ファイル実体は `~/.config/systemd/user/zenterm-gateway.service`、ユーザースコープで稼働
- **tmux セッションと CGroup**: Gateway の子プロセスとして tmux が起動するため、`systemctl --user stop zenterm-gateway` は既存 tmux セッションも巻き込んで落とす可能性あり。停止前に稼働中セッションを確認すること

## 設計方針
- 認証は Bearer token（.env の AUTH_TOKEN）
- tmux セッションの prefix は `zen_`
- テーマは mobile の Zen カラートークン（dark/light）を基準にする

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
- gateway の `.env` は git 管理外（`.env.example` を参照）
- モバイルアプリは別リポジトリ（zenterm-app）で管理
- ブラウザ版の再構築メモは `docs/roadmap.md` を参照
