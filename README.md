# ZenTerm

iPhone からサーバーのターミナルに接続するモバイルターミナルシステム。

Gateway（サーバー側）が tmux セッションを管理し、WebSocket 経由でモバイルアプリに接続。xterm.js による本格的なターミナル描画、ファイルブラウザ、システムモニタリングを備える。

## 特徴

- **フルターミナル** -- xterm.js (v6) による本格描画、CJK / Unicode 対応、スクロールバック 5000 行
- **tmux セッション管理** -- セッションの作成・一覧・アタッチ・デタッチ・削除を REST API + UI で操作
- **ファイルブラウザ** -- ディレクトリ閲覧・ファイル表示・アップロード（写真/ドキュメント対応）
- **システムモニタリング** -- CPU / メモリ / ディスク / 温度 / 稼働時間をリアルタイム表示
- **QR ペアリング** -- Gateway 起動時に QR コードを表示、アプリでスキャンして即接続
- **Web ダッシュボード** -- モバイルアプリなしでもブラウザからアクセス可能
- **自動再接続** -- 指数バックオフで最大 20 回リトライ、接続断に強い
- **ワンライナーインストール** -- systemd / launchd サービスとして自動登録

## アーキテクチャ

```
iPhone (ZenTerm App)           Raspberry Pi / Linux Server
┌────────────────────┐         ┌──────────────────────────┐
│  React Native      │         │  zenterm-gateway         │
│  ┌──────────────┐  │   WS    │  ┌────────────────────┐  │
│  │ WebView      │◄─┼────────►│  │ Fastify + node-pty │  │
│  │ (xterm.js)   │  │         │  └────────┬───────────┘  │
│  └──────────────┘  │         │           │              │
│  postMessage bridge│         │     ┌─────▼─────┐       │
│  ┌──────────────┐  │  REST   │     │   tmux    │       │
│  │ Native UI    │◄─┼────────►│     └───────────┘       │
│  │ (Sessions,   │  │         │                          │
│  │  Files, etc) │  │         │  static: public/         │
│  └──────────────┘  │         │  config: ~/.config/zenterm│
└────────────────────┘         └──────────────────────────┘
```

## パッケージ構成

```
packages/
├── gateway/    Fastify + WebSocket + node-pty ターミナルゲートウェイ
├── web/        React + Vite PC向け Web クライアント
└── shared/     WebSocket メッセージ型・共通型定義
```

| パッケージ | 技術スタック |
|-----------|-------------|
| **gateway** | Node.js, TypeScript, Fastify 5, ws, node-pty, tmux, zod |
| **web** | React 19, Vite, React Router, zustand, xterm.js, CSS Modules |
| **shared** | TypeScript (型定義のみ) |

> モバイルアプリ (ZenTerm App) は App Store からダウンロードできます。

## 必要環境

- **Node.js** >= 20.0.0
- **tmux** (セッション管理に必須)
- **npm** (workspaces 対応)

## クイックスタート

### ワンライナーインストール（推奨）

```bash
cd ~/projects/zenterm && ./deploy/install.sh
```

install.sh が以下を自動実行:
1. tmux / Node.js の確認
2. Gateway ビルド
3. AUTH_TOKEN の対話的生成
4. サービス登録（Linux: systemd / macOS: launchd）
5. 起動確認 + QR コード表示

### 手動セットアップ

```bash
# 依存インストール
npm install

# Gateway ビルド
npm run build:gateway

# 初回セットアップ（対話的に AUTH_TOKEN を設定）
cd packages/gateway && node dist/cli.js setup

# 起動
npm run dev:gateway
```

起動するとコンソールに QR コードが表示される。ZenTerm アプリでスキャンして接続。

## 設定

設定ファイル: `~/.config/zenterm/.env`

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `AUTH_TOKEN` | (必須) | Bearer 認証トークン |
| `PORT` | `18765` | リッスンポート |
| `HOST` | `0.0.0.0` | バインドホスト |
| `SESSION_PREFIX` | `zen_` | tmux セッション名プレフィックス |
| `LOG_LEVEL` | `info` | ログレベル (debug/info/warn/error) |
| `UPLOAD_DIR` | `~/uploads/zenterm` | アップロード保存先 |
| `UPLOAD_MAX_SIZE` | `10485760` | アップロード上限 (bytes, デフォルト 10MB) |

## API エンドポイント

すべての API は Bearer トークン認証が必要（`/health` を除く）。

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/health` | ヘルスチェック |
| POST | `/api/auth/verify` | トークン検証 |
| GET | `/api/sessions` | tmux セッション一覧 |
| POST | `/api/sessions` | セッション作成 |
| DELETE | `/api/sessions/:id` | セッション削除 |
| GET | `/api/system` | システムステータス (CPU/メモリ/ディスク/温度) |
| GET | `/api/files` | ファイル一覧 |
| GET | `/api/files/content` | ファイル内容取得 |
| POST | `/api/upload` | ファイルアップロード |
| WS | `/ws/terminal` | ターミナル WebSocket 接続 |

## WebSocket プロトコル

### クライアント → Gateway

```json
{ "type": "input",  "data": "ls -la\r" }
{ "type": "resize", "cols": 80, "rows": 24 }
{ "type": "signal", "signal": "SIGINT" }
```

### Gateway → クライアント

```json
{ "type": "output",      "data": "..." }
{ "type": "sessionInfo", "session": { "id": "zen_abc", "name": "main", ... } }
{ "type": "exit",        "code": 0 }
{ "type": "error",       "message": "..." }
```

## 開発

```bash
# Gateway 開発サーバー（ホットリロード）
npm run dev:gateway

# Web 開発サーバー
npm run dev:web

# Gateway テスト
cd packages/gateway && npx vitest
```

## デプロイ・運用

### Linux (systemd)

```bash
# ステータス確認
sudo systemctl status zenterm-gateway

# ログ確認
sudo journalctl -u zenterm-gateway -f

# 再起動
sudo systemctl restart zenterm-gateway

# アンインストール
./deploy/uninstall.sh
```

### macOS (launchd)

```bash
# ステータス確認
launchctl list | grep zenterm

# ログ確認
tail -f ~/Library/Logs/zenterm-gateway.log
```

## ドキュメント

| ファイル | 内容 |
|---------|------|
| [docs/deployment.md](docs/deployment.md) | デプロイ手順の詳細 |
| [docs/eas-setup.md](docs/eas-setup.md) | EAS Build セットアップ |
| [CLAUDE.md](CLAUDE.md) | エージェント向け開発指示 |

## ライセンス

MIT
