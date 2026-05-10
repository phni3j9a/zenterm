import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface QrModalProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

export function QrModal({ open, url, onClose }: QrModalProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else {
      if (d.open) d.close();
    }
  }, [open]);

  if (!open) {
    return <dialog ref={dialogRef} aria-label="Pair mobile app" />;
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      style={{
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        padding: tokens.spacing.xl,
        maxWidth: 360,
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: tokens.typography.heading.fontSize }}>
        {t('settings.gateway.qrTitle', 'Pair mobile app')}
      </h2>
      <p style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.small.fontSize }}>
        {t('settings.gateway.qrInstructions', 'Scan this QR with the ZenTerm mobile app to pair.')}
      </p>
      <div style={{ background: '#fff', padding: tokens.spacing.md, display: 'flex', justifyContent: 'center', borderRadius: tokens.radii.sm }}>
        <QRCodeSVG value={url} size={200} level="M" />
      </div>
      <p style={{ marginTop: tokens.spacing.md, fontFamily: 'ui-monospace, monospace', fontSize: tokens.typography.caption.fontSize, wordBreak: 'break-all', color: tokens.colors.textMuted }}>
        {url}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: tokens.spacing.md }}>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          style={{
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            color: tokens.colors.textPrimary,
            padding: `6px 16px`,
            borderRadius: tokens.radii.sm,
            cursor: 'pointer',
          }}
        >
          {t('common.close', 'Close')}
        </button>
      </div>
    </dialog>
  );
}
