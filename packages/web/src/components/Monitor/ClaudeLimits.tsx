import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClaudeAccountStatus, ClaudeLimitsResponse } from '@zenterm/shared';
import { getClaudeLimits } from '../../api/client';
import styles from './ClaudeLimits.module.css';

const DOCS_URL =
  'https://github.com/phni3j9a/zenterm/blob/main/docs/claude-statusline.md';

export function ClaudeLimits() {
  const { t } = useTranslation();
  const [data, setData] = useState<ClaudeLimitsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      setData(await getClaudeLimits());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>{t('claudeLimits.title')}</h3>
          <span className={styles.experimentalBadge}>{t('claudeLimits.experimental')}</span>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void refresh()}
          disabled={loading}
          aria-label={t('claudeLimits.refresh')}
        >
          {loading ? '…' : '↻'}
        </button>
      </header>
      <Body data={data} fetchError={fetchError} />
    </section>
  );
}

interface BodyProps {
  data: ClaudeLimitsResponse | null;
  fetchError: string | null;
}

function Body({ data, fetchError }: BodyProps) {
  const { t } = useTranslation();

  if (fetchError) {
    return <div className={styles.error}>{fetchError}</div>;
  }

  if (!data) {
    return <div className={styles.loading}>{t('common.loading')}</div>;
  }

  if (data.state === 'unconfigured') {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeText}>{t('claudeLimits.unconfigured')}</p>
        <p className={styles.noticeHint}>{t('claudeLimits.unconfiguredHint')}</p>
        <a
          className={styles.noticeLink}
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('claudeLimits.openDocs')}
        </a>
      </div>
    );
  }

  // state === 'configured' — render each account
  const showLabels = data.accounts.length > 1 || data.accounts.some((a) => a.label !== 'default');

  return (
    <div className={styles.accounts}>
      {data.accounts.map((account, i) => (
        <AccountRow key={`${account.label}-${i}`} account={account} showLabel={showLabels} />
      ))}
    </div>
  );
}

interface AccountRowProps {
  account: ClaudeAccountStatus;
  showLabel: boolean;
}

function AccountRow({ account, showLabel }: AccountRowProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.account}>
      {showLabel && <div className={styles.accountLabel}>{account.label}</div>}
      <AccountBody account={account} />
    </div>
  );
}

function AccountBody({ account }: { account: ClaudeAccountStatus }) {
  const { t } = useTranslation();

  if (account.state === 'unavailable') {
    return (
      <div className={styles.error}>
        <div>{t('claudeLimits.unavailable')}</div>
        <div className={styles.errorDetail}>{account.message}</div>
      </div>
    );
  }

  if (account.state === 'pending') {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeText}>{t('claudeLimits.pending')}</p>
        <StaleHint stale={account.stale} ageSeconds={account.ageSeconds} />
      </div>
    );
  }

  // state === 'ok'
  const { fiveHour, sevenDay, ageSeconds, stale } = account;
  return (
    <div className={styles.body} data-stale={stale}>
      {fiveHour && (
        <RateBar
          label={t('claudeLimits.fiveHour')}
          percent={fiveHour.usedPercentage}
          resetsAt={fiveHour.resetsAt}
        />
      )}
      {sevenDay && (
        <RateBar
          label={t('claudeLimits.sevenDay')}
          percent={sevenDay.usedPercentage}
          resetsAt={sevenDay.resetsAt}
        />
      )}
      <StaleHint stale={stale} ageSeconds={ageSeconds} />
    </div>
  );
}

function RateBar({
  label,
  percent,
  resetsAt,
}: {
  label: string;
  percent: number;
  resetsAt: number;
}) {
  const { t } = useTranslation();
  const clamped = Math.min(100, Math.max(0, percent));
  const color =
    clamped >= 90
      ? 'var(--color-error, #C4523B)'
      : clamped >= 75
        ? 'var(--color-warning, #E8A838)'
        : clamped >= 50
          ? 'var(--color-warning-soft, #D4A050)'
          : 'var(--color-primary)';

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowValue}>{clamped.toFixed(1)}%</span>
      </div>
      <div className={styles.track}>
        <div
          className={styles.bar}
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <div className={styles.resetHint}>
        {t('claudeLimits.resetsIn', { time: formatRelative(resetsAt - nowSeconds()) })}
      </div>
    </div>
  );
}

function StaleHint({ stale, ageSeconds }: { stale: boolean; ageSeconds: number }) {
  const { t } = useTranslation();
  if (!stale) return null;
  return (
    <div className={styles.staleHint}>
      {t('claudeLimits.stale', { age: formatAge(ageSeconds) })}
    </div>
  );
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function formatRelative(seconds: number): string {
  if (seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
