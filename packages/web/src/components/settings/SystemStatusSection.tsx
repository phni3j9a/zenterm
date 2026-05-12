import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SystemStatus } from '@zenterm/shared';
import { useTheme } from '@/theme';

const POLL_INTERVAL = 5000;

export interface SystemStatusClient {
  getSystemStatus(): Promise<SystemStatus>;
}

interface Props {
  client: SystemStatusClient | null;
  onGatewayVersion: (version: string) => void;
  headingId?: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(b: number): string {
  const gb = b / 1e9;
  return `${gb.toFixed(1)} GB`;
}

export function SystemStatusSection({ client, onGatewayVersion, headingId }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const status = await client.getSystemStatus();
        if (cancelled) return;
        setData(status);
        setError(null);
        onGatewayVersion(status.gatewayVersion);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    void fetchOnce();
    const id = setInterval(() => void fetchOnce(), POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, onGatewayVersion]);

  const memPctClamped = data ? Math.max(0, Math.min(100, data.memory.percent)) : 0;

  return (
    <section>
      <h3
        id={headingId}
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: tokens.typography.caption.fontSize,
          color: tokens.colors.textMuted,
          margin: `0 0 ${tokens.spacing.sm}px 0`,
        }}
      >
        {t('settings.systemStatus.title', 'System status')}
      </h3>

      {data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: tokens.spacing.md }}>
          {/* Uptime */}
          <div>
            <div style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize, marginBottom: tokens.spacing.xs }}>
              {t('settings.systemStatus.uptime', 'Uptime')}
            </div>
            <div style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize, fontVariantNumeric: 'tabular-nums' }}>
              {formatUptime(data.uptime)}
            </div>
          </div>

          {/* Load avg */}
          <div>
            <div style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize, marginBottom: tokens.spacing.xs }}>
              {t('settings.systemStatus.loadAvg', 'Load avg')}
            </div>
            <div style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize, fontVariantNumeric: 'tabular-nums' }}>
              {data.cpu.loadAvg.map((n) => n.toFixed(2)).join(' / ')}
            </div>
          </div>

          {/* Memory */}
          <div>
            <div style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize, marginBottom: tokens.spacing.xs }}>
              {t('settings.systemStatus.memory', 'Memory')}
            </div>
            <div style={{ color: tokens.colors.textPrimary, fontSize: tokens.typography.smallMedium.fontSize, fontVariantNumeric: 'tabular-nums' }}>
              {`${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)} (${data.memory.percent}%)`}
            </div>
            <div style={{
              height: 4,
              borderRadius: 2,
              background: tokens.colors.surface,
              marginTop: tokens.spacing.xs,
            }}>
              <div style={{
                width: `${memPctClamped}%`,
                height: '100%',
                background: tokens.colors.primary,
                borderRadius: 2,
              }} />
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: tokens.colors.error, fontSize: tokens.typography.caption.fontSize, marginTop: tokens.spacing.sm }}>
          {t('settings.systemStatus.unavailable', 'Status unavailable')}
        </p>
      ) : null}
      {!data && !error ? (
        <p style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.caption.fontSize }}>
          {t('common.loading', 'Loading…')}
        </p>
      ) : null}
    </section>
  );
}
