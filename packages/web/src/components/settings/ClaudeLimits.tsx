import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClaudeLimitsResponse, ClaudeAccountStatus } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { Badge } from '@/components/ui/Badge';
import { IconInfo } from '@/components/ui/icons';
import { LimitsRow, type LimitsRowWindow } from './LimitsRow';

export interface ClaudeLimitsClient {
  getClaudeLimits(): Promise<ClaudeLimitsResponse>;
}

interface Props {
  client: ClaudeLimitsClient;
  refreshKey: number;
}

const DOCS_URL = 'https://github.com/phni3j9a/zenterm/blob/main/docs/claude-statusline.md';

function nowSec() { return Math.floor(Date.now() / 1000); }
function fmtRel(seconds: number): string {
  if (seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function fmtAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function expandPlanLetter(letter: string, t: (key: string, fallback: string) => string): string {
  switch (letter.toUpperCase()) {
    case 'B': return t('rateLimits.plan.basic', 'Basic');
    case 'P': return t('rateLimits.plan.pro', 'Pro');
    case 'M': return t('rateLimits.plan.max', 'Max');
    default: return letter.length === 1 ? t('rateLimits.plan.unknown', 'Unknown') : letter;
  }
}

export function ClaudeLimits({ client, refreshKey }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<ClaudeLimitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    client.getClaudeLimits()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [client, refreshKey]);

  if (error) return <p style={{ color: tokens.colors.error, fontSize: 11 }}>{error}</p>;
  if (!data) return <p style={{ color: tokens.colors.textMuted, fontSize: 11 }}>{t('common.loading', 'Loading…')}</p>;

  if (data.state === 'unconfigured') {
    return (
      <div style={{ padding: `${tokens.spacing.xs}px 0` }}>
        <p style={{ color: tokens.colors.textSecondary, fontSize: 12, margin: 0 }}>
          {t('settings.rateLimits.claudeUnconfigured', 'Not configured')}
        </p>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: tokens.spacing.xs,
            padding: `6px 12px`,
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radii.sm,
            color: tokens.colors.primary,
            fontSize: tokens.typography.small.fontSize,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          {t('rateLimits.setupGuide', 'Setup guide')}
        </a>
      </div>
    );
  }

  const showLabels = data.accounts.length > 1 || data.accounts.some((a) => a.label !== 'default');

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        {t('settings.rateLimits.claude', 'Claude')}
      </p>
      {data.accounts.map((acc, i) => (
        <div key={acc.label}>
          {i > 0 ? <hr style={{ border: 0, borderTop: `1px solid ${tokens.colors.borderSubtle}`, margin: '4px 0 4px 16px' }} /> : null}
          {renderAccount(acc, showLabels, t, tokens, expandPlanLetter)}
        </div>
      ))}
    </div>
  );
}

function renderAccount(
  acc: ClaudeAccountStatus,
  showLabel: boolean,
  t: any,
  tokens: any,
  expandPlan: (letter: string, t: any) => string,
) {
  const labelText = showLabel ? acc.label : undefined;
  if (acc.state === 'unavailable') {
    return (
      <div style={{ padding: '6px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: tokens.colors.error, marginTop: 5 }} />
        {labelText ? <span style={{ fontSize: 11, color: tokens.colors.textSecondary, textTransform: 'uppercase', minWidth: 36 }}>{labelText}</span> : null}
        <div style={{ flex: 1 }}>
          <p style={{ color: tokens.colors.error, fontSize: 11, margin: 0 }}>{t('settings.rateLimits.unavailable', 'Unavailable')}</p>
          <p style={{ color: tokens.colors.textMuted, fontSize: 11, margin: 0 }}>{acc.message}</p>
        </div>
      </div>
    );
  }
  if (acc.state === 'pending') {
    return (
      <div style={{ padding: '6px 0', display: 'flex', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: tokens.colors.textMuted, marginTop: 5 }} />
        {labelText ? <span style={{ fontSize: 11, color: tokens.colors.textSecondary, textTransform: 'uppercase', minWidth: 36 }}>{labelText}</span> : null}
        <p style={{ color: tokens.colors.textSecondary, fontSize: 11, margin: 0 }}>{t('settings.rateLimits.pending', 'Calculating…')}</p>
      </div>
    );
  }
  const windows: LimitsRowWindow[] = [];
  if (acc.fiveHour) windows.push({ shortLabel: '5h', percent: acc.fiveHour.usedPercentage, resetsInText: fmtRel(acc.fiveHour.resetsAt - nowSec()) });
  if (acc.sevenDay) windows.push({ shortLabel: '7d', percent: acc.sevenDay.usedPercentage, resetsInText: fmtRel(acc.sevenDay.resetsAt - nowSec()) });

  // Plan badge: if acc has a plan field (single letter or full name), render Badge
  const planRaw: string | undefined = (acc as any).plan;
  const planLabel = planRaw ? expandPlan(planRaw, t) : undefined;

  return (
    <div>
      {planLabel ? (
        <div style={{ marginBottom: 4 }}>
          <Badge tone="info" icon={<IconInfo size={10} />}>
            {planLabel}
          </Badge>
        </div>
      ) : null}
      <LimitsRow
        accountLabel={labelText}
        windows={windows}
        stale={acc.stale}
        staleText={acc.stale ? t('settings.rateLimits.stale', { age: fmtAge(acc.ageSeconds), defaultValue: 'Last updated {{age}} ago' }) : undefined}
      />
    </div>
  );
}
