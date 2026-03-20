#!/bin/bash
set -euo pipefail

OS="$(uname -s)"

echo "=== palmsh Gateway アンインストール ==="
echo "OS: $OS"

if [ "$OS" = "Darwin" ]; then
  # --- macOS: launchd ---
  PLIST="$HOME/Library/LaunchAgents/com.palmsh.gateway.plist"

  echo "[1/2] launchd サービス停止..."
  launchctl unload "$PLIST" 2>/dev/null || true

  echo "[2/2] plist 削除..."
  rm -f "$PLIST"
else
  # --- Linux: systemd ---
  echo "[1/3] サービス停止..."
  sudo systemctl stop palmsh-gateway 2>/dev/null || true

  echo "[2/3] サービス無効化..."
  sudo systemctl disable palmsh-gateway 2>/dev/null || true

  echo "[3/3] サービスファイル削除..."
  sudo rm -f /etc/systemd/system/palmsh-gateway.service
  sudo systemctl daemon-reload
fi

echo ""
echo "=== アンインストール完了 ==="
