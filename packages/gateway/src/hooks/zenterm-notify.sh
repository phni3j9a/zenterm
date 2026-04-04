#!/bin/bash
# zenterm-managed — do not edit manually
GATEWAY_URL="${ZENTERM_GATEWAY_URL:-http://127.0.0.1:18765}"
AUTH_TOKEN="${ZENTERM_AUTH_TOKEN}"
AGENT="${1:-unknown}"
EVENT_TYPE="${2:-task.completed}"

# Read raw payload from stdin
RAW_PAYLOAD=$(cat)

# Build JSON safely via python3 to avoid injection from special characters
JSON_BODY=$(python3 -c "
import sys, json, time

agent = sys.argv[1]
event_type = sys.argv[2]
raw = sys.argv[3] if len(sys.argv) > 3 else ''

summary = ''
session_id = ''
cwd = ''

if raw:
    try:
        d = json.loads(raw)
        summary = str(d.get('stop_reason', d.get('summary', '')))[:200]
        session_id = str(d.get('session_id', ''))
        cwd = str(d.get('cwd', ''))
    except Exception:
        pass

print(json.dumps({
    'type': event_type,
    'agent': agent,
    'sessionId': session_id,
    'summary': summary,
    'cwd': cwd,
    'timestamp': int(time.time() * 1000),
}))
" "$AGENT" "$EVENT_TYPE" "$RAW_PAYLOAD" 2>/dev/null)

# Fallback if python3 failed
if [ -z "$JSON_BODY" ]; then
  JSON_BODY="{\"type\":\"${EVENT_TYPE}\",\"agent\":\"${AGENT}\",\"timestamp\":$(date +%s)000}"
fi

# POST to gateway (fire and forget)
curl -sf -X POST "${GATEWAY_URL}/api/agent-events" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY" > /dev/null 2>&1 &

exit 0
