import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { TmuxSession, TmuxWindow } from '@zenterm/shared';
import { Sidebar } from '@/components/Sidebar';
import { LeftRail } from '@/components/LeftRail';
import type { ShellTab } from '@/components/LeftRail';
import { MultiPaneArea } from '@/components/layout/MultiPaneArea';
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
import { useRateLimitsWarning } from '@/hooks/useRateLimitsWarning';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useUploadProgress } from '@/hooks/useUploadProgress';
import { SLOT_COUNT, paneNeighbor, upgradeLayout, type PaneDirection } from '@/lib/paneLayout';
import { decode as decodeFragment, encode as encodeFragment } from '@/lib/paneStateFragment';
import { parseSessionRoute } from '@/lib/urlSync';
import { CommandPalette } from './CommandPalette';

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
  const currentLayout = usePaneStore((s) => s.layout);

  // react-router-dom v7 useNavigateUnstable returns a new function reference
  // whenever location changes. Storing in a ref prevents effects that close over
  // navigate from re-running (and e.g. re-fetching) on every navigation.
  const navigateFnRef = useRef(navigate);
  navigateFnRef.current = navigate;

  useEventsSubscription();
  const rateLimitsWarning = useRateLimitsWarning();

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
            navigateFnRef.current('/web/login', { replace: true });
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
  }, [token, gatewayUrl, logout]);

  const lastSyncedHash = useRef<string | null>(null);

  // Legacy URL migration: absorb /web/sessions/:id/window/:idx exactly once on
  // mount, hydrate the focused pane with terminal kind, and rewrite the path to
  // /web/sessions (preserving any hash fragment). Subsequent navigations do not
  // re-run this — pane state is the source of truth and the path stays static.
  const didLegacyMigrationRef = useRef(false);
  useEffect(() => {
    if (didLegacyMigrationRef.current) return;
    didLegacyMigrationRef.current = true;
    const parsed = parseSessionRoute(location.pathname);
    if (!parsed) return;
    usePaneStore.getState().openInFocusedPane({
      kind: 'terminal',
      sessionId: parsed.sessionId,
      windowIndex: parsed.windowIndex,
    });
    navigateFnRef.current('/web/sessions' + location.hash, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hash → store sync: applies pane fragment from URL hash on mount / hash change.
  useEffect(() => {
    if (lastSyncedHash.current === location.hash) return;
    lastSyncedHash.current = location.hash;
    if (!location.hash) return;
    const parsed = decodeFragment(location.hash);
    if (!parsed) return;
    const store = usePaneStore.getState();
    if (store.layout !== parsed.layout) store.setLayout(parsed.layout);
    for (let i = 0; i < parsed.panes.length; i++) {
      store.assignPane(i, parsed.panes[i]);
    }
  }, [location.hash]);

  // Store → URL sync: write pane state into URL hash. Path is left untouched
  // so tab switching (sessions / files / settings) is purely a router concern.
  const layout = usePaneStore((s) => s.layout);
  const allPanes = usePaneStore((s) => s.panes);
  useEffect(() => {
    const isSinglePaneState =
      layout === 'single' && allPanes.length === 1 && allPanes[0] !== null;
    const desiredHash = isSinglePaneState
      ? ''
      : `#${encodeFragment({ layout, panes: allPanes })}`;
    const desired = location.pathname + desiredHash;
    const current = location.pathname + location.hash;
    if (current === desired) return;
    lastSyncedHash.current = desiredHash;
    navigateFnRef.current(desired, { replace: true });
  }, [layout, allPanes, location.pathname, location.hash]);

  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const openPalette = useLayoutStore((s) => s.openPalette);
  const openLayoutMenu = useLayoutStore((s) => s.openLayoutMenu);
  const openSearch = useLayoutStore((s) => s.openSearch);

  // Build clients early so helpers below (used by shortcuts) can close over them.
  // These are stable as long as token/gatewayUrl don't change between renders.
  const baseClient = token && gatewayUrl ? new ApiClient(gatewayUrl, token) : null;

  const uploadProgress = useUploadProgress();

  const wrappedClient: SessionsApiClient | null = baseClient
    ? {
        listSessions: async () => {
          try {
            return await baseClient.listSessions();
          } catch (err) {
            if (err instanceof HttpError && err.status === 401) {
              logout();
              navigateFnRef.current('/web/login', { replace: true });
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
      navigateFnRef.current('/web/login', { replace: true });
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

  const newPaneFromCurrent = () => {
    const state = usePaneStore.getState();
    const next = upgradeLayout(state.layout);
    if (!next) {
      pushToast({ type: 'info', message: t('terminal.newPaneLimit') });
      return;
    }
    state.setLayout(next);
    const fresh = usePaneStore.getState();
    const slotCount = SLOT_COUNT[next];
    for (let i = 0; i < slotCount; i++) {
      if (!fresh.panes[i]) {
        fresh.setFocusedIndex(i);
        return;
      }
    }
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

  const focusPaneInDirection = (dir: PaneDirection) => {
    const { layout, focusedIndex, panes, setFocusedIndex } = usePaneStore.getState();
    const target = paneNeighbor(layout, focusedIndex, dir);
    if (target === null || target < 0 || target >= panes.length) return;
    setFocusedIndex(target);
  };

  const jumpToWindow = (n: number) => {
    // n is 1-based ⌘1..⌘9; map to 0-based window index inside focused pane.
    const state = usePaneStore.getState();
    const focused = state.panes[state.focusedIndex];
    if (!focused || focused.kind !== 'terminal') return;
    const session = useSessionsStore.getState().sessions.find((s) => s.displayName === focused.sessionId);
    if (!session) return;
    const target = session.windows?.find((w) => w.index === n - 1);
    if (!target) return;
    state.assignPane(state.focusedIndex, {
      kind: 'terminal',
      sessionId: focused.sessionId,
      windowIndex: n - 1,
    });
  };

  const newWindow = () => {
    const state = usePaneStore.getState();
    const focused = state.panes[state.focusedIndex];
    if (!focused || focused.kind !== 'terminal') return;
    const session = useSessionsStore.getState().sessions.find((s) => s.displayName === focused.sessionId);
    if (!session) return;
    void handleCreateWindow(session.displayName);
  };

  const closeWindow = () => {
    const state = usePaneStore.getState();
    const focused = state.panes[state.focusedIndex];
    if (!focused || focused.kind !== 'terminal') return;
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
    focusPaneInDirection,
    openLayoutMenu,
    openSearch,
  });

  if (!token || !gatewayUrl) return <Navigate to="/web/login" replace />;

  const canCreateNewPane = upgradeLayout(currentLayout) !== null;

  const activeTab: ShellTab = location.pathname.startsWith('/web/settings')
    ? 'settings'
    : location.pathname.startsWith('/web/files')
      ? 'files'
      : 'sessions';

  const handleSelectTab = (tab: ShellTab) => {
    if (tab === 'sessions') {
      navigate('/web/sessions' + location.hash);
    } else {
      navigate(`/web/${tab}`);
    }
  };

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
    <>
      <div style={{ display: 'flex', height: '100vh', background: tokens.colors.bg }}>
        <LeftRail
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onLogout={logout}
          rateLimitsWarning={rateLimitsWarning}
        />
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
            onSearch={() => useLayoutStore.getState().openSearch()}
            onNewPane={newPaneFromCurrent}
            canCreateNewPane={canCreateNewPane}
            apiClient={baseClient}
            filesClient={filesClient}
            uploadProgress={uploadProgress}
            onAuthError={() => {
              logout();
              navigateFnRef.current('/web/login', { replace: true });
            }}
          />
        </div>
      </div>
      <CommandPalette />
    </>
  );
}
