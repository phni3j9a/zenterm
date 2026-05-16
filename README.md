<p align="center">
  <img src="splash-preview.png" alt="ZenTerm" width="200">
</p>

<h1 align="center">ZenTerm</h1>

<p align="center">
  iPhone からサーバーのターミナルに接続するセルフホスト型モバイルターミナル
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js >= 20">
  <img src="https://img.shields.io/badge/platform-linux%20%7C%20macos-blue" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

Gateway サーバーが tmux セッションを管理し、WebSocket で iPhone アプリからリアルタイム接続。xterm.js による埋め込みターミナル描画、ファイルブラウザ、システムモニタリングを備えます。

Mac mini・Raspberry Pi・Linux サーバーなどに LAN / VPN 経由でどこからでもアクセスできるセルフホスト型ターミナルシステムです。macOS でも Linux でも、サーバーを 1 台セットアップするだけで、iPhone の QR ペアリングですぐに使い始められます。

## Screenshots

<p align="center">
  <img src="docs/screenshots/app-terminal.png" alt="Terminal" width="180">
  &nbsp;
  <img src="docs/screenshots/app-sessions.png" alt="Sessions" width="180">
  &nbsp;
  <img src="docs/screenshots/app-setup.png" alt="Setup" width="180">
  &nbsp;
  <img src="docs/screenshots/app-files.png" alt="Files" width="180">
  &nbsp;
  <img src="docs/screenshots/app-dark.png" alt="Dark Theme" width="180">
</p>

> 上記はモバイルアプリのスクリーンショットです。

## Browser version (PC Web)

ZenTerm includes a full-featured PC Web client served by Gateway at `/web/*`. It supports multi-pane terminals, file browsing, drag-resize sidebar, deep-link URLs, command palette, and 8 languages.

### Screenshots

| Login | Sessions (multi-pane) |
|---|---|
| ![Login](docs/screenshots/web-pc-login.png) | ![Sessions](docs/screenshots/web-pc-multi-pane.png) |

| Files | Settings |
|---|---|
| ![Files](docs/screenshots/web-pc-files.png) | ![Settings](docs/screenshots/web-pc-settings.png) |

### Browser support

- Chrome/Edge 122+
- Firefox 122+
- Safari 17+ (macOS / iPad)

### Getting started

```bash
zenterm-gateway info     # show local + Tailscale URL
# Open the printed Web URL, enter 4-digit token
```

## Features

| | 機能 | 説明 |
|---|---|---|
| **Terminal** | フルターミナル | xterm.js による本格描画、CJK / Unicode 対応、スクロールバック 5,000 行 |
| **Sessions** | tmux セッション管理 | セッションの作成・一覧・アタッチ・デタッチ・削除を REST + UI で操作 |
| **Files** | ファイルブラウザ | ディレクトリ閲覧・テキスト編集・ファイルアップロード |
| **Monitor** | システムモニタリング | CPU / メモリ / ディスク / 温度 / 稼働時間をリアルタイム表示 |
| **QR** | QR ペアリング | Gateway 起動時に QR を表示、アプリでスキャンして即接続 |
| **Reconnect** | 自動再接続 | 埋め込み / モバイル端末で指数バックオフ再接続 (最大 20 回)、サーバー側 ping/pong (30 秒) |
| **Install** | ワンライナー | systemd / launchd サービスとして自動登録 |

## Architecture

```
 iPhone (ZenTerm App)             Linux / macOS Server
┌─────────────────────┐          ┌───────────────────────────────────┐
│                     │          │  zenterm-gateway (Fastify)        │
│  ┌───────────────┐  │   WS    │  ┌─────────────┐  ┌───────────┐  │
│  │ WebView       │◄─┼────────►│  │ /ws/terminal │──│ node-pty  │  │
│  │ (xterm.js)    │  │  embed  │  └─────────────┘  └─────┬─────┘  │
│  └───────┬───────┘  │         │                         │        │
│  GET /embed/terminal │  REST   │  ┌─────────────┐  ┌─────▼─────┐  │
│  ┌───────────────┐  │         │  │ /api/*      │  │   tmux    │  │
│  │ Native UI     │◄─┼────────►│  │ sessions    │  └───────────┘  │
│  │ (Sessions,    │  │         │  │ files       │                  │
│  │  Files, etc.) │  │         │  │ system      │                  │
│  └───────────────┘  │         │  │ upload      │  ┌───────────┐  │
│                     │         │  └─────────────┘  │ /embed/*  │  │
└─────────────────────┘         │                   │ /terminal │  │
                                └───────────────────┴───────────┘──┘
```

