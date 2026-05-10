import { useState, type FormEvent } from 'react';
import { useTheme } from '@/theme';

export interface LoginFormProps {
  onSubmit: (token: string) => Promise<void>;
  gatewayUrl?: string;
}

export function LoginForm({ onSubmit, gatewayUrl }: LoginFormProps) {
  const { tokens } = useTheme();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
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
    <form
      onSubmit={handleSubmit}
      style={{
        background: tokens.colors.surface,
        color: tokens.colors.textPrimary,
        padding: tokens.spacing['2xl'],
        borderRadius: tokens.radii.lg,
        width: '100%',
        maxWidth: 360,
        boxSizing: 'border-box',
      }}
    >
      <h2 style={{ margin: 0, marginBottom: tokens.spacing.lg, fontSize: tokens.typography.heading.fontSize }}>
        ZenTerm Web
      </h2>
      {gatewayUrl && (
        <p style={{ fontSize: tokens.typography.small.fontSize, color: tokens.colors.textMuted, margin: 0, marginBottom: tokens.spacing.lg, fontFamily: tokens.typography.mono.fontFamily }}>
          {gatewayUrl}
        </p>
      )}
      <label style={{ display: 'block', marginBottom: tokens.spacing.sm, fontSize: tokens.typography.smallMedium.fontSize, color: tokens.colors.textSecondary }}>
        Token
        <input
          autoFocus
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={{
            display: 'block',
            marginTop: tokens.spacing.sm,
            width: '100%',
            padding: tokens.spacing.md,
            fontSize: 24,
            letterSpacing: 8,
            textAlign: 'center',
            fontFamily: tokens.typography.mono.fontFamily,
            background: tokens.colors.bg,
            color: tokens.colors.textPrimary,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radii.md,
            boxSizing: 'border-box',
          }}
          aria-invalid={Boolean(error)}
        />
      </label>
      {error && (
        <p role="alert" style={{ color: tokens.colors.error, fontSize: tokens.typography.small.fontSize, margin: `${tokens.spacing.sm}px 0` }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={token.length !== 4 || submitting}
        style={{
          width: '100%',
          padding: tokens.spacing.md,
          marginTop: tokens.spacing.md,
          background: tokens.colors.primary,
          color: tokens.colors.textInverse,
          border: 'none',
          borderRadius: tokens.radii.md,
          fontSize: tokens.typography.bodyMedium.fontSize,
          fontWeight: 600,
          cursor: token.length === 4 && !submitting ? 'pointer' : 'not-allowed',
          opacity: token.length === 4 && !submitting ? 1 : 0.5,
        }}
      >
        {submitting ? '…' : 'Connect'}
      </button>
    </form>
  );
}
