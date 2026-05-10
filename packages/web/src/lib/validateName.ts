const ALLOWED = /^[A-Za-z0-9_-]+$/;
const MAX_LEN = 64;

export function validateSessionOrWindowName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '名前を入力してください';
  if (trimmed.length > MAX_LEN) return '64 文字以内で入力してください';
  if (!ALLOWED.test(trimmed)) return '英数字・_・- のみ使用できます';
  return null;
}
