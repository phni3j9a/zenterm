import { useEffect, useRef, useState, useCallback } from 'react';
import { getSystemStatus } from '../api/client';
import type { SystemStatus } from '@zenterm/shared';

const POLL_INTERVAL = 5_000;
const MAX_SAMPLES = 60; // 5 minutes at 5s intervals

export interface MetricsHistory {
  cpuUsage: number[];
  memPercent: number[];
  timestamps: number[];
}

export interface UseSystemMetricsResult {
  current: SystemStatus | null;
  history: MetricsHistory;
  error: boolean;
}

export function useSystemMetrics(enabled: boolean): UseSystemMetricsResult {
  const [current, setCurrent] = useState<SystemStatus | null>(null);
  const [error, setError] = useState(false);
  const historyRef = useRef<MetricsHistory>({
    cpuUsage: [],
    memPercent: [],
    timestamps: [],
  });
  const [, forceUpdate] = useState(0);

  const pushSample = useCallback((status: SystemStatus) => {
    const h = historyRef.current;
    h.cpuUsage.push(status.cpu.usage);
    h.memPercent.push(status.memory.percent);
    h.timestamps.push(Date.now());
    if (h.cpuUsage.length > MAX_SAMPLES) {
      h.cpuUsage.shift();
      h.memPercent.shift();
      h.timestamps.shift();
    }
    forceUpdate((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;
    let paused = false;

    const fetchMetrics = () => {
      if (paused) return;
      getSystemStatus({ signal: controller.signal })
        .then((status) => {
          setCurrent(status);
          setError(false);
          pushSample(status);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setError(true);
        });
    };

    const handleVisibility = () => {
      if (document.hidden) {
        paused = true;
      } else {
        paused = false;
        fetchMetrics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    fetchMetrics();
    timer = setInterval(fetchMetrics, POLL_INTERVAL);

    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, pushSample]);

  return { current, history: historyRef.current, error };
}
