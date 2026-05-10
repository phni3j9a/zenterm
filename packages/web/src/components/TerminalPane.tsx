import { useState } from 'react';
import { XtermView, type TerminalStatus } from './terminal/XtermView';
import { useTheme } from '@/theme';

export interface TerminalPaneProps {
  gatewayUrl: string;
  token: string;
  sessionId: string | null;
  windowIndex: number | null;
}

export function TerminalPane({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
}: TerminalPaneProps) {
  const { tokens, mode } = useTheme();
  const [status, setStatus] = useState<TerminalStatus>('disconnected');

  const statusColor: string = (() => {
    switch (status) {
      case 'connected':
        return tokens.colors.success;
      case 'reconnecting':
        return tokens.colors.warning;
      case 'error':
        return tokens.colors.error;
      default:
        return tokens.colors.textMuted;
    }
  })();

  if (sessionId === null || windowIndex === null) {
    return (
      <main
        style={{
          flex: 1,
          background: tokens.colors.bg,
          color: tokens.colors.textSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Select a session from the sidebar to start.
      </main>
    );
  }

  const themeMode = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : mode;

  return (
    <section
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateRows: '48px 1fr',
        height: '100vh',
        background: tokens.colors.bg,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          padding: `0 ${tokens.spacing.lg}px`,
          borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
          background: tokens.colors.bgElevated,
          color: tokens.colors.textPrimary,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: tokens.typography.bodyMedium.fontSize }}>
          {sessionId}
        </span>
        <span style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.smallMedium.fontSize }}>
          · w{windowIndex}
        </span>
        <span style={{ flex: 1 }} />
        <span
          aria-label={`Connection ${status}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
          }}
        />
      </header>
      <div style={{ minHeight: 0 }}>
        <XtermView
          gatewayUrl={gatewayUrl}
          token={token}
          sessionId={sessionId}
          windowIndex={windowIndex}
          isFocused
          theme={themeMode}
          fontSize={14}
          onStatusChange={setStatus}
        />
      </div>
    </section>
  );
}
