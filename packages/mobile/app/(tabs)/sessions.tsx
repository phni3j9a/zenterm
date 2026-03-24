import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { createSession, deleteSession, listSessions, renameSession } from '@/src/api/client';
import { InlineTerminal } from '@/src/components/InlineTerminal';
import { SetupGuide } from '@/src/components/SetupGuide';
import { Button, Card, EmptyState, Input, SkeletonLoader, SwipeableRow } from '@/src/components/ui';
import { useServersStore } from '@/src/stores/servers';
import { useSessionViewStore } from '@/src/stores/sessionView';
import { useTheme } from '@/src/theme';
import { terminalColorsLight, terminalColorsDark } from '@/src/theme/tokens';
import type { TmuxSession } from '@/src/types';

type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

const statusLabels: Record<TerminalStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error',
  reconnecting: 'Reconnecting',
};

const formatSmartDate = (created: number): string => {
  const timestamp = created < 1_000_000_000_000 ? created * 1000 : created;
  const date = new Date(timestamp);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

const shortenPath = (cwd: string): string => {
  const homeMatch = cwd.match(/^\/home\/[^/]+/);
  if (homeMatch) return cwd.replace(homeMatch[0], '~');
  return cwd;
};

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

type LoadMode = 'initial' | 'refresh' | 'soft';

export default function SessionsScreen() {
  const server = useServersStore((state) => state.getDefaultServer());
  const { colors, dark, radii, spacing, typography } = useTheme();

  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionsCountRef = useRef(0);
  const requestIdRef = useRef(0);

  // ── Inline terminal state ──
  const activeSessionId = useSessionViewStore((state) => state.activeSessionId);
  const openSession = useSessionViewStore((state) => state.open);
  const closeSession = useSessionViewStore((state) => state.close);
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>('disconnected');
  const termBg = dark ? terminalColorsDark.bg : terminalColorsLight.bg;

  // ── Swipe pager state ──
  const { width: screenWidth } = useWindowDimensions();
  const pagerRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      const idx = viewableItems[0].index;
      setActiveIndex(idx);
      const session = sessionsRef.current[idx];
      if (session) {
        useSessionViewStore.getState().open(session.displayName);
      }
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        skeletonContainer: {
          flex: 1,
          padding: spacing.lg,
          gap: spacing.md,
        },
        listContent: {
          flexGrow: 1,
          paddingTop: spacing.sm,
          paddingBottom: spacing['4xl'],
        },
        centeredContent: {
          justifyContent: 'center',
        },
        headerSection: {
          marginBottom: 0,
        },
        sectionLabel: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: colors.textMuted,
          paddingTop: spacing.xl,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.xl,
        },
        newSessionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
        },
        newSessionDot: {
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        formCard: {
          gap: spacing.lg,
          marginHorizontal: spacing.lg,
        },
        formHeader: {
          gap: spacing.xs,
        },
        formActions: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: spacing.sm,
        },
        sessionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: 16,
          paddingHorizontal: spacing.xl,
          borderRadius: radii.md,
          marginHorizontal: spacing.sm,
        },
        sessionDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.success,
          opacity: 0.8,
        },
        sessionBody: {
          flex: 1,
          minWidth: 0,
        },
        sessionName: {
          ...typography.bodyMedium,
          color: colors.textPrimary,
        },
        sessionPath: {
          ...typography.mono,
          fontSize: 12,
          lineHeight: 16,
          color: colors.textMuted,
          marginTop: 3,
        },
        sessionTime: {
          ...typography.small,
          color: colors.textMuted,
        },
        sessionArrow: {
          color: colors.textMuted,
          opacity: 0.4,
        },
        renameForm: {
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
        },
        separator: {
          height: 0,
        },
        pageIndicatorRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: spacing.xs,
          gap: spacing.sm,
        },
      }),
    [colors, radii, spacing, typography],
  );

  const renderSeparator = useCallback(() => <View style={styles.separator} />, [styles.separator]);

  const isCurrentServer = useCallback((serverId: string) => useServersStore.getState().getDefaultServer()?.id === serverId, []);

  const resetCreateForm = useCallback(() => {
    setShowCreateForm(false);
    setCreateName('');
  }, []);

  const resetRenameForm = useCallback(() => {
    setEditingSessionId(null);
    setRenameValue('');
  }, []);

  useEffect(() => {
    sessionsCountRef.current = sessions.length;
  }, [sessions.length]);

  useEffect(() => {
    requestIdRef.current += 1;
    setSessions([]);
    setLoading(false);
    setRefreshing(false);
    setCreating(false);
    setRenamingSessionId(null);
    setError(null);
    sessionsCountRef.current = 0;
    resetCreateForm();
    resetRenameForm();
    useSessionViewStore.getState().close();
  }, [server?.id, resetCreateForm, resetRenameForm]);

  const loadSessions = useCallback(
    async (mode: LoadMode = 'initial') => {
      if (!server) {
        requestIdRef.current += 1;
        setSessions([]);
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      const currentServer = server;

      if (mode === 'initial') {
        setLoading(true);
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      }

      try {
        const data = await listSessions(currentServer);
        if (requestIdRef.current !== currentRequestId || !isCurrentServer(currentServer.id)) {
          return;
        }
        setSessions(data);
        setError(null);
      } catch (err) {
        if (requestIdRef.current !== currentRequestId || !isCurrentServer(currentServer.id)) {
          return;
        }
        const message = getErrorMessage(err, 'Failed to fetch sessions.');
        setError(message);
        Toast.show({
          type: 'error',
          text1: 'Fetch Failed',
          text2: message,
        });
      } finally {
        if (requestIdRef.current !== currentRequestId || !isCurrentServer(currentServer.id)) {
          return;
        }

        if (mode === 'initial') {
          setLoading(false);
        }

        if (mode === 'refresh') {
          setRefreshing(false);
        }
      }
    },
    [isCurrentServer, server],
  );

  const openTerminal = useCallback((sessionId: string) => {
    setTerminalStatus('disconnected');
    openSession(sessionId);
  }, [openSession]);

  const closeTerminal = useCallback(() => {
    closeSession();
    void loadSessions('soft');
  }, [closeSession, loadSessions]);

  useFocusEffect(
    useCallback(() => {
      const mode: LoadMode = sessionsCountRef.current === 0 ? 'initial' : 'soft';
      void loadSessions(mode);
    }, [loadSessions]),
  );

  const openCreateForm = useCallback(() => {
    if (!server || creating) {
      return;
    }

    resetRenameForm();
    setShowCreateForm(true);
  }, [creating, resetRenameForm, server]);

  const cancelCreate = useCallback(() => {
    if (creating) {
      return;
    }

    resetCreateForm();
  }, [creating, resetCreateForm]);

  const handleCreate = useCallback(async () => {
    if (!server || creating) {
      return;
    }

    const currentServer = server;
    const nextName = createName.trim();

    setCreating(true);
    try {
      const session = await createSession(currentServer, nextName || undefined);
      if (!isCurrentServer(currentServer.id)) {
        return;
      }
      setSessions((current) => [session, ...current.filter((item) => item.name !== session.name)]);
      setError(null);
      resetCreateForm();
      openTerminal(session.displayName);
    } catch (err) {
      if (!isCurrentServer(currentServer.id)) {
        return;
      }
      const message = getErrorMessage(err, 'Failed to create session.');
      Toast.show({
        type: 'error',
        text1: 'Create Failed',
        text2: message,
      });
    } finally {
      if (isCurrentServer(currentServer.id)) {
        setCreating(false);
      }
    }
  }, [createName, creating, isCurrentServer, openTerminal, resetCreateForm, server]);

  const handleCreateAction = useCallback(() => {
    if (showCreateForm) {
      void handleCreate();
      return;
    }

    openCreateForm();
  }, [handleCreate, openCreateForm, showCreateForm]);

  const handleDelete = useCallback(
    async (session: TmuxSession) => {
      if (!server) {
        return;
      }

      const currentServer = server;

      try {
        await deleteSession(currentServer, session.name);
        if (!isCurrentServer(currentServer.id)) {
          return;
        }
        setSessions((current) => current.filter((item) => item.name !== session.name));
        setError(null);

        if (editingSessionId === session.name) {
          resetRenameForm();
        }
      } catch (err) {
        if (!isCurrentServer(currentServer.id)) {
          return;
        }
        const message = getErrorMessage(err, 'Failed to delete session.');
        Toast.show({
          type: 'error',
          text1: 'Delete Failed',
          text2: message,
        });
      }
    },
    [editingSessionId, isCurrentServer, resetRenameForm, server],
  );

  const confirmDelete = useCallback(
    (session: TmuxSession) => {
      Alert.alert('Delete Session', `Delete "${session.displayName}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void handleDelete(session);
          },
        },
      ]);
    },
    [handleDelete],
  );

  const startRename = useCallback(
    (session: TmuxSession) => {
      if (renamingSessionId) {
        return;
      }

      resetCreateForm();
      setEditingSessionId(session.name);
      setRenameValue(session.displayName);
    },
    [renamingSessionId, resetCreateForm],
  );

  const cancelRename = useCallback(() => {
    if (renamingSessionId) {
      return;
    }

    resetRenameForm();
  }, [renamingSessionId, resetRenameForm]);

  const handleRename = useCallback(
    async (session: TmuxSession) => {
      if (!server || renamingSessionId === session.name) {
        return;
      }

      const currentServer = server;
      const nextName = renameValue.trim();

      if (!nextName) {
        Toast.show({
          type: 'error',
          text1: 'Rename Failed',
          text2: 'Please enter a name.',
        });
        return;
      }

      if (nextName === session.displayName) {
        resetRenameForm();
        return;
      }

      setRenamingSessionId(session.name);
      try {
        const updatedSession = await renameSession(currentServer, session.name, nextName);
        if (!isCurrentServer(currentServer.id)) {
          return;
        }
        setSessions((current) => current.map((item) => (item.name === session.name ? updatedSession : item)));
        setError(null);
        resetRenameForm();
        Toast.show({
          type: 'success',
          text1: 'Renamed',
        });
      } catch (err) {
        if (!isCurrentServer(currentServer.id)) {
          return;
        }
        const message = getErrorMessage(err, 'Failed to rename session.');
        Toast.show({
          type: 'error',
          text1: 'Rename Failed',
          text2: message,
        });
      } finally {
        if (isCurrentServer(currentServer.id)) {
          setRenamingSessionId((current) => (current === session.name ? null : current));
        }
      }
    },
    [isCurrentServer, renameValue, renamingSessionId, resetRenameForm, server],
  );

  const handleSessionAccessibilityAction = useCallback(
    (session: TmuxSession, actionName: string) => {
      if (actionName === 'activate') {
        openTerminal(session.displayName);
        return;
      }

      if (actionName === 'rename') {
        startRename(session);
        return;
      }

      if (actionName === 'delete') {
        confirmDelete(session);
      }
    },
    [confirmDelete, openTerminal, startRename],
  );

  const showSkeleton = loading && sessions.length === 0;
  const showErrorState = Boolean(error) && sessions.length === 0;

  const header = (
    <View style={styles.headerSection}>
      {showCreateForm ? (
        <Card highlighted style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>New Session</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Name is optional. You can rename it later from the session actions.
            </Text>
          </View>

          <Input
            autoCapitalize="none"
            label="Session Name"
            onChangeText={setCreateName}
            placeholder="e.g. deploy / scratch"
            value={createName}
          />

          <View style={styles.formActions}>
            <Button label="Cancel" onPress={cancelCreate} size="sm" variant="secondary" />
            <Button label="Create" loading={creating} onPress={() => void handleCreate()} size="sm" />
          </View>
        </Card>
      ) : (
        <Pressable onPress={openCreateForm} style={styles.newSessionRow}>
          <View style={styles.newSessionDot}>
            <Ionicons color={colors.textInverse} name="add" size={16} />
          </View>
          <Text style={[typography.bodyMedium, { color: colors.primary }]}>New Session</Text>
        </Pressable>
      )}
      {sessions.length > 0 && <Text style={styles.sectionLabel}>Active</Text>}
    </View>
  );

  const statusColor = activeSessionId
    ? {
        connected: colors.success,
        disconnected: colors.textMuted,
        error: colors.error,
        reconnecting: colors.warning,
      }[terminalStatus]
    : undefined;

  return (
    <View style={[styles.container, activeSessionId && { backgroundColor: termBg }]}>
      <Stack.Screen
        options={
          activeSessionId
            ? {
                title: sessions[activeIndex]?.displayName || activeSessionId || 'Terminal',
                headerStyle: { backgroundColor: termBg },
                headerTintColor: colors.textPrimary,
                headerLeft: () => (
                  <Pressable
                    accessibilityLabel="Back to sessions"
                    accessibilityRole="button"
                    hitSlop={12}
                    onPress={closeTerminal}
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                  >
                    <Ionicons color={colors.textPrimary} name="chevron-back" size={24} />
                  </Pressable>
                ),
                headerRight: () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}>
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 9999,
                        backgroundColor: statusColor,
                      }}
                    />
                    <Text style={[typography.small, { color: statusColor }]}>
                      {statusLabels[terminalStatus]}
                    </Text>
                  </View>
                ),
              }
            : {
                title: 'Sessions',
                headerStyle: undefined,
                headerLeft: undefined,
                headerRight: () => (
                  <Pressable
                    accessibilityLabel="Create session"
                    accessibilityRole="button"
                    disabled={!server || creating}
                    hitSlop={8}
                    onPress={openCreateForm}
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, marginRight: 8 })}
                  >
                    <Ionicons
                      color={!server || creating ? colors.textMuted : showCreateForm ? colors.primary : colors.textPrimary}
                      name="add"
                      size={22}
                    />
                  </Pressable>
                ),
              }
        }
      />

      {activeSessionId && server ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
          style={{ flex: 1 }}
        >
          <FlatList
            ref={pagerRef}
            data={sessions}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.name}
            initialScrollIndex={Math.max(0, sessions.findIndex((s) => s.displayName === activeSessionId))}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => (
              <View style={{ width: screenWidth, flex: 1 }}>
                <InlineTerminal
                  server={server}
                  sessionId={item.displayName}
                  onStatusChange={setTerminalStatus}
                />
              </View>
            )}
          />
          {sessions.length > 1 && (
            <View style={[styles.pageIndicatorRow, { backgroundColor: termBg }]}>
              {sessions.map((session, index) => (
                <View
                  key={session.name}
                  style={{
                    width: index === activeIndex ? 20 : 6,
                    height: 6,
                    borderRadius: radii.full,
                    backgroundColor: index === activeIndex ? colors.primary : colors.textMuted,
                    opacity: index === activeIndex ? 1 : 0.4,
                  }}
                />
              ))}
            </View>
          )}
        </KeyboardAvoidingView>
      ) : !server ? (
        <SetupGuide />
      ) : showSkeleton ? (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonLoader key={index} height={72} radius={radii.lg} width="100%" />
          ))}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, sessions.length === 0 && !showCreateForm && styles.centeredContent]}
          data={sessions}
          ItemSeparatorComponent={renderSeparator}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.name}
          ListEmptyComponent={
            showErrorState ? (
              <EmptyState
                action={{ label: 'Retry', onPress: () => void loadSessions('initial') }}
                description={error ?? 'Please try again later.'}
                icon="cloud-offline-outline"
                title="Cannot fetch sessions"
              />
            ) : (
              <EmptyState
                action={{ label: 'Create Session', onPress: handleCreateAction }}
                description="Create a new tmux session to get started."
                icon="terminal-outline"
                title="No Sessions"
              />
            )
          }
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => void loadSessions('refresh')}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const isEditing = editingSessionId === item.name;
            const isRenaming = renamingSessionId === item.name;
            const sessionAccessibilityLabel = `${item.displayName} ${formatSmartDate(item.created)}`;
            const accessibilityActions = [
              { name: 'activate', label: 'Open terminal' },
              { name: 'rename', label: 'Rename session' },
              { name: 'delete', label: 'Delete session' },
            ] as const;

            return (
              <SwipeableRow
                leftAction={
                  isEditing
                    ? undefined
                    : {
                        icon: 'pencil-outline',
                        color: colors.primary,
                        label: 'Rename session',
                        onPress: () => startRename(item),
                      }
                }
                rightAction={
                  isEditing
                    ? undefined
                    : {
                        icon: 'trash-outline',
                        color: colors.error,
                        label: 'Delete session',
                        onPress: () => confirmDelete(item),
                    }
                }
              >
                <View>
                  <Pressable
                    accessibilityActions={accessibilityActions}
                    accessibilityLabel={sessionAccessibilityLabel}
                    accessibilityRole="button"
                    delayLongPress={300}
                    onAccessibilityAction={({ nativeEvent }) => handleSessionAccessibilityAction(item, nativeEvent.actionName)}
                    onLongPress={isEditing ? undefined : () => confirmDelete(item)}
                    onPress={isEditing ? undefined : () => openTerminal(item.displayName)}
                    style={({ pressed }) => [
                      styles.sessionRow,
                      isEditing && { backgroundColor: colors.primarySubtle },
                      pressed && { backgroundColor: colors.surfaceHover },
                    ]}
                  >
                    <View style={styles.sessionDot} />
                    <View style={styles.sessionBody}>
                      <Text numberOfLines={1} style={styles.sessionName}>
                        {isEditing && renameValue ? renameValue : item.displayName}
                      </Text>
                      <Text numberOfLines={1} style={styles.sessionPath}>{shortenPath(item.cwd)}</Text>
                    </View>
                    <Text style={styles.sessionTime}>{formatSmartDate(item.created)}</Text>
                    <Text style={styles.sessionArrow}>›</Text>
                  </Pressable>

                </View>

                {isEditing ? (
                  <View style={styles.renameForm}>
                    <Input
                      autoCapitalize="none"
                      label="Display Name"
                      onChangeText={setRenameValue}
                      placeholder="Enter new name"
                      value={renameValue}
                    />

                    <View style={styles.formActions}>
                      <Button label="Cancel" onPress={cancelRename} size="sm" variant="secondary" />
                      <Button
                        disabled={!renameValue.trim()}
                        label="Save"
                        loading={isRenaming}
                        onPress={() => void handleRename(item)}
                        size="sm"
                      />
                    </View>
                  </View>
                ) : null}
              </SwipeableRow>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
