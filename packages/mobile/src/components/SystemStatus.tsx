import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getSystemStatus } from '@/src/api/client';
import { Card, SkeletonLoader } from '@/src/components/ui';
import { useTheme } from '@/src/theme';
import type { Server, SystemStatus as SystemStatusType } from '@/src/types';

interface SystemStatusProps {
  server: Server;
}

const POLL_INTERVAL = 5_000;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
};

export function SystemStatus({ server }: SystemStatusProps) {
  const { colors, dark, radii, spacing, typography } = useTheme();
  const [status, setStatus] = useState<SystemStatusType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        headerLabel: {
          ...typography.captionMedium,
          color: colors.textPrimary,
        },
        metricsRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        tile: {
          flex: 1,
          padding: spacing.md,
          borderRadius: radii.md,
          backgroundColor: dark ? colors.surfaceHover : colors.primarySubtle,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          gap: spacing.xs,
        },
        tileLabel: {
          ...typography.smallMedium,
          color: colors.textMuted,
        },
        progressBg: {
          height: 4,
          borderRadius: radii.full,
          backgroundColor: colors.border,
        },
        progressFill: {
          height: 4,
          borderRadius: radii.full,
        },
        tileValue: {
          ...typography.bodyMedium,
          color: colors.textPrimary,
        },
        tileDetail: {
          ...typography.small,
          color: colors.textSecondary,
        },
        footerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        footerText: {
          ...typography.small,
          color: colors.textSecondary,
        },
        errorText: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
        },
        skeletonRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        skeletonTile: {
          flex: 1,
        },
      }),
    [colors, dark, radii, spacing, typography],
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await getSystemStatus(server, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setStatus(data);
          setError(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'ステータス取得失敗';
        setError(message);
      }
    };

    void fetchStatus();
    interval = setInterval(() => void fetchStatus(), POLL_INTERVAL);

    return () => {
      if (interval) clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [server]);

  const getProgressColor = (percent: number): string => {
    if (percent >= 90) return colors.error;
    if (percent >= 70) return colors.warning;
    return colors.success;
  };

  const getTemperatureColor = (temp: number | null): string => {
    if (temp === null) return colors.textSecondary;
    if (temp > 75) return colors.error;
    if (temp >= 60) return colors.warning;
    return colors.textSecondary;
  };

  if (!status && !error) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>System Status</Text>
        </View>
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonTile}>
            <SkeletonLoader height={80} radius={radii.md} width="100%" />
          </View>
          <View style={styles.skeletonTile}>
            <SkeletonLoader height={80} radius={radii.md} width="100%" />
          </View>
          <View style={styles.skeletonTile}>
            <SkeletonLoader height={80} radius={radii.md} width="100%" />
          </View>
        </View>
      </Card>
    );
  }

  if (error && !status) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>System Status</Text>
        </View>
        <Text style={styles.errorText}>{error}</Text>
      </Card>
    );
  }

  if (!status) return null;

  const memTotalGB = status.memory.total / (1024 * 1024 * 1024);
  const memUsedGB = status.memory.used / (1024 * 1024 * 1024);
  const diskTotalGB = status.disk.total / (1024 * 1024 * 1024);
  const diskUsedGB = status.disk.used / (1024 * 1024 * 1024);

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>System Status</Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>CPU</Text>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(status.cpu.usage, 100)}%`,
                  backgroundColor: getProgressColor(status.cpu.usage),
                },
              ]}
            />
          </View>
          <Text style={styles.tileValue}>{status.cpu.usage.toFixed(0)}%</Text>
          <Text style={styles.tileDetail}>{status.cpu.cores} cores</Text>
        </View>

        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Memory</Text>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(status.memory.percent, 100)}%`,
                  backgroundColor: getProgressColor(status.memory.percent),
                },
              ]}
            />
          </View>
          <Text style={styles.tileValue}>{status.memory.percent.toFixed(0)}%</Text>
          <Text style={styles.tileDetail}>
            {memUsedGB.toFixed(1)}/{memTotalGB.toFixed(1)} GB
          </Text>
        </View>

        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Disk</Text>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(status.disk.percent, 100)}%`,
                  backgroundColor: getProgressColor(status.disk.percent),
                },
              ]}
            />
          </View>
          <Text style={styles.tileValue}>{status.disk.percent.toFixed(0)}%</Text>
          <Text style={styles.tileDetail}>
            {formatBytes(status.disk.used)}/{formatBytes(status.disk.total)}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text
          style={[
            styles.footerText,
            { color: getTemperatureColor(status.temperature) },
          ]}
        >
          {status.temperature !== null ? `${status.temperature.toFixed(0)}\u00B0C` : '--'}
        </Text>
        <Text style={styles.footerText}>Uptime {formatUptime(status.uptime)}</Text>
      </View>
    </Card>
  );
}
