import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XtermView,
  type ReconnectInfo,
  type TerminalActions,
  type TerminalStatus,
} from './terminal/XtermView';
import { TerminalHeader } from './terminal/TerminalHeader';
import { TerminalContextMenu } from './terminal/TerminalContextMenu';
import { LayoutSelector } from './terminal/LayoutSelector';
import { TerminalSearch, type TerminalSearchApi } from '@/components/terminal/TerminalSearch';
import { TerminalDropZone } from './terminal/TerminalDropZone';
import { useTheme } from '@/theme';
import { EmptyState } from './ui/EmptyState';
import { IconTerminal } from './ui/icons';
import {
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettingsStore,
} from '@/stores/settings';
import { useSessionsStore } from '@/stores/sessions';
import { useUiStore } from '@/stores/ui';
import { useLayoutStore } from '@/stores/layout';

export interface TerminalPaneProps {
  gatewayUrl: string;
  token: string;
  sessionId: string | null;
  windowIndex: number | null;
  paneIndex: number;
  isFocused: boolean;
  isVisible: boolean;
  onSearch?: () => void;
  onNewPane?: () => void;
  canCreateNewPane?: boolean;
  sessionCwd?: string;
  onDropFiles?: (files: File[], cwd: string) => void;
  uploadProgress?: {
    active: boolean;
    total: number;
    completed: number;
    currentFile?: string;
    error?: string;
  };
}

export function TerminalPane({
  gatewayUrl,
  token,
  sessionId,
  windowIndex,
  paneIndex,
  isFocused,
  isVisible,
  onSearch,
  onNewPane,
  canCreateNewPane = false,
  sessionCwd,
  onDropFiles,
  uploadProgress,
}: TerminalPaneProps) {
  // paneIndex is accepted for Tasks 6+ (focus routing, drag/drop) but not used in this component yet.
  void paneIndex;
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<TerminalStatus>('disconnected');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [reconnectInfo, setReconnectInfo] = useState<ReconnectInfo | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);
  const actionsRef = useRef<TerminalActions | null>(null);

  const [searchApi, setSearchApi] = useState<TerminalSearchApi | null>(null);
  const searchOpen = useLayoutStore((s) => s.searchOpen);
  const closeSearch = useLayoutStore((s) => s.closeSearch);

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
        <EmptyState
          icon={<IconTerminal size={32} />}
          title={t('shell.empty.title')}
          description={t('shell.empty.description')}
        />
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
        layoutSlot={isFocused ? <LayoutSelector /> : null}
      />
      <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {searchOpen && isFocused && searchApi && (
          <TerminalSearch open api={searchApi} onClose={closeSearch} />
        )}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <XtermView
            gatewayUrl={gatewayUrl}
            token={token}
            sessionId={sessionId}
            windowIndex={windowIndex}
            isFocused={isFocused && isVisible}
            isVisible={isVisible}
            reconnectNonce={reconnectNonce}
            onStatusChange={setStatus}
            onReconnectInfo={setReconnectInfo}
            onContextMenu={(info) => setMenu(info)}
            onActionsReady={(a) => { actionsRef.current = a; }}
            onSearchReady={setSearchApi}
          />
          {isFocused && sessionCwd && onDropFiles && (
            <TerminalDropZone cwd={sessionCwd} onFiles={onDropFiles} />
          )}
          {isFocused && uploadProgress?.active && (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: tokens.spacing.sm,
                background: tokens.colors.surface,
                color: tokens.colors.textPrimary,
                zIndex: 60,
                fontSize: tokens.typography.smallMedium.fontSize,
              }}
            >
              {uploadProgress.error
                ? t('terminal.uploadError', { message: uploadProgress.error })
                : uploadProgress.completed < uploadProgress.total
                  ? t('terminal.uploadProgress', {
                      current: uploadProgress.currentFile ?? '',
                      completed: uploadProgress.completed,
                      total: uploadProgress.total,
                    })
                  : t('terminal.uploadDone', { count: uploadProgress.total })}
            </div>
          )}
        </div>
      </div>
      {menu && (
        <TerminalContextMenu
          open
          x={menu.x}
          y={menu.y}
          hasSelection={menu.hasSelection}
          onCopy={() => actionsRef.current?.copy()}
          onPaste={() => actionsRef.current?.paste()}
          onClear={() => actionsRef.current?.clear()}
          onReconnect={handleReconnect}
          onSearch={() => onSearch?.()}
          onNewPane={() => onNewPane?.()}
          canCreateNewPane={canCreateNewPane && typeof onNewPane === 'function'}
          onClose={() => setMenu(null)}
        />
      )}
    </section>
  );
}
