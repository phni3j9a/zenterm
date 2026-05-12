export interface TrailingDebounced {
  (): void;
  cancel: () => void;
}

/**
 * 先頭即実行 + 後続を window 内にまとめて 1 回 trailing fire する debounce。
 *
 * fn() の連続呼び出しを N ms に 2 回まで (先頭 + 最後) に削減する。
 * ResizeObserver の連続発火が多すぎる場合の負荷軽減用。
 */
export function createTrailingDebounce(fn: () => void, windowMs: number): TrailingDebounced {
  let lastFireAt = -windowMs;
  let trailingTimer: number | null = null;

  const trigger: TrailingDebounced = (() => {
    const now = performance.now();
    const elapsed = now - lastFireAt;
    if (elapsed >= windowMs) {
      lastFireAt = now;
      fn();
      return;
    }
    if (trailingTimer !== null) return;
    trailingTimer = window.setTimeout(() => {
      trailingTimer = null;
      lastFireAt = performance.now();
      fn();
    }, windowMs - elapsed);
  }) as TrailingDebounced;

  trigger.cancel = () => {
    if (trailingTimer !== null) {
      window.clearTimeout(trailingTimer);
      trailingTimer = null;
    }
  };

  return trigger;
}
