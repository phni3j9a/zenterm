import { useRef, useEffect, type ClipboardEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { useTheme } from '@/theme';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
}

export function OtpInput({ length = 4, value, onChange, autoFocus, ...aria }: OtpInputProps) {
  const { tokens } = useTheme();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i: number, ch: string) => {
    const digits = value.padEnd(length, ' ').slice(0, length).split('');
    digits[i] = ch;
    const next = digits.join('').trimEnd();
    onChange(next);
  };

  const handleChange = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    setAt(i, raw[raw.length - 1]);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) {
        setAt(i, '');
      } else if (i > 0) {
        setAt(i - 1, '');
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  };

  return (
    <div
      role="group"
      aria-label={aria['aria-label'] ?? 'Token input'}
      style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'center' }}
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={handleChange(i)}
          onKeyDown={handleKey(i)}
          onPaste={handlePaste}
          aria-invalid={aria['aria-invalid']}
          aria-label={`Digit ${i + 1}`}
          style={{
            width: 56, height: 64,
            fontSize: 28,
            textAlign: 'center',
            fontFamily: tokens.typography.mono.fontFamily,
            background: tokens.colors.bg,
            color: tokens.colors.textPrimary,
            border: `2px solid ${value[i] ? tokens.colors.primary : tokens.colors.border}`,
            borderRadius: tokens.radii.md,
            outline: 'none',
            transition: 'border-color 120ms',
          }}
        />
      ))}
    </div>
  );
}
