#!/usr/bin/env bash
set -euo pipefail

# zenterm-gateway installer — fetches a release tarball from GitHub and installs
# under ~/.local/share/zenterm-gateway/<version>/. Phase 1 minimal version:
# only handles download/verify/extract; .env setup and service registration
# are added in later tasks.

OWNER="${ZENTERM_OWNER:-phni3j9a}"
REPO="${ZENTERM_REPO:-zenterm}"
VERSION="${ZENTERM_VERSION:-}"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/zenterm-gateway"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --version=*) VERSION="${1#*=}"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# Resolve "latest" via the redirect from /releases/latest/download/...
if [[ -z "$VERSION" ]]; then
  if [[ -n "${ZENTERM_BASE_URL:-}" ]]; then
    echo "Error: --version required when ZENTERM_BASE_URL is set" >&2
    exit 1
  fi
  RESOLVED=$(curl -fsSI "https://github.com/${OWNER}/${REPO}/releases/latest/download/checksums.txt" \
    | grep -i '^location:' | sed -E 's@.*/download/(v[^/]+)/.*@\1@' | tr -d '\r\n')
  if [[ -z "$RESOLVED" ]]; then
    echo "Error: failed to resolve latest version" >&2
    exit 1
  fi
  VERSION="$RESOLVED"
fi

VERSION_NO_V="${VERSION#v}"
TARBALL="zenterm-gateway-${VERSION_NO_V}.tar.gz"
BASE_URL="${ZENTERM_BASE_URL:-https://github.com/${OWNER}/${REPO}/releases/download/${VERSION}}"
INSTALL_DIR="${DATA_DIR}/${VERSION_NO_V}"

echo "==> Installing zenterm-gateway ${VERSION} to ${INSTALL_DIR}"

# 1. environment checks
command -v node >/dev/null || { echo "Error: node not found"; exit 1; }
command -v tmux >/dev/null || { echo "Error: tmux not found"; exit 1; }
command -v tar  >/dev/null || { echo "Error: tar not found"; exit 1; }
NODE_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
if (( NODE_MAJOR < 20 )); then
  echo "Error: Node.js >= 20 required (found $(node -v))" >&2
  exit 1
fi

# 2. download tarball + checksums
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "==> Downloading ${TARBALL}"
curl -fsSL "${BASE_URL}/${TARBALL}" -o "${TMP}/${TARBALL}"
curl -fsSL "${BASE_URL}/checksums.txt" -o "${TMP}/checksums.txt"

# 3. verify SHA256
echo "==> Verifying SHA256"
( cd "$TMP" && grep " ${TARBALL}\$" checksums.txt | sha256sum -c - )

# 4. extract to install dir
mkdir -p "$INSTALL_DIR"
echo "==> Extracting to ${INSTALL_DIR}"
tar -xzf "${TMP}/${TARBALL}" -C "$INSTALL_DIR" --strip-components=1

# 5. install runtime dependencies
echo "==> Installing dependencies (npm install --omit=dev)"
( cd "$INSTALL_DIR" && npm install --omit=dev --ignore-scripts=false )

echo "==> Dependencies installed."
echo "    INSTALL_DIR=${INSTALL_DIR}"

# 6. interactive .env setup (or accept AUTH_TOKEN env var)
ENV_DIR="${HOME}/.config/zenterm"
ENV_FILE="${ENV_DIR}/.env"
mkdir -p "$ENV_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  TOKEN="${AUTH_TOKEN:-}"
  if [[ -z "$TOKEN" ]]; then
    if [[ ! -t 0 ]] && [[ ! -r /dev/tty ]]; then
      echo "Error: no tty available and AUTH_TOKEN env var not set" >&2
      echo "  Re-run with: AUTH_TOKEN=1234 ${0}" >&2
      exit 1
    fi
    echo ""
    echo "zenterm-gateway 初回セットアップ"
    echo "================================"
    while true; do
      read -r -p "認証トークン（数字4桁）を入力してください: " TOKEN < /dev/tty
      if [[ "$TOKEN" =~ ^[0-9]{4}$ ]]; then
        break
      fi
      echo "  → 数字4桁で入力してください（例: 1234）"
    done
  fi

  cat > "$ENV_FILE" <<EOF
AUTH_TOKEN=${TOKEN}
PORT=18765
HOST=0.0.0.0
SESSION_PREFIX=zen_
LOG_LEVEL=info
EOF
  echo "==> Generated ${ENV_FILE} (AUTH_TOKEN: ${TOKEN})"
else
  echo "==> Using existing ${ENV_FILE}"
fi

# 7. update current symlink atomically
CURRENT="${DATA_DIR}/current"
if [[ "$(uname -s)" == "Darwin" ]]; then
  rm -f "$CURRENT"
  ln -s "$INSTALL_DIR" "$CURRENT"
else
  TMP_LINK="${CURRENT}.new"
  ln -sfn "$INSTALL_DIR" "$TMP_LINK"
  mv -Tf "$TMP_LINK" "$CURRENT"
fi
echo "==> Updated symlink ${CURRENT} -> ${INSTALL_DIR}"

# 8. register systemd / launchd service
echo "==> Registering service"
node "${CURRENT}/dist/cli.js" setup --install-dir "$CURRENT"

echo ""
echo "==> Installation complete."
echo "    Run: node ${CURRENT}/dist/cli.js info"
