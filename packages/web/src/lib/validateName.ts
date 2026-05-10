export type NameValidationError = 'empty' | 'too-long' | 'invalid-chars';

const ALLOWED = /^[A-Za-z0-9_-]+$/;
const MAX_LEN = 64;

export function validateSessionOrWindowName(name: string): NameValidationError | null {
  const trimmed = name.trim();
  if (!trimmed) return 'empty';
  if (trimmed.length > MAX_LEN) return 'too-long';
  if (!ALLOWED.test(trimmed)) return 'invalid-chars';
  return null;
}

const KEY_MAP: Record<NameValidationError, string> = {
  'empty': 'validation.nameEmpty',
  'too-long': 'validation.nameTooLong',
  'invalid-chars': 'validation.nameInvalidChars',
};

export function nameValidationKey(err: NameValidationError): string {
  return KEY_MAP[err];
}
