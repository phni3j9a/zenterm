import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XtermView,
  type ReconnectInfo,
  type TerminalStatus,
} from './terminal/XtermView';
import { useTheme } from '@/theme';

export interface TerminalPaneProps {
  gatewayUrl: string;
  token: string;
  sessionId: string | null;
  windowIndex: number | null;
  isVisible: boolean;
}

export function TerminalPane({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  isVisible,
}: TerminalPaneProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<TerminalStatus>('disconnected');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [reconnectInfo, setReconnectInfo] = useState<ReconnectInfo | null>(null);

  const handleReconnect = (): void => {
    setReconnectNonce((n) => n + 1);
  };

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
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {t('terminal.selectPrompt')}
      </main>
    );
  }

  return (
    <section
      data-terminal-root="true"
      style={{
        flex: 1,
        display: isVisible ? 'grid' : 'none',
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
        {(status === 'disconnected' || status === 'reconnecting' || status === 'error') && (
          <button
            type="button"
            aria-label={t('terminal.reconnect')}
            onClick={handleReconnect}
            style={{
              background: tokens.colors.surface,
              color: tokens.colors.textPrimary,
              border: `1px solid ${tokens.colors.border}`,
              padding: `4px 10px`,
              borderRadius: tokens.radii.sm,
              fontSize: tokens.typography.caption.fontSize,
              cursor: 'pointer',
              marginRight: tokens.spacing.sm,
            }}
          >
            ↺ {t('terminal.reconnect')}
          </button>
        )}
        {status === 'reconnecting' && reconnectInfo && !reconnectInfo.exhausted && (
          <span
            data-testid="terminal-reconnect-eta"
            style={{
              color: tokens.colors.textMuted,
              fontSize: tokens.typography.caption.fontSize,
              marginRight: tokens.spacing.sm,
            }}
          >
            {t('terminal.reconnectingEta', {
              seconds: Math.max(1, Math.ceil(reconnectInfo.etaMs / 1000)),
              attempt: reconnectInfo.attempt,
            })}
          </span>
        )}
        <span
          aria-label={`Connection ${t(`terminal.status.${status}` as 'terminal.status.connected')}`}
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
          isFocused={isVisible}
          isVisible={isVisible}
          reconnectNonce={reconnectNonce}
          onStatusChange={setStatus}
          onReconnectInfo={setReconnectInfo}
        />
      </div>
    </section>
  );
}
