# palmsh デプロイメントガイド

## 前提条件
- Raspberry Pi 5 (Raspberry Pi OS)
- Node.js 20+ インストール済み
- tmux インストール済み
- npm workspaces 対応済み

## Gateway デプロイ

### 1. 依存インストール
```bash
cd ~/projects/palmsh
npm install
```

### 2. 環境変数設定
```bash
cp packages/gateway/.env.example packages/gateway/.env
# .env を編集して AUTH_TOKEN を設定
# AUTH_TOKEN には十分に長いランダム文字列を使用:
#   openssl rand -base64 32
```

### 3. ビルド
```bash
npm run build:gateway
```

### 4. systemd サービスとして起動
```bash
./deploy/install.sh
```

### 5. 動作確認
```bash
# サービスステータス
sudo systemctl status palmsh-gateway

# ヘルスチェック
curl http://localhost:18765/health

# ログ確認
sudo journalctl -u palmsh-gateway -f
```

## Mobile アプリ

### 開発モード（Expo Go）
```bash
npm run dev:mobile
```

### EAS Build（スタンドアロンアプリ）
→ [EAS セットアップガイド](./eas-setup.md) を参照

## 運用チェックリスト

- [ ] AUTH_TOKEN をランダムな長い文字列に変更
- [ ] Gateway が systemd で自動起動することを確認
- [ ] ヘルスチェック（/health）が正常応答することを確認
- [ ] Tailscale VPN 経由で iPhone から接続できることを確認
- [ ] ログが journald に出力されていることを確認
