#!/usr/bin/env bash
# 4 セッション × yes ストレステスト。Phase 5b の 4 ペイン同時稼働ストレス用。
# 60 秒間 yes を流し、Mac mini t2 が OOM せず UI 応答することを確認する。
set -euo pipefail

command -v tmux >/dev/null 2>&1 || { echo "[stress] tmux not found in PATH" >&2; exit 1; }

SESSION_PREFIX="zen_stress"
DURATION="${1:-60}"

cleanup() {
  echo "[stress] cleaning up sessions"
  for i in 1 2 3 4; do
    tmux kill-session -t "${SESSION_PREFIX}_$i" 2>/dev/null || true
  done
}
trap cleanup EXIT
cleanup  # remove any leftover sessions from a previous interrupted run

echo "[stress] launching 4 tmux sessions"
for i in 1 2 3 4; do
  tmux new-session -d -s "${SESSION_PREFIX}_$i" "yes 'zen-test-line-$(date +%s)' | timeout ${DURATION} cat"
done

echo "[stress] running for ${DURATION}s. open /web/sessions in browser, layout=grid-2x2, attach all 4."
echo "[stress] watch DevTools Memory / Network / CPU."
sleep "${DURATION}"

echo "[stress] complete. Sessions will be cleaned up on exit."
