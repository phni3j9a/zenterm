#!/usr/bin/env bash
set -euo pipefail

# Local rehearsal for deploy/install-from-release.sh.
# Builds a tarball from the working copy, serves it on localhost,
# and runs install-from-release.sh inside a Docker container against it,
# using ZENTERM_BASE_URL to point at a local HTTP server.
#
# Usage:
#   scripts/test-install-from-release.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="0.0.0-test"
TMP=$(mktemp -d)
HTTP_PID=""
trap 'rm -rf "$TMP"; kill $HTTP_PID 2>/dev/null || true; wait 2>/dev/null || true' EXIT

# 1. build
echo "==> Building gateway"
( cd packages/gateway && npx tsc )
echo "==> Building web"
( cd packages/web && npx vite build )

# 2. pack tarball matching the layout install-from-release.sh expects
echo "==> Packing tarball"
TARBALL="$TMP/zenterm-gateway-${VERSION}.tar.gz"
# package-lock.json lives at the workspace root in npm-workspaces repos;
# copy it into a staging area alongside gateway files for the tarball.
STAGE="$TMP/stage/zenterm-gateway-${VERSION}"
mkdir -p "$STAGE"
cp -r packages/gateway/dist packages/gateway/public packages/gateway/package.json "$STAGE/"
cp package-lock.json "$STAGE/"
tar -czf "$TARBALL" -C "$TMP/stage" "zenterm-gateway-${VERSION}"

# 3. checksums file
( cd "$TMP" && sha256sum "zenterm-gateway-${VERSION}.tar.gz" > checksums.txt )

# 4. serve via python http.server in background
PORT=18099
( cd "$TMP" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
HTTP_PID=$!
sleep 1

# 5. run install-from-release.sh inside docker, pointing at our HTTP stub via ZENTERM_BASE_URL
echo "==> Running install-from-release.sh inside docker"
docker run --rm \
  --network host \
  -v "$ROOT/deploy/install-from-release.sh:/install.sh:ro" \
  -e AUTH_TOKEN=1234 \
  -e HOME=/tmp/home \
  -e ZENTERM_BASE_URL="http://localhost:${PORT}" \
  node:20-bookworm bash -c '
    apt-get update -qq && apt-get install -y -qq tmux curl >/dev/null
    mkdir -p /tmp/home
    bash /install.sh --version v'"$VERSION"'
    test -f /tmp/home/.local/share/zenterm-gateway/'"$VERSION"'/dist/cli.js
    test -L /tmp/home/.local/share/zenterm-gateway/current
    test -f /tmp/home/.config/zenterm/.env
    echo "==> Rehearsal: all assertions passed"
  '

echo "==> Rehearsal complete"
