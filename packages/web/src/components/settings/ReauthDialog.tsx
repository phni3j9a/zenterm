import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';

interface ReauthDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ReauthDialog({ open, onClose }: ReauthDialogProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const auth = useAuthStore();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (open) { setToken(''); setError(null); setSubmitting(false); }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.gatewayUrl) return;
    setSubmitting(true);
    setError(null);
    const client = new ApiClient(auth.gatewayUrl, token);
    const ok = await client.verifyToken();
    setSubmitting(false);
    if (ok) {
      auth.login(token, auth.gatewayUrl);
      onClose();
    } else {
      setError(t('settings.gateway.invalidToken', 'Invalid token'));
    }
  };

  if (!open) return <dialog ref={dialogRef} aria-label="Re-enter token" />;

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
        minWidth: 320,
      }}
    >
      <form onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0, fontSize: tokens.typography.heading.fontSize }}>
          {t('settings.gateway.reauthTitle', 'Re-enter token')}
        </h2>
        <label
          htmlFor="reauth-token"
          style={{ display: 'block', color: tokens.colors.textSecondary, marginBottom: tokens.spacing.xs, fontSize: tokens.typography.small.fontSize }}
        >
          {t('settings.gateway.token', 'Token')}
        </label>
        <input
          id="reauth-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: `8px 10px`,
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            color: tokens.colors.textPrimary,
            borderRadius: tokens.radii.sm,
            fontSize: tokens.typography.smallMedium.fontSize,
          }}
        />
        {error ? (
          <p role="alert" style={{ color: tokens.colors.error, fontSize: tokens.typography.caption.fontSize, marginTop: tokens.spacing.xs }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: tokens.spacing.sm, marginTop: tokens.spacing.lg }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${tokens.colors.border}`,
              color: tokens.colors.textSecondary,
              padding: `6px 14px`,
              borderRadius: tokens.radii.sm,
              cursor: 'pointer',
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || token.length === 0}
            style={{
              background: tokens.colors.primary,
              border: 'none',
              color: tokens.colors.textInverse,
              padding: `6px 14px`,
              borderRadius: tokens.radii.sm,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {t('settings.gateway.verify', 'Verify')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
