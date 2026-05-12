/**
 * useRateLimitsWarning
 *
 * Returns true when any active rate-limit window is >= 80% used.
 *
 * NOTE: ClaudeLimits and CodexLimits currently hold their fetched data in
 * local component state (no global store). Until a shared rate-limits store
 * is introduced (Phase 6 follow-up), this hook conservatively returns false
 * to avoid requiring a full store refactor in this task. The LeftRail wiring
 * is in place — replace the `false` return below with real store reads once
 * a global rateLimits store is added.
 */
export function useRateLimitsWarning(): boolean {
  return false;
}
