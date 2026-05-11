import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CodexLimitsResponse, CodexAccountStatus } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { LimitsRow, type LimitsRowWindow } from './LimitsRow';

export interface CodexLimitsClient {
  getCodexLimits(): Promise<CodexLimitsResponse>;
}

interface Props { client: CodexLimitsClient; refreshKey: number }

const fmtRel = (s: number) => {
  if (s <= 0) return '0m';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
const fmtAge = (s: number) => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};
const nowSec = () => Math.floor(Date.now() / 1000);

export function CodexLimits({ client, refreshKey }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<CodexLimitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    client.getCodexLimits()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [client, refreshKey]);

  if (error) return <p style={{ color: tokens.colors.error, fontSize: 11 }}>{error}</p>;
  if (!data) return <p style={{ color: tokens.colors.textMuted, fontSize: 11 }}>{t('common.loading', 'Loading…')}</p>;
  if (data.state === 'unconfigured') {
    return (
      <p style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>
        {t('settings.rateLimits.codexUnconfigured', 'Not configured')}
      </p>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        {t('settings.rateLimits.codex', 'Codex')}
      </p>
      {data.accounts.map((acc) => renderCodex(acc, t, tokens))}
    </div>
  );
}

function renderCodex(acc: CodexAccountStatus, t: any, tokens: any) {
  if (acc.state === 'unavailable') {
    return (
      <p key={acc.label} style={{ color: tokens.colors.error, fontSize: 11 }}>
        {t('settings.rateLimits.unavailable', 'Unavailable')} — {acc.message}
      </p>
    );
  }
  if (acc.state === 'pending') {
    return (
      <p key={acc.label} style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>
        {t('settings.rateLimits.pending', 'Calculating…')}
      </p>
    );
  }
  const windows: LimitsRowWindow[] = [];
  if (acc.fiveHour) windows.push({ shortLabel: '5h', percent: acc.fiveHour.usedPercentage, resetsInText: fmtRel(acc.fiveHour.resetsAt - nowSec()) });
  if (acc.sevenDay) windows.push({ shortLabel: '7d', percent: acc.sevenDay.usedPercentage, resetsInText: fmtRel(acc.sevenDay.resetsAt - nowSec()) });
  return (
    <LimitsRow
      key={acc.label}
      windows={windows}
      stale={acc.stale}
      staleText={acc.stale ? t('settings.rateLimits.stale', { age: fmtAge(acc.ageSeconds), defaultValue: 'Last updated {{age}} ago' }) : undefined}
    />
  );
}