## Package Structure

```
packages/
├── gateway/   Fastify + WebSocket + node-pty ターミナルゲートウェイ
├── web/       PC ブラウザ向け SPA (React 19 + Vite + xterm.js)、Gateway の /web/* で配信
└── shared/    WebSocket メッセージ型・共通型定義 (Single Source of Truth)
```

| パッケージ | 技術スタック |
|-----------|-------------|
| **gateway** | Node.js, TypeScript, Fastify 5, ws, node-pty, tmux, zod |
| **web**     | React 19, Vite 5, TypeScript, react-router, zustand, xterm.js v6, lucide-react, i18next |
| **shared**  | TypeScript 型定義のみ — gateway / web / mobile で共有 |

## Requirements

- **Node.js** >= 20
- **tmux** (セッション管理に必須)
- **npm** (workspaces 対応)
- **ビルドツール** (node-pty のネイティブコンパイルに必要)
  - Linux: `build-essential` (`make`, `gcc`), `python3`
  - macOS: Xcode Command Line Tools (`xcode-select --install`)

## Quick Start

### One-liner Install (recommended)

```bash
curl -fsSL https://github.com/phni3j9a/zenterm/releases/latest/download/install.sh | bash
```

スクリプトは以下を自動実行します:

1. tmux / Node.js (>= 20) の確認
2. 最新 release の tarball を `~/.local/share/zenterm-gateway/<version>/` にダウンロード・SHA256 verify・展開
3. `npm install --omit=dev` で依存を解決
4. `AUTH_TOKEN` の対話的生成 (`~/.config/zenterm/.env`)
5. `~/.local/share/zenterm-gateway/current` の symlink を新 version に張替え
6. サービス登録 (Linux: systemd user / macOS: launchd)
7. 接続情報の表示

#### Pin a specific version

```bash
curl -fsSL https://github.com/phni3j9a/zenterm/releases/download/v0.7.0/install.sh \
  | bash -s -- --version v0.7.0
```

#### Verify checksums manually

```bash
curl -fsSLO https://github.com/phni3j9a/zenterm/releases/download/v0.7.0/zenterm-gateway-0.7.0.tar.gz
curl -fsSLO https://github.com/phni3j9a/zenterm/releases/download/v0.7.0/checksums.txt
sha256sum -c checksums.txt
```

### Manual Setup (developers)

リポジトリをクローンして手元でビルドする場合は次のコマンド。

```bash
git clone https://github.com/phni3j9a/zenterm.git
cd zenterm && ./deploy/install.sh
```

`deploy/install.sh` はリポジトリ内のソースを直接ビルドして launchd / systemd に登録します。

### Re-displaying connection info

Daemon 稼働中はターミナル出力が見えないため、以下のコマンドで接続情報を再表示できます:

```bash
zenterm-gateway info     # LAN / Tailscale / Web URL / Token を表示
zenterm-gateway qr       # ペアリング用 QR コードを再表示
```

Web ブラウザからアクセスする場合は `Web (LAN)` または `Web (Ts)` の URL を開き、`Token` の 4 桁を入力してください。

## Configuration

設定ファイル: `~/.config/zenterm/.env`

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `AUTH_TOKEN` | *(必須)* | Bearer 認証トークン |
| `PORT` | `18765` | リッスンポート |
| `HOST` | `0.0.0.0` | バインドホスト |
| `SESSION_PREFIX` | `zen_` | tmux セッション名プレフィックス |
| `LOG_LEVEL` | `info` | ログレベル (`debug` / `info` / `warn` / `error`) |
| `UPLOAD_DIR` | `~/uploads/zenterm` | アップロード保存先 |
| `UPLOAD_MAX_SIZE` | `10485760` | アップロード上限 (bytes, デフォルト 10 MB) |

