import { useEffect, useId, useRef } from 'react';
import { useTheme } from '@/theme';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '削除',
  cancelLabel = 'キャンセル',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { tokens } = useTheme();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClose={() => onCancel()}
      style={{
        padding: 0,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.lg,
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        maxWidth: 420,
      }}
    >
      <div style={{ padding: tokens.spacing.lg, display: 'grid', gap: tokens.spacing.md }}>
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontSize: tokens.typography.heading.fontSize,
            fontWeight: tokens.typography.heading.fontWeight,
          }}
        >
          {title}
        </h2>
        <p
          id={messageId}
          style={{
            margin: 0,
            fontSize: tokens.typography.bodyMedium.fontSize,
            color: tokens.colors.textSecondary,
          }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: tokens.spacing.sm }}>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            style={{
              padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
              background: 'transparent',
              color: tokens.colors.textPrimary,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radii.sm,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            style={{
              padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
              background: destructive ? tokens.colors.error : tokens.colors.primary,
              color: tokens.colors.textInverse,
              border: 'none',
              borderRadius: tokens.radii.sm,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
