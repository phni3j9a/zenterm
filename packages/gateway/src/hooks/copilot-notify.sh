#!/bin/bash
# zenterm-managed — do not edit manually
# Wrapper that calls the common notify script for Copilot CLI
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/zenterm-notify.sh" "copilot-cli" "task.completed"
