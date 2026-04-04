#!/bin/bash
# zenterm-managed — do not edit manually
# Codex notify hook: receives JSON payload as $1

# Load config from .env (Codex notify can't set env vars inline)
ZENTERM_CONFIG="$HOME/.config/zenterm/.env"
if [ -f "$ZENTERM_CONFIG" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      AUTH_TOKEN) ZENTERM_AUTH_TOKEN="${ZENTERM_AUTH_TOKEN:-$value}" ;;
      PORT) ZENTERM_PORT="${ZENTERM_PORT:-$value}" ;;
    esac
  done < <(grep -v '^#' "$ZENTERM_CONFIG" 2>/dev/null)
fi

GATEWAY_URL="${ZENTERM_GATEWAY_URL:-http://127.0.0.1:${ZENTERM_PORT:-18765}}"
AUTH_TOKEN="${ZENTERM_AUTH_TOKEN}"

PAYLOAD="${1:-{}}"

# Extract fields from Codex payload
SUMMARY=$(python3 -c "
import sys, json
try:
    d = json.loads(sys.argv[1])
    print(d.get('last-assistant-message', '')[:200])
except:
    pass
" "$PAYLOAD" 2>/dev/null || true)

CWD_PATH=$(python3 -c "
import sys, json
try:
    d = json.loads(sys.argv[1])
    print(d.get('cwd', ''))
except:
    pass
" "$PAYLOAD" 2>/dev/null || true)

THREAD_ID=$(python3 -c "
import sys, json
try:
    d = json.loads(sys.argv[1])
    print(d.get('thread-id', ''))
except:
    pass
" "$PAYLOAD" 2>/dev/null || true)

curl -sf -X POST "${GATEWAY_URL}/api/agent-events" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"task.completed\",
    \"agent\": \"codex\",
    \"sessionId\": \"${THREAD_ID}\",
    \"summary\": \"${SUMMARY}\",
    \"cwd\": \"${CWD_PATH}\",
    \"timestamp\": $(date +%s)000
  }" > /dev/null 2>&1 &

exit 0
