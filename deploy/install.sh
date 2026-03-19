#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_FILE="$SCRIPT_DIR/palmsh-gateway.service"
SYSTEMD_DIR="/etc/systemd/system"

echo "=== palmsh Gateway インストール ==="

# 1. ビルド
echo "[1/5] Gateway ビルド..."
cd "$PROJECT_DIR"
npm run build:gateway

# 2. .env 確認
ENV_FILE="$PROJECT_DIR/packages/gateway/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "エラー: $ENV_FILE が見つかりません。"
  echo ".env.example をコピーして設定してください:"
  echo "  cp packages/gateway/.env.example packages/gateway/.env"
  exit 1
fi

# 3. サービスファイル配置
echo "[2/5] サービスファイル配置..."
sudo cp "$SERVICE_FILE" "$SYSTEMD_DIR/palmsh-gateway.service"

# 4. systemd リロード
echo "[3/5] systemd デーモンリロード..."
sudo systemctl daemon-reload

# 5. サービス有効化・起動
echo "[4/5] サービス有効化..."
sudo systemctl enable palmsh-gateway

echo "[5/5] サービス起動..."
sudo systemctl start palmsh-gateway

echo ""
echo "=== インストール完了 ==="
echo ""
echo "ステータス確認:"
echo "  sudo systemctl status palmsh-gateway"
echo ""
echo "ログ確認:"
echo "  sudo journalctl -u palmsh-gateway -f"
echo ""
echo "再起動:"
echo "  sudo systemctl restart palmsh-gateway"
