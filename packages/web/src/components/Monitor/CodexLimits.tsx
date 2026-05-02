import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CodexAccountStatus, CodexLimitsResponse } from '@zenterm/shared';
import { getCodexLimits } from '../../api/client';
import styles from './ClaudeLimits.module.css';

const DOCS_URL =
  'https://github.com/phni3j9a/zenterm/blob/main/docs/codex-rate-limits.md';

export function CodexLimits() {
  const { t } = useTranslation();
  const [data, setData] = useState<CodexLimitsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      setData(await getCodexLimits());
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
          <h3 className={styles.title}>{t('codexLimits.title')}</h3>
          <span className={styles.experimentalBadge}>{t('codexLimits.experimental')}</span>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void refresh()}
          disabled={loading}
          aria-label={t('codexLimits.refresh')}
        >
          {loading ? '…' : '↻'}
        </button>
      </header>
      <Body data={data} fetchError={fetchError} />
    </section>
  );
}

interface BodyProps {
  data: CodexLimitsResponse | null;
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
        <p className={styles.noticeText}>{t('codexLimits.unconfigured')}</p>
        <p className={styles.noticeHint}>{t('codexLimits.unconfiguredHint')}</p>
        <a
          className={styles.noticeLink}
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('codexLimits.openDocs')}
        </a>
      </div>
    );
  }

  return (
    <div className={styles.accounts}>
      {data.accounts.map((account, i) => (
        <AccountBody key={`${account.label}-${i}`} account={account} />
      ))}
    </div>
  );
}

function AccountBody({ account }: { account: CodexAccountStatus }) {
  const { t } = useTranslation();

  if (account.state === 'unavailable') {
    return (
      <div className={styles.error}>
        <div>{t('codexLimits.unavailable')}</div>
        <div className={styles.errorDetail}>{account.message}</div>
      </div>
    );
  }

  if (account.state === 'pending') {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeText}>{t('codexLimits.pending')}</p>
        <p className={styles.noticeHint}>{account.message}</p>
      </div>
    );
  }

  const { fiveHour, sevenDay, ageSeconds, stale, planType } = account;
  return (
    <div className={styles.body} data-stale={stale}>
      {planType ? (
        <div className={styles.resetHint}>
          {t('codexLimits.plan', { plan: planType })}
        </div>
      ) : null}
      {fiveHour && (
        <RateBar
          label={t('codexLimits.fiveHour')}
          percent={fiveHour.usedPercentage}
          resetsAt={fiveHour.resetsAt}
        />
      )}
      {sevenDay && (
        <RateBar
          label={t('codexLimits.sevenDay')}
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
        {t('codexLimits.resetsIn', { time: formatRelative(resetsAt - nowSeconds()) })}
      </div>
    </div>
  );
}

function StaleHint({ stale, ageSeconds }: { stale: boolean; ageSeconds: number }) {
  const { t } = useTranslation();
  if (!stale) return null;
  return (
    <div className={styles.staleHint}>
      {t('codexLimits.stale', { age: formatAge(ageSeconds) })}
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
