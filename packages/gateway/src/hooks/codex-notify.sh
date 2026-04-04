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

# Build JSON safely via python3 to avoid injection from special characters
JSON_BODY=$(python3 -c "
import sys, json, time

raw = sys.argv[1] if len(sys.argv) > 1 else '{}'

summary = ''
cwd = ''
thread_id = ''

try:
    d = json.loads(raw)
    summary = str(d.get('last-assistant-message', ''))[:200]
    cwd = str(d.get('cwd', ''))
    thread_id = str(d.get('thread-id', ''))
except Exception:
    pass

print(json.dumps({
    'type': 'task.completed',
    'agent': 'codex',
    'sessionId': thread_id,
    'summary': summary,
    'cwd': cwd,
    'timestamp': int(time.time() * 1000),
}))
" "$PAYLOAD" 2>/dev/null)

# Fallback if python3 failed
if [ -z "$JSON_BODY" ]; then
  JSON_BODY="{\"type\":\"task.completed\",\"agent\":\"codex\",\"timestamp\":$(date +%s)000}"
fi

curl -sf -X POST "${GATEWAY_URL}/api/agent-events" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY" > /dev/null 2>&1 &

exit 0
