import { useEffect } from 'react';
import { useTheme } from '@/theme';
import type { ToastEntry } from '@/stores/ui';

export interface ToastProps {
  toast: ToastEntry;
  onDismiss: (id: string) => void;
}

const DEFAULT_DURATION_MS = 4000;

export function Toast({ toast, onDismiss }: ToastProps) {
  const { tokens } = useTheme();
  const duration = toast.durationMs ?? DEFAULT_DURATION_MS;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const background = (() => {
    switch (toast.type) {
      case 'error':
        return tokens.colors.error;
      case 'success':
        return tokens.colors.success;
      default:
        return tokens.colors.bgElevated;
    }
  })();
  const color = toast.type === 'error' || toast.type === 'success'
    ? tokens.colors.textInverse
    : tokens.colors.textPrimary;

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      style={{
        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
        borderRadius: tokens.radii.md,
        background,
        color,
        border: `1px solid ${tokens.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        minWidth: 240,
      }}
    >
      <span style={{ flex: 1, fontSize: tokens.typography.smallMedium.fontSize }}>
        {toast.message}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'transparent',
          color,
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: tokens.typography.bodyMedium.fontSize,
        }}
      >
        ×
      </button>
    </div>
  );
}
