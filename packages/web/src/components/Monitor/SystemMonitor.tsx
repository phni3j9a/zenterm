import { useSystemMetrics } from '../../hooks/useSystemMetrics';
import type { MetricsHistory } from '../../hooks/useSystemMetrics';
import styles from './SystemMonitor.module.css';

interface Props {
  visible: boolean;
}

export function SystemMonitor({ visible }: Props) {
  const { current, history, error } = useSystemMetrics(visible);

  if (!visible) return null;

  if (error && !current) {
    return (
      <div className={styles.monitor}>
        <div className={styles.error}>Unable to fetch system metrics</div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={styles.monitor}>
        <div className={styles.loading}>Loading metrics…</div>
      </div>
    );
  }

  return (
    <div className={styles.monitor}>
      {/* CPU */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>CPU</h3>
        <Sparkline data={history.cpuUsage} color="var(--color-primary)" />
        <ProgressRow label="Usage" value={current.cpu.usage} unit="%" />
        <div className={styles.detail}>{current.cpu.model}</div>
        <div className={styles.detail}>
          {current.cpu.cores} cores &middot; Load{' '}
          {current.cpu.loadAvg.map((v) => v.toFixed(2)).join(' / ')}
        </div>
      </section>

      {/* Memory */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Memory</h3>
        <Sparkline data={history.memPercent} color="var(--color-warning, #E8A838)" />
        <ProgressRow label="Used" value={current.memory.percent} unit="%" />
        <div className={styles.detail}>
          {formatBytes(current.memory.used)} / {formatBytes(current.memory.total)}
        </div>
      </section>

      {/* Disk */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Disk</h3>
        <ProgressRow label="Used" value={current.disk.percent} unit="%" />
        <div className={styles.detail}>
          {formatBytes(current.disk.used)} / {formatBytes(current.disk.total)}
        </div>
      </section>

      {/* Temperature & Uptime */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>System</h3>
        {current.temperature !== null && (
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Temperature</span>
            <span className={styles.statValue}>{current.temperature.toFixed(1)}°C</span>
          </div>
        )}
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Uptime</span>
          <span className={styles.statValue}>{formatUptime(current.uptime)}</span>
        </div>
      </section>
    </div>
  );
}

/* --- Sub-components --- */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const w = 220;
  const h = 40;
  const max = 100;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(' ');

  const fillPoints = `0,${h} ${points} ${(data.length - 1) * step},${h}`;

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={fillPoints} fill={color} opacity="0.12" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function ProgressRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const barColor =
    pct >= 90 ? 'var(--color-error, #C4523B)' :
    pct >= 70 ? 'var(--color-warning, #E8A838)' :
    'var(--color-primary)';

  return (
    <div className={styles.progressRow}>
      <div className={styles.progressHeader}>
        <span className={styles.progressLabel}>{label}</span>
        <span className={styles.progressValue}>{value.toFixed(1)}{unit}</span>
      </div>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressBar}
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

/* --- Utilities --- */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
