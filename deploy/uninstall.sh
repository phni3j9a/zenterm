#!/bin/bash
set -euo pipefail

echo "=== palmsh Gateway アンインストール ==="

echo "[1/3] サービス停止..."
sudo systemctl stop palmsh-gateway 2>/dev/null || true

echo "[2/3] サービス無効化..."
sudo systemctl disable palmsh-gateway 2>/dev/null || true

echo "[3/3] サービスファイル削除..."
sudo rm -f /etc/systemd/system/palmsh-gateway.service
sudo systemctl daemon-reload

echo ""
echo "=== アンインストール完了 ==="
