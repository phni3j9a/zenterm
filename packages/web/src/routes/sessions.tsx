import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { Sidebar } from '@/components/Sidebar';
import { TerminalPane } from '@/components/TerminalPane';
import { ApiClient } from '@/api/client';
import { HttpError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme';
import { useEventsSubscription } from '@/hooks/useEventsSubscription';

export function SessionsRoute() {
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const logout = useAuthStore((s) => s.logout);
  const sessions = useSessionsStore((s) => s.sessions);
  const loading = useSessionsStore((s) => s.loading);
  const error = useSessionsStore((s) => s.error);
  const activeSessionId = useSessionViewStore((s) => s.activeSessionId);
  const activeWindowIndex = useSessionViewStore((s) => s.activeWindowIndex);
  const open = useSessionViewStore((s) => s.open);
  const showConfirm = useUiStore((s) => s.showConfirm);
  const pushToast = useUiStore((s) => s.pushToast);

  useEventsSubscription();

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    const baseClient = new ApiClient(gatewayUrl, token);
    const wrappedClient = {
      listSessions: async () => {
        try {
          return await baseClient.listSessions();
        } catch (err) {
          if (err instanceof HttpError && err.status === 401) {
            logout();
            navigate('/web/login', { replace: true });
          }
          throw err;
        }
      },
    };
    void useSessionsStore.getState().refetch(wrappedClient);
  }, [token, gatewayUrl, logout, navigate]);

  if (!token || !gatewayUrl) return null;

  const client = new ApiClient(gatewayUrl, token);

  const handleAuthError = (err: unknown): boolean => {
    if (err instanceof HttpError && err.status === 401) {
      logout();
      navigate('/web/login', { replace: true });
      return true;
    }
    return false;
  };

  const reportMutationError = (err: unknown, action: string): void => {
    if (handleAuthError(err)) return;
    if (err instanceof HttpError && err.status === 404) {
      pushToast({ type: 'error', message: '対象が見つかりません。一覧を更新します' });
      void useSessionsStore.getState().refetch(client);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: `${action}に失敗: ${message}` });
  };

  const handleCreateSession = async (name?: string): Promise<void> => {
    try {
      await useSessionsStore.getState().create(client, { name });
    } catch (err) {
      reportMutationError(err, 'セッション作成');
    }
  };

  const handleRenameSession = async (
    currentDisplayName: string,
    newName: string,
  ): Promise<void> => {
    try {
      await useSessionsStore.getState().rename(client, currentDisplayName, newName);
    } catch (err) {
      reportMutationError(err, 'セッション名変更');
    }
  };

  const handleRequestDeleteSession = (session: TmuxSession): void => {
    const windowCount = session.windows?.length ?? 0;
    const message =
      windowCount > 0
        ? `${session.displayName} を削除しますか? (window ${windowCount} 個も削除されます)`
        : `${session.displayName} を削除しますか?`;
    showConfirm({
      title: 'セッションを削除',
      message,
      destructive: true,
      onConfirm: async () => {
        try {
          await useSessionsStore.getState().removeSession(client, session.displayName);
        } catch (err) {
          reportMutationError(err, 'セッション削除');
        }
      },
    });
  };

  const handleCreateWindow = async (
    sessionDisplayName: string,
    name?: string,
  ): Promise<void> => {
    try {
      await useSessionsStore.getState().createWindow(client, sessionDisplayName, { name });
    } catch (err) {
      reportMutationError(err, 'window 作成');
    }
  };

  const handleRenameWindow = async (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ): Promise<void> => {
    try {
      await useSessionsStore.getState().renameWindow(client, sessionDisplayName, windowIndex, newName);
    } catch (err) {
      reportMutationError(err, 'window 名変更');
    }
  };

  const handleRequestDeleteWindow = (
    sessionDisplayName: string,
    window: TmuxWindow,
  ): void => {
    showConfirm({
      title: 'window を削除',
      message: `${window.name} を削除しますか?`,
      destructive: true,
      onConfirm: async () => {
        try {
          await useSessionsStore.getState().removeWindow(client, sessionDisplayName, window.index);
        } catch (err) {
          reportMutationError(err, 'window 削除');
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: tokens.colors.bg }}>
      <Sidebar
        sessions={sessions}
        loading={loading}
        error={error}
        activeSessionId={activeSessionId}
        activeWindowIndex={activeWindowIndex}
        onSelect={(sessionId, windowIndex) => open(sessionId, windowIndex ?? 0)}
        onCreateSession={handleCreateSession}
        onRenameSession={handleRenameSession}
        onRequestDeleteSession={handleRequestDeleteSession}
        onCreateWindow={handleCreateWindow}
        onRenameWindow={handleRenameWindow}
        onRequestDeleteWindow={handleRequestDeleteWindow}
      />
      <TerminalPane
        gatewayUrl={gatewayUrl}
        token={token}
        sessionId={activeSessionId}
        windowIndex={activeWindowIndex}
      />
    </div>
  );
}
