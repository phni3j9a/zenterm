#!/bin/bash
# Reset ZenTerm demo container (clean sessions & files)
set -euo pipefail

COMPOSE_DIR="/home/raspi5/projects/zenterm/server/demo"

cd "$COMPOSE_DIR"
docker compose down 2>/dev/null || true
docker compose up -d

echo "[$(date)] zenterm-demo reset complete"
