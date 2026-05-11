import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XtermView,
  type ReconnectInfo,
  type TerminalStatus,
} from './terminal/XtermView';
import { TerminalHeader } from './terminal/TerminalHeader';
import { useTheme } from '@/theme';
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettingsStore,
} from '@/stores/settings';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';

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

  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const pushToast = useUiStore((s) => s.pushToast);

  const session = useSessionsStore((s) =>
    sessionId && Array.isArray(s.sessions)
      ? s.sessions.find((sess) => sess.displayName === sessionId)
      : undefined,
  );
  const displayName = session?.displayName ?? '';
  const windowName =
    windowIndex !== null
      ? session?.windows?.find((w) => w.index === windowIndex)?.name ?? ''
      : '';

  const handleReconnect = (): void => {
    setReconnectNonce((n) => n + 1);
  };

  const handleCopySessionId = async (): Promise<void> => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      pushToast({ type: 'success', message: t('terminal.copySessionIdSuccess') });
    } catch {
      pushToast({ type: 'error', message: t('terminal.copyFailed') });
    }
  };

  const handleZoomIn = (): void => {
    if (fontSize < MAX_FONT_SIZE) setFontSize(fontSize + 1);
  };
  const handleZoomOut = (): void => {
    if (fontSize > MIN_FONT_SIZE) setFontSize(fontSize - 1);
  };
  const handleZoomReset = (): void => {
    setFontSize(DEFAULT_FONT_SIZE);
  };

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
      <TerminalHeader
        sessionId={sessionId}
        windowIndex={windowIndex}
        displayName={displayName}
        windowName={windowName}
        status={status}
        reconnectInfo={reconnectInfo}
        fontSize={fontSize}
        onReconnect={handleReconnect}
        onCopySessionId={handleCopySessionId}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />
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
