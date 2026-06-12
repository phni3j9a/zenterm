import { useEffect } from 'react';
import { useTheme } from '@/theme';
import type { ToastEntry } from '@/stores/ui';
import { IconCheck, IconAlertTriangle, IconInfo } from './icons';

export interface ToastProps {
  toast: ToastEntry;
  onDismiss: (id: string) => void;
}

const DEFAULT_DURATION_MS = 4000;

export function Toast({ toast, onDismiss }: ToastProps) {
  const { tokens, resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const duration = toast.durationMs ?? DEFAULT_DURATION_MS;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  // 白(bgElevated)のカードに、種別はアイコンチップの色だけで語らせる。
  // ベタ塗りより文字が常に最大コントラストで読め、画面の調和も崩さない。
  const accent = (() => {
    switch (toast.type) {
      case 'error':
        return { fg: tokens.colors.error, bg: tokens.colors.errorSubtle, Icon: IconAlertTriangle };
      case 'success':
        return { fg: tokens.colors.success, bg: tokens.colors.successSubtle, Icon: IconCheck };
      default:
        return { fg: tokens.colors.info, bg: tokens.colors.infoSubtle, Icon: IconInfo };
    }
  })();
  const { Icon } = accent;

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      style={{
        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
        borderRadius: tokens.radii.md,
        background: dark ? tokens.colors.surface : tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        boxShadow: tokens.shadows.md,
        minWidth: 240,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: accent.bg,
          color: accent.fg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={14} />
      </span>
      <span style={{ flex: 1, fontSize: tokens.typography.smallMedium.fontSize }}>
        {toast.message}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'transparent',
          color: tokens.colors.textMuted,
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: tokens.typography.bodyMedium.fontSize,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