## API Reference

すべての API は Bearer トークン認証が必要です (`/health`, `/embed/terminal`, `/terminal/lib/*` を除く)。

### REST Endpoints

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/health` | ヘルスチェック (認証不要) |
| `POST` | `/api/auth/verify` | トークン検証 |
| `GET` | `/api/sessions` | tmux セッション一覧 |
| `POST` | `/api/sessions` | セッション作成 |
| `PATCH` | `/api/sessions/:sessionId` | セッションリネーム (`{ "name": "..." }`) |
| `DELETE` | `/api/sessions/:id` | セッション削除 |
| `GET` | `/api/system/status` | システムステータス (CPU / メモリ / ディスク / 温度 / 稼働時間) |
| `GET` | `/api/files` | ファイル一覧 (`?path=`) |
| `GET` | `/api/files/content` | ファイル内容取得 (`?path=`, 512 KB 以下) |
| `GET` | `/api/files/raw` | ファイルストリーム配信 (`?path=`, 20 MB 以下) |
| `PUT` | `/api/files/content` | ファイル内容書き込み |
| `POST` | `/api/upload` | ファイルアップロード (multipart, 10 MB 以下) |
| `GET` | `/embed/terminal` | 埋め込みターミナル HTML (認証不要、モバイル WebView 用) |

### WebSocket

**Endpoint:** `WS /ws/terminal?sessionId=<id>&token=<token>`

```jsonc
// Client → Gateway
{ "type": "input",  "data": "ls -la\r" }
{ "type": "resize", "cols": 80, "rows": 24 }
{ "type": "signal", "signal": "SIGINT" }

