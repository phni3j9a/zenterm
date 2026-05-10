import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/api/client';
import { useTheme } from '@/theme';
import { ClaudeLimits } from './ClaudeLimits';
import { CodexLimits } from './CodexLimits';

interface Props {
  client: ApiClient;
}

export function RateLimitsSection({ client }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section
      role="region"
      aria-label="Rate limits"
      style={{
        marginTop: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
        borderTop: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: tokens.typography.caption.fontSize,
            color: tokens.colors.textMuted,
            margin: 0,
          }}
        >
          {t('settings.rateLimits.title', 'Rate limits')}{' '}
          <span style={{ background: '#4a2f00', color: '#ffb84d', fontSize: 9, padding: '1px 6px', borderRadius: 3, marginLeft: 4 }}>β</span>
        </h3>
        <button
          type="button"
          aria-label={t('settings.rateLimits.refresh', 'Refresh')}
          onClick={() => setRefreshKey((k) => k + 1)}
          style={{
            background: 'transparent',
            border: 'none',
            color: tokens.colors.primary,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          ↻ {t('settings.rateLimits.refresh', 'Refresh')}
        </button>
      </div>
      <ClaudeLimits client={client} refreshKey={refreshKey} />
      <CodexLimits client={client} refreshKey={refreshKey} />
    </section>
  );
}
