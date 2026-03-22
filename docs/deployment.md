# zenterm デプロイメントガイド

## 前提条件
- **Linux**: Raspberry Pi OS / Ubuntu / Debian + Node.js 20+ + tmux
- **macOS**: macOS 12+ + Homebrew + Node.js 20+ + tmux (`brew install tmux`)
- npm workspaces 対応済み

## ワンライナーインストール

```bash
cd ~/projects/zenterm
./deploy/install.sh
```

install.sh は以下を自動実行します:
1. OS 検出（Linux / macOS）
2. tmux・Node.js の存在確認
3. Gateway ビルド（`npm install` + `npm run build:gateway`）
4. `.env` 未作成なら AUTH_TOKEN を自動生成して `.env` 作成
5. サービス登録（Linux → systemd、macOS → launchd）
6. 起動確認 + QR コード表示

起動後、ターミナルに QR コードとペアリング URL が表示されます。
モバイルアプリの「QR コードでスキャン」からスキャンすれば接続完了です。

## Linux (systemd)

### サービス管理
```bash
# ステータス確認
sudo systemctl status zenterm-gateway

# ログ確認
sudo journalctl -u zenterm-gateway -f

# 再起動
sudo systemctl restart zenterm-gateway

# 停止
sudo systemctl stop zenterm-gateway
```

### アンインストール
```bash
./deploy/uninstall.sh
```

## macOS (launchd)

### 前提条件
```bash
brew install tmux node
```

### サービス管理
```bash
# ステータス確認
launchctl list | grep zenterm

# ログ確認
tail -f ~/Library/Logs/zenterm-gateway.log

# 再起動
launchctl unload ~/Library/LaunchAgents/com.zenterm.gateway.plist
launchctl load ~/Library/LaunchAgents/com.zenterm.gateway.plist

# 停止
launchctl unload ~/Library/LaunchAgents/com.zenterm.gateway.plist
```

### アンインストール
```bash
./deploy/uninstall.sh
```

### macOS 固有の注意事項
- CPU 温度は取得不可（モバイルアプリ上では非表示）
- ディスク情報は `df -k /` からパース（`--output` オプンは macOS の df にはない）
- launchd plist は `~/Library/LaunchAgents/` に配置（sudo 不要）
- Node.js パスは plist 内で `/usr/local/bin/node` と `/opt/homebrew/bin` の両方を PATH に含む

## 環境変数設定

`.env` ファイル（`packages/gateway/.env`）:

```bash
AUTH_TOKEN=your-secret-token-here   # install.sh で自動生成
PORT=18765
HOST=0.0.0.0
SESSION_PREFIX=psh_
LOG_LEVEL=info

# Upload settings
UPLOAD_DIR=~/uploads/zenterm
UPLOAD_MAX_SIZE=10485760
```

## Mobile アプリ

### 開発モード（Expo Go）
```bash
npm run dev:mobile
```

### EAS Build（スタンドアロンアプリ）
→ [EAS セットアップガイド](./eas-setup.md) を参照

## 運用チェックリスト

- [ ] AUTH_TOKEN がランダムな長い文字列であること
- [ ] Gateway がサービスとして自動起動すること（systemd / launchd）
- [ ] ヘルスチェック（/health）が正常応答すること
- [ ] VPN 経由で iPhone から接続できること
- [ ] ログが出力されていること（journald / ~/Library/Logs/）
