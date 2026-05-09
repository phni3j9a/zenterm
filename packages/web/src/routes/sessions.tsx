import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TerminalPane } from '@/components/TerminalPane';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';
import { useTheme } from '@/theme';

export function SessionsRoute() {
  const { tokens } = useTheme();
  const token = useAuthStore((s) => s.token);
  const gatewayUrl = useAuthStore((s) => s.gatewayUrl);
  const sessions = useSessionsStore((s) => s.sessions);
  const setSessions = useSessionsStore((s) => s.setSessions);
  const setError = useSessionsStore((s) => s.setError);
  const activeSessionId = useSessionViewStore((s) => s.activeSessionId);
  const activeWindowIndex = useSessionViewStore((s) => s.activeWindowIndex);
  const open = useSessionViewStore((s) => s.open);

  useEffect(() => {
    if (!token || !gatewayUrl) return;
    const client = new ApiClient(gatewayUrl, token);
    client.listSessions().then(setSessions).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [token, gatewayUrl, setSessions, setError]);

  if (!token || !gatewayUrl) {
    // Should never happen — RequireAuth guards this. But keep a safety fallback.
    return null;
  }

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
