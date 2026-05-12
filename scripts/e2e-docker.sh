#!/usr/bin/env bash
#
# Run the full Playwright e2e suite (or a subset) inside an isolated Docker
# container so the host's tmux server is never at risk.
#
# Usage:
#   scripts/e2e-docker.sh                            # full suite
#   scripts/e2e-docker.sh tests/e2e/web/login.spec.ts  # subset
#   scripts/e2e-docker.sh --grep "login"              # any playwright args
#
# Environment:
#   ZENTERM_E2E_IMAGE  (default: zenterm-e2e:latest)  override the image tag
#   ZENTERM_E2E_NO_BUILD=1                            skip `docker build`
#
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE_TAG="${ZENTERM_E2E_IMAGE:-zenterm-e2e:latest}"

if [[ "${ZENTERM_E2E_NO_BUILD:-0}" != "1" ]]; then
  echo "[e2e-docker] Building $IMAGE_TAG …"
  docker build -f Dockerfile.e2e -t "$IMAGE_TAG" .
fi

echo "[e2e-docker] Running playwright inside container…"
exec docker run --rm \
  --tmpfs /tmp:size=512m,mode=1777 \
  --shm-size=1g \
  --init \
  "$IMAGE_TAG" \
  npx playwright test "$@"
