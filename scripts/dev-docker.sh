#!/usr/bin/env bash
#
# Spin up an interactive dev gateway inside the Docker container, exposing it
# on a host port so the developer can poke around with their host browser while
# the gateway's tmux side-effects stay isolated to the container.
#
# Usage:
#   scripts/dev-docker.sh                       # default: token=dev1234, host:18766 → container:18765
#   AUTH_TOKEN=4242 scripts/dev-docker.sh       # custom token
#   ZENTERM_DEV_PORT=19000 scripts/dev-docker.sh  # custom host port
#
# Inside the container you can:
#   - Open http://localhost:<ZENTERM_DEV_PORT>/web/login from the host browser
#     and authenticate with $AUTH_TOKEN (default dev1234).
#   - Drop to a shell: docker exec -it $(docker ps -q -f ancestor=zenterm-e2e:latest) bash
#
# Notes:
#   - This mounts ./packages/{shared,gateway,web}/src into the container so
#     source edits on the host are visible immediately.
#   - node_modules and build artifacts stay inside the image (the host's macOS
#     binaries would not work in the Linux container).
#   - The container's /tmp is tmpfs, so all tmux sessions vanish on stop.
#
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE_TAG="${ZENTERM_E2E_IMAGE:-zenterm-e2e:latest}"
HOST_PORT="${ZENTERM_DEV_PORT:-18766}"
TOKEN="${AUTH_TOKEN:-dev1234}"

if [[ "${ZENTERM_E2E_NO_BUILD:-0}" != "1" ]]; then
  echo "[dev-docker] Ensuring image $IMAGE_TAG is up to date…"
  docker build -f Dockerfile.e2e -t "$IMAGE_TAG" .
fi

cat <<EOF

  ===========================================================
  ZenTerm dev container
    Gateway URL : http://localhost:${HOST_PORT}/web/login
    Token       : ${TOKEN}
    Stop        : Ctrl+C
  ===========================================================

EOF

exec docker run --rm -it \
  -p "${HOST_PORT}:18765" \
  --tmpfs /tmp:size=512m,mode=1777 \
  --shm-size=512m \
  --init \
  -e AUTH_TOKEN="$TOKEN" \
  -e PORT=18765 \
  -e HOST=0.0.0.0 \
  -e LOG_LEVEL=info \
  -v "$(pwd)/packages/shared/src:/work/packages/shared/src:ro" \
  -v "$(pwd)/packages/gateway/src:/work/packages/gateway/src:ro" \
  -v "$(pwd)/packages/web/src:/work/packages/web/src:ro" \
  "$IMAGE_TAG" \
  bash -lc "node packages/gateway/dist/index.js"
