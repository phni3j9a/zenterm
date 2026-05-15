import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '@/theme';

export interface InlineEditProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  onCancel: () => void;
  validate?: (next: string) => string | null;
  maxLength?: number;
  placeholder?: string;
  ariaLabel?: string;
}

export function InlineEdit({
  value,
  onSave,
  onCancel,
  validate,
  maxLength = 64,
  placeholder,
  ariaLabel = '名前を編集',
}: InlineEditProps) {
  const { tokens } = useTheme();
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submittedRef = useRef(false);
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const attemptSave = (): void => {
    const validationError = validate ? validate(text) : null;
    if (validationError) {
      setError(validationError);
      return;
    }
    submittedRef.current = true;
    void onSave(text.trim());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            attemptSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (submittedRef.current) return;
          attemptSave();
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
          background: tokens.colors.surface,
          color: tokens.colors.textPrimary,
          border: `1px solid ${error ? tokens.colors.error : tokens.colors.border}`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.bodyMedium.fontSize,
          fontFamily: 'inherit',
        }}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontSize: tokens.typography.caption.fontSize,
            color: tokens.colors.error,
            paddingLeft: tokens.spacing.sm,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
