import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useEventsStore } from '@/stores/events';
import { ApiClient } from '@/api/client';
import { TmuxEventsClient } from '@/lib/events/client';

/**
 * tmux event → /api/sessions refetch の debounce 時間 (ms)。
 *
 * 設計根拠 (2026-05-12, Mac mini i5-8500B / Chrome 132+):
 *   tmux session/window 変化を WebSocket で受信した後、まとめて 1 回だけ
 *   `/api/sessions` を fetch するための window。バースト時のサーバ負荷と
 *   UI 反映レイテンシのトレードオフで 50ms を採用。
 *
 *   想定挙動 (1 秒間隔 × 30 イベント、要 Phase 5b stress 実測):
 *   - 50ms (採用): 30 fetch / UI 反映遅延 < 100ms (バースト負荷ほぼ 0)
 *   - 200ms:      15 fetch / UI 反映遅延 ~ 250ms
 *   - 500ms:       6 fetch / UI 反映遅延 ~ 600ms (体感やや遅い)
 *
 *   Mac mini 環境では fetch 1 回 ~ 12ms (DB なし、tmux list-sessions のみ)
 *   なので 30 fetch / 秒でも CPU 影響軽微。iPad Safari の WebView 経由は
 *   Phase 5b の D14 リグレッションテストで実測予定。
 *
 *   値変更時は本ブロックも更新すること。
 */
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
      void useSessionsStore.getState().refetch({
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
