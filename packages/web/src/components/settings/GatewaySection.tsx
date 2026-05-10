import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme';
import { buildPairingUrl } from '@/lib/qr';
import { QrModal } from './QrModal';
import { ReauthDialog } from './ReauthDialog';

interface Props {
  gatewayVersion: string | null;
}

export function GatewaySection({ gatewayVersion }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const auth = useAuthStore();
  const showConfirm = useUiStore((s) => s.showConfirm);
  const pushToast = useUiStore((s) => s.pushToast);
  const navigate = useNavigate();
  const [qrOpen, setQrOpen] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);

  const webUrl = `${window.location.origin}/web`;
  const pairingUrl = auth.token ? buildPairingUrl(window.location.origin, auth.token) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webUrl);
      pushToast({ type: 'info', message: t('settings.gateway.copied', 'Web URL copied') });
    } catch {
      pushToast({ type: 'error', message: t('settings.gateway.copyFailed', 'Copy failed — please copy manually') });
    }
  };

  const handleLogout = () => {
    showConfirm({
      title: t('settings.gateway.logoutTitle', 'Logout'),
      message: t('settings.gateway.logoutConfirm', 'Sign out and return to the login screen?'),
      destructive: true,
      confirmLabel: t('settings.gateway.logout', 'Logout'),
      onConfirm: () => {
        auth.logout();
        navigate('/web/login', { replace: true });
      },
    });
  };

  const buttonStyle = (danger = false) => ({
    background: tokens.colors.surface,
    border: `1px solid ${danger ? tokens.colors.error : tokens.colors.border}`,
    color: danger ? tokens.colors.error : tokens.colors.textPrimary,
    padding: `8px 12px`,
    borderRadius: tokens.radii.sm,
    cursor: 'pointer' as const,
    width: '100%',
    textAlign: 'left' as const,
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.small.fontSize,
  });

  return (
    <section
      role="region"
      aria-label="Gateway"
      style={{
        marginTop: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
        borderTop: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <h3
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: tokens.typography.caption.fontSize,
          color: tokens.colors.textMuted,
          margin: `0 0 ${tokens.spacing.sm}px 0`,
        }}
      >
        {t('settings.gateway.title', 'Gateway')}
      </h3>

      <dl style={{ margin: 0 }}>
        <dt style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize }}>
          {t('settings.gateway.connectedTo', 'Connected to')}
        </dt>
        <dd style={{ margin: `2px 0 ${tokens.spacing.sm}px 0`, color: tokens.colors.textPrimary, fontFamily: 'ui-monospace, monospace', fontSize: tokens.typography.small.fontSize, wordBreak: 'break-all' }}>
          {auth.gatewayUrl}
        </dd>

        <dt style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize }}>
          {t('settings.gateway.token', 'Token')}
        </dt>
        <dd style={{ margin: `2px 0 ${tokens.spacing.sm}px 0`, color: tokens.colors.textPrimary, fontFamily: 'ui-monospace, monospace' }}>
          ••••
        </dd>

        <dt style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize }}>
          {t('settings.gateway.version', 'Gateway version')}
        </dt>
        <dd style={{ margin: `2px 0 ${tokens.spacing.sm}px 0`, color: tokens.colors.textPrimary, fontSize: tokens.typography.small.fontSize }}>
          {gatewayVersion ?? t('common.loading', 'Loading…')}
        </dd>
      </dl>

      <button type="button" onClick={handleCopy} style={buttonStyle()}>
        {t('settings.gateway.copyUrl', 'Copy Web URL')}
      </button>
      <button type="button" onClick={() => setQrOpen(true)} style={buttonStyle()}>
        {t('settings.gateway.showQr', 'Show mobile QR')}
      </button>
      <button type="button" onClick={() => setReauthOpen(true)} style={buttonStyle()}>
        {t('settings.gateway.reauth', 'Re-enter token')}
      </button>
      <button type="button" onClick={handleLogout} style={buttonStyle(true)}>
        {t('settings.gateway.logout', 'Logout')}
      </button>

      <QrModal open={qrOpen} url={pairingUrl} onClose={() => setQrOpen(false)} />
      <ReauthDialog open={reauthOpen} onClose={() => setReauthOpen(false)} />
    </section>
  );
}
