import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { validateSessionOrWindowName } from '@/lib/validateName';

export interface NewWindowButtonProps {
  onCreate: (name?: string) => void | Promise<void>;
}

export function NewWindowButton({ onCreate }: NewWindowButtonProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const submit = (): void => {
    const trimmed = text.trim();
    if (trimmed === '') {
      void onCreate(undefined);
      setEditing(false);
      setText('');
      return;
    }
    const validationError = validateSessionOrWindowName(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    void onCreate(trimmed);
    setEditing(false);
    setText('');
    setError(null);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          width: '100%',
          padding: tokens.spacing.xs,
          background: 'transparent',
          color: tokens.colors.textMuted,
          border: 'none',
          cursor: 'pointer',
          fontSize: tokens.typography.smallMedium.fontSize,
          textAlign: 'left',
        }}
      >
        {'+ ' + t('sessions.newWindow')}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        placeholder={t('sessions.namePlaceholder')}
        aria-label={t('sessions.newWindow')}
        aria-invalid={error ? 'true' : 'false'}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(false);
            setText('');
            setError(null);
          }
        }}
        onBlur={() => {
          setEditing(false);
          setText('');
          setError(null);
        }}
        style={{
          width: '100%',
          padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
          background: tokens.colors.surface,
          color: tokens.colors.textPrimary,
          border: `1px solid ${error ? tokens.colors.error : tokens.colors.border}`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.smallMedium.fontSize,
        }}
      />
      {error && (
        <span
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
