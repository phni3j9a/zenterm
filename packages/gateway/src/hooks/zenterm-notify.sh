#!/bin/bash
# zenterm-managed — do not edit manually
GATEWAY_URL="${ZENTERM_GATEWAY_URL:-http://127.0.0.1:18765}"
AUTH_TOKEN="${ZENTERM_AUTH_TOKEN}"
AGENT="${1:-unknown}"
EVENT_TYPE="${2:-task.completed}"

# Read raw payload from stdin
RAW_PAYLOAD=$(cat)

# Extract summary from different agent formats
SUMMARY=""
SESSION_ID=""
CWD_PATH=""

if [ -n "$RAW_PAYLOAD" ]; then
  # Try to extract fields using python3 (available on most systems)
  SUMMARY=$(echo "$RAW_PAYLOAD" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Claude Code: stop_reason or last message
    print(d.get('stop_reason', d.get('summary', '')))
except:
    pass
" 2>/dev/null || true)
  SESSION_ID=$(echo "$RAW_PAYLOAD" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('session_id', ''))
except:
    pass
" 2>/dev/null || true)
  CWD_PATH=$(echo "$RAW_PAYLOAD" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('cwd', ''))
except:
    pass
" 2>/dev/null || true)
fi

# POST to gateway (fire and forget)
curl -sf -X POST "${GATEWAY_URL}/api/agent-events" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"${EVENT_TYPE}\",
    \"agent\": \"${AGENT}\",
    \"sessionId\": \"${SESSION_ID}\",
    \"summary\": \"${SUMMARY}\",
    \"cwd\": \"${CWD_PATH}\",
    \"timestamp\": $(date +%s)000
  }" > /dev/null 2>&1 &

exit 0
