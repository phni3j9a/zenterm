const IME_DEDUP_MS = 100;

export interface ImeDedup {
  shouldPass(data: string, now: number): boolean;
}

export function createImeDedup(): ImeDedup {
  let lastData = '';
  let lastTime = 0;
  return {
    shouldPass(data, now) {
      const isControl = data.length === 1 || data.charCodeAt(0) <= 0x1f;
      if (isControl) return true;
      if (data === lastData && now - lastTime < IME_DEDUP_MS) {
        return false;
      }
      lastData = data;
      lastTime = now;
      return true;
    },
  };
}
