import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface Props {
  open: boolean;
  title: string;
  placeholder: string;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function FilesNewNameDialog({ open, title, placeholder, initialValue, onCancel, onSubmit }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
    if (!open && ref.current && ref.current.open) ref.current.close();
    setValue(initialValue);
  }, [open, initialValue]);

  const handleSubmit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
  };

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      style={{
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        borderRadius: 8,
        padding: tokens.spacing.lg,
        minWidth: 320,
      }}
    >
      <h3 style={{ margin: 0, marginBottom: tokens.spacing.md }}>{title}</h3>
      <input
        type="text"
        value={value}
        autoFocus
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        style={{
          width: '100%',
          padding: tokens.spacing.sm,
          background: tokens.colors.bg,
          color: tokens.colors.textPrimary,
          border: `1px solid ${tokens.colors.borderSubtle}`,
          borderRadius: 4,
          fontSize: tokens.typography.bodyMedium.fontSize,
        }}
      />
      <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end', marginTop: tokens.spacing.md }}>
        <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" onClick={handleSubmit}>OK</button>
      </div>
    </dialog>
  );
}
