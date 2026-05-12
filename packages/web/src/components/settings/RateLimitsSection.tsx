import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/api/client';
import { useTheme } from '@/theme';
import { IconRefresh } from '@/components/ui/icons';
import { ClaudeLimits } from './ClaudeLimits';
import { CodexLimits } from './CodexLimits';

interface Props {
  client: ApiClient;
  headingId?: string;
}

export function RateLimitsSection({ client, headingId }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3
          id={headingId}
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
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <IconRefresh size={12} />
          {t('settings.rateLimits.refresh', 'Refresh')}
        </button>
      </div>
      <ClaudeLimits client={client} refreshKey={refreshKey} />
      <CodexLimits client={client} refreshKey={refreshKey} />
    </section>
  );
}
