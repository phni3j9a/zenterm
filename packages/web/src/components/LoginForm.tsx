import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { OtpInput } from './login/OtpInput';
import { Card } from './ui/Card';
import { Spinner } from './ui/Spinner';
import { IconTerminal, IconAlertTriangle } from './ui/icons';

export interface LoginFormProps {
  onSubmit: (token: string) => Promise<void>;
  gatewayUrl?: string;
}

export function LoginForm({ onSubmit, gatewayUrl }: LoginFormProps) {
  const { tokens, resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 失敗のたびに key を変えて shake を再生する
  const [errorBeat, setErrorBeat] = useState(0);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (token.length !== 4) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setErrorBeat((n) => n + 1);
      setToken('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="elevated" padding="lg" style={{ width: '100%', boxSizing: 'border-box' }}>
      <form onSubmit={handleSubmit}>
        <div className="zen-stagger" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: tokens.spacing.sm, marginBottom: tokens.spacing.lg,
          }}>
            {/* 禅円の中のターミナル — ブランドマーク */}
            <div
              aria-hidden
              style={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: tokens.colors.primarySubtle,
                border: `1px solid ${dark ? 'rgba(166, 186, 152, 0.25)' : 'rgba(92, 113, 80, 0.22)'}`,
                // inset リングはカード面の色で抜く (Card は dark=surface / light=bgElevated)
                boxShadow: `inset 0 0 0 5px ${dark ? tokens.colors.surface : tokens.colors.bgElevated}, ${tokens.shadows.sm}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.primary,
                marginBottom: tokens.spacing.xs,
              }}
            >
              <IconTerminal size={32} strokeWidth={1.75} />
            </div>
            <h2 className="zen-display" style={{
              margin: 0,
              fontSize: 22,
              lineHeight: 1.4,
              fontWeight: 600,
              color: tokens.colors.textPrimary,
            }}>
              {t('login.title')}
            </h2>
            <p style={{
              margin: 0,
              fontSize: tokens.typography.small.fontSize,
              color: tokens.colors.textMuted,
              textAlign: 'center',
              letterSpacing: '0.02em',
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
                padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
                // カード面と同化しないよう一段ずらす (dark は明るく / light は沈む)
                background: dark ? tokens.colors.surfaceHover : tokens.colors.surface,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                borderRadius: 999,
              }}>{gatewayUrl}</span>
            </div>
          )}

          <div
            key={errorBeat}
            className={errorBeat > 0 ? 'zen-shake' : undefined}
            style={{ marginBottom: tokens.spacing.md }}
          >
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: tokens.spacing.sm,
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
            className="zen-btn-primary"
            disabled={token.length !== 4 || submitting}
            style={{
              width: '100%', boxSizing: 'border-box', padding: tokens.spacing.md,
              background: tokens.colors.primary, color: tokens.colors.textInverse,
              border: 'none', borderRadius: tokens.radii.md,
              fontSize: tokens.typography.bodyMedium.fontSize, fontWeight: 600,
              letterSpacing: '0.06em',
              cursor: token.length === 4 && !submitting ? 'pointer' : 'not-allowed',
              opacity: token.length === 4 && !submitting ? 1 : 0.5,
              boxShadow: tokens.shadows.sm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: tokens.spacing.sm,
              minHeight: 46,
            }}
          >
            {submitting ? <Spinner size={18} /> : t('login.submit')}
          </button>
        </div>
      </form>
    </Card>
  );
}
