# ZenTerm Server — エージェント指示

## プロジェクト概要
マルチ端末ターミナル接続システム（サーバー側）
iPhone アプリから macOS / Linux サーバーに接続し、tmux セッションを共有する。

## パッケージ構成
| パッケージ | 概要 |
|-----------|------|
| `packages/gateway` | Fastify + WebSocket + node-pty ターミナルゲートウェイ |
| `packages/web`     | PC ブラウザ向け SPA (React 19 + Vite + xterm.js)。Gateway の `/web/*` で配信 |
| `packages/shared`  | 共通型定義 |

## 技術スタック
- **Gateway**: Node.js, TypeScript, Fastify, ws, node-pty, tmux, zod
- **Web (PC)**: React 19, Vite 5, TypeScript, react-router, zustand, xterm.js v6, lucide-react, i18next (8 言語)
- **共通**: npm workspaces, TypeScript

## 開発コマンド
```bash
npm install                                # 全パッケージ依存インストール
npm run dev:gateway                        # Gateway 開発サーバー
npm run build:gateway                      # Gateway ビルド (web bundle も同梱)
npm run build --workspace=@zenterm/web     # Web のみビルド
cd packages/web && npx vitest run          # Web ユニットテスト
scripts/e2e-docker.sh                      # E2E (Docker 隔離、必須)
scripts/dev-docker.sh                      # 開発用 Gateway を Docker 内で起動
```

## 配信アーキテクチャ
- **モバイル**: Gateway が `/embed/terminal` を配信 → WebView で表示
- **PC Web**: `packages/web` を Vite でビルドして `packages/gateway/public/web/` に出力、Gateway が `/web/*` で配信。Phase 1〜6 で再構築済 (web-pc-phase-6-done タグ)。Phase 7 で Docker 隔離 e2e 基盤を整備
- **systemd**: `zenterm-gateway.service` の `ExecStart` は `~/.local/share/zenterm-gateway/current/dist/cli.js` を node で実行する。`current` は `deploy/install-from-release.sh` が GitHub Releases から取得した version (`~/.local/share/zenterm-gateway/<version>/`) を指す symlink。アップデートは新 version 展開 → symlink 張替え → `systemctl --user restart zenterm-gateway` で完結する。ローカル変更を反映するには `./deploy/install.sh` (リポジトリクローン経路) を使う。設定ファイル実体は `~/.config/systemd/user/zenterm-gateway.service`、ユーザースコープで稼働
- **tmux セッションと CGroup**: tmux サーバーは `fork+setsid` で自己デーモン化するため process tree 上は Gateway の子ではなく、PPID は `systemd --user`。さらに systemd unit は `KillMode=process` で起動しているので、`systemctl --user stop|restart zenterm-gateway` で死ぬのは Gateway 本体（と attach 中の PTY クライアント）だけで、tmux サーバーとセッションは保持される。WebSocket 接続中のユーザーは一瞬切断されるが再接続で同じセッションに戻れる
  - `KillMode=process` は `packages/gateway/src/setup.ts` の `buildSystemdUnit()` と `deploy/zenterm-gateway.service` テンプレートの両方で設定済み。`npx -y zenterm-gateway@latest setup` 由来の unit と install.sh 由来の unit のいずれでも tmux は保護される
  - cgroup 上は tmux も Gateway と同じ unit cgroup に属するため、`systemctl kill --kill-whom=all` 等を明示した場合は両方落ちる点に注意

## 設計方針
- 認証は Bearer token（.env の AUTH_TOKEN）
- tmux セッションの prefix は `zen_`
- テーマは mobile の Zen カラートークン（dark/light）を基準にする

## E2E テストの tmux 分離 (重要)

### 根本原因
gateway (`packages/gateway/src/services/tmux.ts`) は `execFileSync('tmux', args)` を
直接呼び、`-L`/`-S` のソケット指定をしない。そのため HOST 上で `npx playwright test`
を直接走らせると、gateway が spawn する tmux サーバはユーザーの作業用
(`/tmp/tmux-$EUID/default`) と同じソケットを掴み、playwright 側で SIGKILL や
パニックが起きた瞬間にユーザーの tmux セッション (例: `_zen_monitor`) ごと巻き添えで
死ぬ事故が起きる。

**`TMUX_TMPDIR` だけでは不十分**: child の `tmux attach` 等は親プロセスの `$TMUX`
環境変数を継承するため、`$TMUX_TMPDIR` を別ディレクトリに設定しても `$TMUX` が
ホスト socket を指し続けて漏れる。完全分離には PID/mount/network namespace 隔離が必要。

### 唯一の正しい運用: Docker 隔離 e2e
**ルール: PC Web の e2e (`tests/e2e/web/*.spec.ts`) は必ず `scripts/e2e-docker.sh`
経由で実行する。**

```bash
scripts/e2e-docker.sh                            # 全 49 件 (約 1 分)
scripts/e2e-docker.sh tests/e2e/web/foo.spec.ts  # 特定 spec
ZENTERM_E2E_NO_BUILD=1 scripts/e2e-docker.sh     # image 再ビルドをスキップ
```

container 内の tmux socket は `/tmp` (tmpfs) に閉じ込められ、ホストから到達不能。
49 spec を 8 分以上走らせてもホスト `tmux ls` の出力は 1 文字も変わらない (Phase 7
で実証)。

直接 `npx playwright test ...` を host 上で叩くのは禁止。CI / 開発機問わずすべて
Docker 経由で。

### 実装ヘルパ
`tests/e2e/web/helpers.ts` の `createGatewayEnv()` を使うこと。これは container 内
での実行を前提に環境変数を組み立てる。直接 `HOME` だけ `mkdtempSync` する旧パターン
は禁止。

### 開発時の実機テスト
`scripts/dev-docker.sh` で container 内 gateway をインタラクティブ起動できる。
ホストポート 18766 (デフォルト) で host ブラウザから接続可能。container 内の
tmux はホストと完全分離。

## 注意事項
- xterm.js v6 では `allowProposedApi: true` が必須
- Mobile 用 xterm.js は CDN ではなく `public/terminal/lib/` に自前ホスト（iOS WebView の制約）
- gateway の `.env` は git 管理外（`.env.example` を参照）
- モバイルアプリは別リポジトリ（zenterm-app）で管理
- PC Web (`packages/web`) の再構築履歴は `docs/roadmap.md` を参照 (Phase 1〜7 完了)