// Gateway → Client
{ "type": "output",      "data": "..." }
{ "type": "sessionInfo", "session": { "id": "zen_abc", "displayName": "main", ... } }
{ "type": "exit",        "code": 0 }
{ "type": "error",       "message": "..." }
```

**Events:** `WS /ws/events?token=<token>`

```jsonc
{ "type": "sessions-changed" }
{ "type": "windows-changed" }
{ "type": "monitor-restart" }
```

## Security

| 対策 | 詳細 |
|------|------|
| Bearer トークン認証 | すべての API / WebSocket に `Authorization: Bearer <token>` が必要 (`/health`, `/embed/terminal`, `/terminal/lib/*` を除く)。ターミナル系 WebSocket は query token を個別検証 |
| タイミングセーフ比較 | `crypto.timingSafeEqual` によるトークン検証でタイミング攻撃を防止 |
| パストラバーサル防止 | ファイル操作はホームディレクトリ内に制限、`..` を含むパスを拒否 |
| シンボリックリンク検証 | symlink 先がホームディレクトリ外の場合はアクセス拒否 |
| WebSocket フレーム制限 | 最大ペイロード 64 KB (`maxPayload`) |
| 同時接続数制限 | WebSocket 最大 10 接続 |
| ファイルサイズ制限 | テキスト読み込み 512 KB / ストリーム配信 20 MB / アップロード 10 MB |

## Support

サポートが必要な場合は、まずこの README の `Quick Start` と `Configuration` を確認してください。接続できない場合は、`tmux` の導入、`AUTH_TOKEN` の一致、ファイアウォールや VPN 経路の到達性を見直すと切り分けしやすくなります。

不具合報告や質問は GitHub Issues で受け付けています。App Store サポート窓口としてもこのリポジトリを案内しています。

- https://github.com/phni3j9a/zenterm/issues
- 報告時は利用端末、サーバー OS、ZenTerm のバージョン、再現手順を添えてください

## Development

```bash
# Gateway 開発サーバー (ホットリロード)
npm run dev:gateway

# Web 開発サーバー (Vite HMR、別ターミナル)
npm run dev --workspace=@zenterm/web

# Gateway ユニットテスト
cd packages/gateway && npx vitest

# Web ユニットテスト
cd packages/web && npx vitest
```

### E2E (Docker 隔離、必須)

PC Web の e2e は必ず Docker container 内で実行します。Host で直接 playwright を走らせると、
gateway が spawn する tmux が `/tmp/tmux-$EUID/default` を介して host の tmux と共有され、
playwright が落ちた瞬間に開発者の tmux セッションごと巻き添えで死ぬ事故が起きます。
container 内 tmux は tmpfs `/tmp` に閉じ込められ、host からは到達不能です。

```bash
# 全 49 spec を Docker で走らせる (初回は image build で +3 分)
scripts/e2e-docker.sh

# 特定 spec のみ
scripts/e2e-docker.sh tests/e2e/web/login.spec.ts

# image rebuild をスキップ (web src を変えていない場合)
ZENTERM_E2E_NO_BUILD=1 scripts/e2e-docker.sh

# 開発用 gateway を container 内で起動 (host:18766 → container:18765)
scripts/dev-docker.sh
# → http://localhost:18766/web/login にブラウザでアクセス
```

### Build

```bash
# Gateway をビルド (web bundle も `packages/gateway/public/web/` に同梱)
npm run build:gateway

# Web のみビルド
npm run build --workspace=@zenterm/web

# GitHub Pages 用の LP を gateway/public から同期
npm run sync:pages
```

## Deployment

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

詳細は [docs/deployment.md](docs/deployment.md) を参照してください。

## Troubleshooting

### node-pty ビルドエラー

`npm install` 時に node-pty のコンパイルが失敗する場合:

```bash
# Debian / Ubuntu / Raspberry Pi OS 等
sudo apt install -y build-essential python3

# macOS
xcode-select --install
```

### tmux が見つからない

```bash
# Debian / Ubuntu / Raspberry Pi OS 等
sudo apt install -y tmux

# macOS
brew install tmux
```

### ポート競合

デフォルトポート `18765` が使用中の場合、`~/.config/zenterm/.env` の `PORT` を変更してください。

### リバースプロキシ経由で WebSocket が接続できない

Nginx 等のリバースプロキシを使用する場合、WebSocket のアップグレードヘッダーを転送する設定が必要です:

```nginx
location / {
    proxy_pass http://127.0.0.1:18765;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Roadmap

### PC Web (packages/web) 再構築

| Phase | 内容 | 状態 |
|-------|------|------|
| **1** | Web 基盤 (ターミナル, セッション管理, 自動再接続) | ✅ Done |
| **2a-d** | UX 磨き込み (キーボードショートカット, 検索, コピペ, テーマ) | ✅ Done |
| **3** | ペイン分割 (4 ペイン, tmux 連携) | ✅ Done |
| **4a-b** | ファイルマネージャ (検索, コンテキストメニュー, プレビュー, ファイル操作) | ✅ Done |
| **5a-b** | i18n 8 言語 + ディープリンク + a11y + 性能 | ✅ Done |
| **6** | UI/UX 仕上げ (共通プリミティブ, lucide-react, LeftRail, EmptyState, Onboarding, focus-ring) | ✅ Done |
| **7** | Docker 隔離 e2e 基盤 (host tmux 保護) | ✅ Done |

すべて main マージ済、タグ: `web-pc-phase-{1, 2a, 2b, 2c, 2d, 3, 4a, 4b, 5a, 5b, 6, 7}-done`

詳細は [docs/roadmap.md](docs/roadmap.md) を参照してください。

## Related

- **ZenTerm App** -- iOS モバイルアプリ (App Store 準備中)
  - 3 タブ構成: Sessions / Files / Settings
  - QR コードスキャンでサーバーとペアリング
  - セッション一覧にインラインターミナルプレビュー
  - スワイプ削除、画像プレビュー、Markdown レンダリング
  - ファイルアップロード (Document Picker + Photo Library)
  - ダーク / ライトテーマ対応
  - Expo SDK 54 / React Native
- **[Privacy Policy](PRIVACY_POLICY.md)** -- プライバシーポリシー

## Contributing

バグ報告や機能リクエストは [Issues](https://github.com/phni3j9a/zenterm/issues) からお願いします。

プルリクエストを送る場合:

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/your-feature`)
3. テストを実行 (`cd packages/gateway && npx vitest`)
4. コミット & プッシュ
5. プルリクエストを作成

コードスタイルは既存のコードに合わせてください。TypeScript strict モード + Zod バリデーションを使用しています。

## License

[MIT](LICENSE)
