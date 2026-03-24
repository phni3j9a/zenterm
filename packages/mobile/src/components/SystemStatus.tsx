import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getSystemStatus } from '@/src/api/client';
import { SkeletonLoader } from '@/src/components/ui';
import { useTheme } from '@/src/theme';
import type { Server, SystemStatus as SystemStatusType } from '@/src/types';

interface SystemStatusProps {
  server: Server;
}

const POLL_INTERVAL = 5_000;


export function SystemStatus({ server }: SystemStatusProps) {
  const { colors, dark, radii, spacing, typography } = useTheme();
  const [status, setStatus] = useState<SystemStatusType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: 0,
        },
        metricsRow: {
          flexDirection: 'row',
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.xl,
        },
        metricItem: {
          flex: 1,
          alignItems: 'center',
        },
        metricDivider: {
          width: 1,
          alignSelf: 'stretch',
          marginVertical: spacing.xs,
          backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(42,39,33,0.08)',
        },
        metricValue: {
          fontSize: 16,
          fontWeight: '600',
          fontFamily: 'Menlo',
          color: colors.textPrimary,
          lineHeight: 20,
        },
        metricUnit: {
          fontSize: 10,
          fontWeight: '400',
        },
        metricLabel: {
          fontSize: 8,
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: colors.textMuted,
          marginTop: 3,
        },
        errorText: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
          paddingHorizontal: spacing.lg,
        },
        skeletonRow: {
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
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
        const message = err instanceof Error ? err.message : 'Failed to fetch status';
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


  if (!status && !error) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonTile}>
            <SkeletonLoader height={36} radius={radii.md} width="100%" />
          </View>
          <View style={styles.skeletonTile}>
            <SkeletonLoader height={36} radius={radii.md} width="100%" />
          </View>
          <View style={styles.skeletonTile}>
            <SkeletonLoader height={36} radius={radii.md} width="100%" />
          </View>
        </View>
      </View>
    );
  }

  if (error && !status) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!status) return null;

  return (
    <View style={styles.container}>
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>
            {status.cpu.usage.toFixed(0)}
            <Text style={styles.metricUnit}>%</Text>
          </Text>
          <Text style={styles.metricLabel}>CPU</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>
            {status.memory.percent.toFixed(0)}
            <Text style={styles.metricUnit}>%</Text>
          </Text>
          <Text style={styles.metricLabel}>Memory</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>
            {status.disk.percent.toFixed(0)}
            <Text style={styles.metricUnit}>%</Text>
          </Text>
          <Text style={styles.metricLabel}>Disk</Text>
        </View>
      </View>
    </View>
  );
}
