import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { Sidebar } from '@/components/Sidebar';
import { MultiPaneArea } from '@/components/layout/MultiPaneArea';
import { FilesViewerPane } from '@/components/files/FilesViewerPane';
import type { FilesApiClient } from '@/components/files/filesApi';
import { ApiClient } from '@/api/client';
import { HttpError } from '@/api/errors';
import { useAuthStore } from '@/stores/auth';
import { useLayoutStore } from '@/stores/layout';
import { usePaneStore } from '@/stores/pane';
import { useSessionsStore, type SessionsApiClient } from '@/stores/sessions';
import { useSessionViewStore } from '@/stores/sessionView';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme';
import { useEventsSubscription } from '@/hooks/useEventsSubscription';
import { useShortcuts } from '@/hooks/useShortcuts';
import { SLOT_COUNT } from '@/lib/paneLayout';

export function AuthenticatedShell() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
    const base = new ApiClient(gatewayUrl, token);
    const wrapped: SessionsApiClient = {
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
      createSession: base.createSession.bind(base),
      renameSession: base.renameSession.bind(base),
      killSession: base.killSession.bind(base),
      createWindow: base.createWindow.bind(base),
      renameWindow: base.renameWindow.bind(base),
      killWindow: base.killWindow.bind(base),
    };
    void useSessionsStore.getState().refetch(wrapped);
  }, [token, gatewayUrl, logout, navigate]);

  const isSessionsRoute = location.pathname.startsWith('/web/sessions');
  useEffect(() => {
    if (isSessionsRoute) {
      usePaneStore.getState().resume();
    } else {
      usePaneStore.getState().suspendForSingle();
    }
  }, [isSessionsRoute]);

  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const openPalette = useLayoutStore((s) => s.openPalette);
  const openLayoutMenu = useLayoutStore((s) => s.openLayoutMenu);

  // Build clients early so helpers below (used by shortcuts) can close over them.
  // These are stable as long as token/gatewayUrl don't change between renders.
  const baseClient = token && gatewayUrl ? new ApiClient(gatewayUrl, token) : null;

  const wrappedClient: SessionsApiClient | null = baseClient
    ? {
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
        createSession: baseClient.createSession.bind(baseClient),
        renameSession: baseClient.renameSession.bind(baseClient),
        killSession: baseClient.killSession.bind(baseClient),
        createWindow: baseClient.createWindow.bind(baseClient),
        renameWindow: baseClient.renameWindow.bind(baseClient),
        killWindow: baseClient.killWindow.bind(baseClient),
      }
    : null;

  const handleAuthError = (err: unknown): boolean => {
    if (err instanceof HttpError && err.status === 401) {
      logout();
      navigate('/web/login', { replace: true });
      return true;
    }
    return false;
  };

  const reportMutationError = (err: unknown): void => {
    if (handleAuthError(err)) return;
    if (err instanceof HttpError && err.status === 404) {
      pushToast({ type: 'error', message: t('sessions.loadFailed', { error: 'not found' }) });
      if (wrappedClient) void useSessionsStore.getState().refetch(wrappedClient);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    pushToast({ type: 'error', message: t('sessions.loadFailed', { error: message }) });
  };

  const handleCreateSession = async (name?: string): Promise<void> => {
    if (!wrappedClient) return;
    try {
      await useSessionsStore.getState().create(wrappedClient, { name });
    } catch (err) {
      reportMutationError(err);
    }
  };

  const handleRenameSession = async (
    currentDisplayName: string,
    newName: string,
  ): Promise<void> => {
    if (!wrappedClient) return;
    try {
      await useSessionsStore.getState().rename(wrappedClient, currentDisplayName, newName);
    } catch (err) {
      reportMutationError(err);
    }
  };

  const handleRequestDeleteSession = (session: TmuxSession): void => {
    showConfirm({
      title: t('sessions.deleteSessionTitle'),
      message: t('sessions.deleteSessionMessage', { name: session.displayName }),
      destructive: true,
      onConfirm: async () => {
        if (!wrappedClient) return;
        try {
          await useSessionsStore.getState().removeSession(wrappedClient, session.displayName);
        } catch (err) {
          reportMutationError(err);
        }
      },
    });
  };

  const handleCreateWindow = async (
    sessionDisplayName: string,
    name?: string,
  ): Promise<void> => {
    if (!wrappedClient) return;
    try {
      await useSessionsStore.getState().createWindow(wrappedClient, sessionDisplayName, { name });
    } catch (err) {
      reportMutationError(err);
    }
  };

  const handleRenameWindow = async (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ): Promise<void> => {
    if (!wrappedClient) return;
    try {
      await useSessionsStore.getState().renameWindow(wrappedClient, sessionDisplayName, windowIndex, newName);
    } catch (err) {
      reportMutationError(err);
    }
  };

  const handleRequestDeleteWindow = (
    sessionDisplayName: string,
    window: TmuxWindow,
  ): void => {
    showConfirm({
      title: t('sessions.deleteWindowTitle'),
      message: t('sessions.deleteWindowMessage', { index: window.index, name: window.name }),
      destructive: true,
      onConfirm: async () => {
        if (!wrappedClient) return;
        try {
          await useSessionsStore.getState().removeWindow(wrappedClient, sessionDisplayName, window.index);
        } catch (err) {
          reportMutationError(err);
        }
      },
    });
  };

  const cyclePane = (dir: 1 | -1) => {
    const { panes, focusedIndex, layout, setFocusedIndex } = usePaneStore.getState();
    const slotCount = SLOT_COUNT[layout];
    const occupied: number[] = [];
    for (let i = 0; i < slotCount; i++) if (panes[i]) occupied.push(i);
    if (occupied.length === 0) return;
    const here = occupied.indexOf(focusedIndex);
    const startPos = here === -1 ? 0 : here;
    const len = occupied.length;
    const nextPos = (startPos + dir + len) % len;
    setFocusedIndex(occupied[nextPos]);
  };
  const focusNextPane = () => cyclePane(1);
  const focusPrevPane = () => cyclePane(-1);

  const jumpToWindow = (n: number) => {
    // n is 1-based ⌘1..⌘9; map to 0-based window index inside focused pane.
    const state = usePaneStore.getState();
    const focused = state.panes[state.focusedIndex];
    if (!focused) return;
    const session = useSessionsStore.getState().sessions.find((s) => s.displayName === focused.sessionId);
    if (!session) return;
    const target = session.windows?.find((w) => w.index === n - 1);
    if (!target) return;
    state.assignPane(state.focusedIndex, { sessionId: focused.sessionId, windowIndex: n - 1 });
  };

  const newWindow = () => {
    const state = usePaneStore.getState();
    const focused = state.panes[state.focusedIndex];
    if (!focused) return;
    const session = useSessionsStore.getState().sessions.find((s) => s.displayName === focused.sessionId);
    if (!session) return;
    void handleCreateWindow(session.displayName);
  };

  const closeWindow = () => {
    const state = usePaneStore.getState();
    const focused = state.panes[state.focusedIndex];
    if (!focused) return;
    const session = useSessionsStore.getState().sessions.find((s) => s.displayName === focused.sessionId);
    if (!session) return;
    const targetWindow = session.windows?.find((w) => w.index === focused.windowIndex);
    if (!targetWindow) return;
    handleRequestDeleteWindow(session.displayName, targetWindow);
  };

  useShortcuts({
    toggleSidebar,
    openPalette,
    openSettings: () => navigate('/web/settings'),
    jumpToWindow,
    newWindow,
    closeWindow,
    focusNextPane,
    focusPrevPane,
    openLayoutMenu,
    openSearch: () => undefined,
  });

  if (!token || !gatewayUrl) return <Navigate to="/web/login" replace />;

  const isFilesRoute = location.pathname.startsWith('/web/files');

  const filesClient: FilesApiClient = {
    listFiles: baseClient!.listFiles.bind(baseClient!),
    getFileContent: baseClient!.getFileContent.bind(baseClient!),
    writeFileContent: baseClient!.writeFileContent.bind(baseClient!),
    deleteFile: baseClient!.deleteFile.bind(baseClient!),
    renameFile: baseClient!.renameFile.bind(baseClient!),
    copyFiles: baseClient!.copyFiles.bind(baseClient!),
    moveFiles: baseClient!.moveFiles.bind(baseClient!),
    createDirectory: baseClient!.createDirectory.bind(baseClient!),
    uploadFile: baseClient!.uploadFile.bind(baseClient!),
    buildRawFileUrl: baseClient!.buildRawFileUrl.bind(baseClient!),
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
        filesClient={filesClient}
      />
      <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex' }}>
        <MultiPaneArea
          gatewayUrl={gatewayUrl}
          token={token}
          isVisible={!isFilesRoute}
        />
        {isFilesRoute && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <FilesViewerPane client={filesClient} token={token} />
          </div>
        )}
      </div>
    </div>
  );
}
