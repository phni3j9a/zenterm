import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TerminalPane } from '@/components/TerminalPane';
import { ApiClient } from '@/api/client';
import { HttpError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';
import { useTheme } from '@/theme';
import { useEventsSubscription } from '@/hooks/useEventsSubscription';

export function SessionsRoute() {
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const logout = useAuthStore((s) => s.logout);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionViewStore((s) => s.activeSessionId);
  const activeWindowIndex = useSessionViewStore((s) => s.activeWindowIndex);
  const open = useSessionViewStore((s) => s.open);

  useEventsSubscription();

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    const base = new ApiClient(gatewayUrl, token);
    const client = {
      listSessions: async () => {
        try {
          return await base.listSessions();
        } catch (err) {
          if (err instanceof HttpError && err.status === 401) {
            logout();
            navigate('/web/login', { replace: true });
          }
          throw err;
        }
      },
    };
    void useSessionsStore.getState().refetch(client);
  }, [token, gatewayUrl, logout, navigate]);

  if (!token || !gatewayUrl) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', background: tokens.colors.bg }}>
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        activeWindowIndex={activeWindowIndex}
        onSelect={(sessionId, windowIndex) => open(sessionId, windowIndex ?? 0)}
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
