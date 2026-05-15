import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { OtpInput } from './login/OtpInput';
import { Card } from './ui/Card';
import { IconTerminal, IconAlertTriangle } from './ui/icons';

export interface LoginFormProps {
  onSubmit: (token: string) => Promise<void>;
  gatewayUrl?: string;
}

export function LoginForm({ onSubmit, gatewayUrl }: LoginFormProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (token.length !== 4) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="elevated" padding="lg" style={{ width: '100%', maxWidth: 420 }}>
      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: tokens.spacing.sm, marginBottom: tokens.spacing.lg,
        }}>
          <div style={{ color: tokens.colors.primary }}>
            <IconTerminal size={36} aria-hidden />
          </div>
          <h2 style={{
            margin: 0,
            fontSize: tokens.typography.heading.fontSize,
            color: tokens.colors.textPrimary,
          }}>
            {t('login.title')}
          </h2>
          <p style={{
            margin: 0,
            fontSize: tokens.typography.small.fontSize,
            color: tokens.colors.textMuted,
            textAlign: 'center',
          }}>
            {t('login.tagline')}
          </p>
        </div>

        {gatewayUrl && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: tokens.spacing.lg }}>
            <span style={{
              fontSize: tokens.typography.small.fontSize,
              color: tokens.colors.textSecondary,
              fontFamily: tokens.typography.mono.fontFamily,
              padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
              background: tokens.colors.surface,
              borderRadius: tokens.radii.sm,
            }}>{gatewayUrl}</span>
          </div>
        )}

        <div style={{ marginBottom: tokens.spacing.md }}>
          <label style={{
            display: 'block', textAlign: 'center',
            marginBottom: tokens.spacing.sm,
            fontSize: tokens.typography.smallMedium.fontSize,
            color: tokens.colors.textSecondary,
          }}>{t('login.tokenLabel')}</label>
          <OtpInput
            value={token}
            onChange={setToken}
            autoFocus
            aria-invalid={Boolean(error)}
            aria-label={t('login.tokenLabel')}
          />
        </div>

        {error && (
          <div role="alert" style={{
            display: 'flex', alignItems: 'center', gap: tokens.spacing.sm,
            color: tokens.colors.error,
            fontSize: tokens.typography.small.fontSize,
            marginBottom: tokens.spacing.md,
          }}>
            <IconAlertTriangle size={16} aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={token.length !== 4 || submitting}
          style={{
            width: '100%', boxSizing: 'border-box', padding: tokens.spacing.md,
            background: tokens.colors.primary, color: tokens.colors.textInverse,
            border: 'none', borderRadius: tokens.radii.md,
            fontSize: tokens.typography.bodyMedium.fontSize, fontWeight: 600,
            cursor: token.length === 4 && !submitting ? 'pointer' : 'not-allowed',
            opacity: token.length === 4 && !submitting ? 1 : 0.5,
            boxShadow: tokens.shadows.sm,
          }}
        >
          {submitting ? '…' : t('login.submit')}
        </button>
      </form>
    </Card>
  );
}
