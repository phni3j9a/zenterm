const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 20;

export interface BackoffStep {
  delayMs: number;
  attempt: number;
  exhausted: boolean;
}

export interface ReconnectBackoff {
  next(): BackoffStep;
  reset(): void;
}

export function createReconnectBackoff(): ReconnectBackoff {
  let attempt = 0;
  let delay = INITIAL_DELAY_MS;
  return {
    next() {
      attempt += 1;
      if (attempt > MAX_ATTEMPTS) {
        return { delayMs: delay, attempt, exhausted: true };
      }
      const step: BackoffStep = { delayMs: delay, attempt, exhausted: false };
      delay = Math.min(delay * 2, MAX_DELAY_MS);
      return step;
    },
    reset() {
      attempt = 0;
      delay = INITIAL_DELAY_MS;
    },
  };
}
