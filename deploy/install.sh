#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/packages/gateway/.env"
OS="$(uname -s)"

echo "=== zenterm Gateway インストール ==="
echo "OS: $OS"

# 1. tmux 確認
if ! command -v tmux &>/dev/null; then
  echo "エラー: tmux がインストールされていません。"
  if [ "$OS" = "Darwin" ]; then
    echo "  brew install tmux"
  else
    echo "  sudo apt install tmux"
  fi
  exit 1
fi

# 2. Node.js 確認
if ! command -v node &>/dev/null; then
  echo "エラー: Node.js がインストールされていません。"
  exit 1
fi

# 3. ビルド
echo "[1/5] Gateway ビルド..."
cd "$PROJECT_DIR"
npm install --ignore-scripts 2>/dev/null || npm install
npm run build:gateway

# 4. .env 自動生成（未作成の場合）
if [ ! -f "$ENV_FILE" ]; then
  echo "[2/5] .env を自動生成..."
  TOKEN="$(openssl rand -base64 32)"
  cat > "$ENV_FILE" <<EOF
AUTH_TOKEN=$TOKEN
PORT=18765
HOST=0.0.0.0
SESSION_PREFIX=psh_
LOG_LEVEL=info

# Upload settings
UPLOAD_DIR=~/uploads/zenterm
UPLOAD_MAX_SIZE=10485760
EOF
  echo "  AUTH_TOKEN を自動生成しました。"
else
  echo "[2/5] .env は既存のものを使用します。"
  TOKEN="$(grep -E '^AUTH_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
fi

# 5. OS別サービス登録
if [ "$OS" = "Darwin" ]; then
  # --- macOS: launchd ---
  PLIST_SRC="$SCRIPT_DIR/com.zenterm.gateway.plist"
  PLIST_DIR="$HOME/Library/LaunchAgents"
  PLIST_DST="$PLIST_DIR/com.zenterm.gateway.plist"

  if [ ! -f "$PLIST_SRC" ]; then
    echo "エラー: $PLIST_SRC が見つかりません。"
    exit 1
  fi

  echo "[3/5] launchd plist 配置..."
  mkdir -p "$PLIST_DIR"

  # plist 内のパスをユーザー環境に合わせて置換
  sed \
    -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__USER__|$(whoami)|g" \
    -e "s|__HOME__|$HOME|g" \
    "$PLIST_SRC" > "$PLIST_DST"

  echo "[4/5] launchd にロード..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  launchctl load "$PLIST_DST"

  echo "[5/5] サービス起動確認..."
  sleep 2
  if launchctl list | grep -q com.zenterm.gateway; then
    echo "  launchd サービスが起動しました。"
  else
    echo "  警告: サービスが起動していない可能性があります。"
    echo "  確認: launchctl list | grep zenterm"
  fi
else
  # --- Linux: systemd ---
  SERVICE_FILE="$SCRIPT_DIR/zenterm-gateway.service"
  SYSTEMD_DIR="/etc/systemd/system"

  echo "[3/5] サービスファイル配置..."
  sudo cp "$SERVICE_FILE" "$SYSTEMD_DIR/zenterm-gateway.service"

  echo "[4/5] systemd デーモンリロード..."
  sudo systemctl daemon-reload
  sudo systemctl enable zenterm-gateway

  echo "[5/5] サービス起動..."
  sudo systemctl start zenterm-gateway
fi

# 6. QRコード表示
echo ""
echo "=== インストール完了 ==="
echo ""

# LAN IP 取得してペアリング情報表示
PORT="$(grep -E '^PORT=' "$ENV_FILE" | head -1 | cut -d= -f2- || echo 18765)"
PORT="${PORT:-18765}"

LAN_IP=""
if [ "$OS" = "Darwin" ]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
else
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
fi

if [ -n "$LAN_IP" ] && [ -n "$TOKEN" ]; then
  PAIRING_URL="zenterm://connect?url=http://${LAN_IP}:${PORT}&token=${TOKEN}"
  echo "ペアリング URL:"
  echo "  $PAIRING_URL"
  echo ""
  echo "接続情報:"
  echo "  URL:   http://${LAN_IP}:${PORT}"
  echo "  Token: ${TOKEN}"
  echo ""

  # QRコード表示を試みる（node が使えれば）
  cd "$PROJECT_DIR/packages/gateway"
  node -e "
    try {
      const qr = require('qrcode-terminal');
      qr.generate('$PAIRING_URL', { small: true }, (code) => {
        console.log(code);
      });
    } catch {
      // qrcode-terminal が未インストールの場合はスキップ
    }
  " 2>/dev/null || true
fi

echo ""
if [ "$OS" = "Darwin" ]; then
  echo "ステータス確認:"
  echo "  launchctl list | grep zenterm"
  echo ""
  echo "ログ確認:"
  echo "  tail -f ~/Library/Logs/zenterm-gateway.log"
  echo ""
  echo "再起動:"
  echo "  launchctl unload ~/Library/LaunchAgents/com.zenterm.gateway.plist"
  echo "  launchctl load ~/Library/LaunchAgents/com.zenterm.gateway.plist"
else
  echo "ステータス確認:"
  echo "  sudo systemctl status zenterm-gateway"
  echo ""
  echo "ログ確認:"
  echo "  sudo journalctl -u zenterm-gateway -f"
  echo ""
  echo "再起動:"
  echo "  sudo systemctl restart zenterm-gateway"
fi
