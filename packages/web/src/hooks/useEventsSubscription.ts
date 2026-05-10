import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useEventsStore } from '@/stores/events';
import { ApiClient } from '@/api/client';
import { TmuxEventsClient } from '@/lib/events/client';

const REFETCH_DEBOUNCE_MS = 50;

function buildEventsUrl(gatewayUrl: string, token: string): string {
  const wsUrl = gatewayUrl.replace(/^http/, 'ws');
  const params = new URLSearchParams({ token });
  return `${wsUrl}/ws/events?${params.toString()}`;
}

export function useEventsSubscription(): void {
  const token = useAuthStore((s) => s.token);
  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    isUnmountedRef.current = false;

    const refetch = (): void => {
      void (useSessionsStore.getState() as { refetch: (c: { listSessions: () => Promise<unknown[]> }) => Promise<void> }).refetch({
        listSessions: () => new ApiClient(gatewayUrl, token).listSessions(),
      });
    };

    let pending = false;
    let timer: number | null = null;
    const triggerRefetch = (): void => {
      if (pending) return;
      pending = true;
      timer = window.setTimeout(() => {
        pending = false;
        timer = null;
        if (isUnmountedRef.current) return;
        refetch();
      }, REFETCH_DEBOUNCE_MS);
    };

    const client = new TmuxEventsClient({
      url: buildEventsUrl(gatewayUrl, token),
      onEvent: (event) => {
        if (isUnmountedRef.current) return;
        useEventsStore.getState().setLastEvent(event);
        if (
          event.type === 'sessions-changed' ||
          event.type === 'windows-changed' ||
          event.type === 'monitor-restart'
        ) {
          triggerRefetch();
        }
      },
      onStatusChange: (status, attempt) => {
        if (isUnmountedRef.current) return;
        useEventsStore.getState().setStatus(status);
        useEventsStore.getState().setReconnectAttempt(attempt);
      },
    });
    client.start();

    return () => {
      isUnmountedRef.current = true;
      if (timer !== null) window.clearTimeout(timer);
      client.stop();
    };
  }, [token, gatewayUrl]);
}
