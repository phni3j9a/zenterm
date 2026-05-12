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
- **tmux セッションと CGroup**: tmux サーバーは `fork+setsid` で自己デーモン化するため process tree 上は Gateway の子ではなく、PPID は `systemd --user`。さらに systemd unit は `KillMode=process` で起動しているので、`systemctl --user stop|restart zenterm-gateway` で死ぬのは Gateway 本体（と attach 中の PTY クライアント）だけで、tmux サーバーとセッションは保持される。WebSocket 接続中のユーザーは一瞬切断されるが再接続で同じセッションに戻れる
  - `KillMode=process` は `packages/gateway/src/setup.ts` の `buildSystemdUnit()` と `deploy/zenterm-gateway.service` テンプレートの両方で設定済み。`npx -y zenterm-gateway@latest setup` 由来の unit と install.sh 由来の unit のいずれでも tmux は保護される
  - cgroup 上は tmux も Gateway と同じ unit cgroup に属するため、`systemctl kill --kill-whom=all` 等を明示した場合は両方落ちる点に注意

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

## E2E テストの tmux 分離 (重要)

gateway は `execFileSync('tmux', args)` を直接呼び、`-L`/`-S` のソケット指定をしない。
そのため `HOME` だけ分離しても、tmux サーバはユーザーの作業用 (`/tmp/tmux-$EUID/default`)
と共有されてしまう。`npx playwright test` が落ちた瞬間にユーザーの tmux セッション
(例: `_zen_monitor`) ごと巻き添えで死ぬ事故の原因。

**ルール: e2e spec で gateway を spawn する時は必ず `TMUX_TMPDIR` を独立した
`mkdtempSync` ディレクトリに設定する。** これにより gateway 配下の tmux は
`$TMUX_TMPDIR/tmux-$EUID/default` を使うようになり、ユーザー作業 tmux と完全分離される。

実装ヘルパ `tests/e2e/web/helpers.ts` の `createGatewayEnv()` を使うこと。
新規 spec を書く場合も必ずこのヘルパ経由で env を作る。直接 `HOME` だけ
`mkdtempSync` する旧パターンは禁止。

## 注意事項
- xterm.js v6 では `allowProposedApi: true` が必須
- Mobile 用 xterm.js は CDN ではなく `public/terminal/lib/` に自前ホスト（iOS WebView の制約）
- gateway の `.env` は git 管理外（`.env.example` を参照）
- モバイルアプリは別リポジトリ（zenterm-app）で管理
- ブラウザ版の再構築メモは `docs/roadmap.md` を参照
