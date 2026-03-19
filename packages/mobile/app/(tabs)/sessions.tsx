import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
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
import { useTheme } from '@/src/theme';
import { terminalColorsLight, terminalColorsDark } from '@/src/theme/tokens';
import type { TmuxSession } from '@/src/types';

type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

const statusLabels: Record<TerminalStatus, string> = {
  connected: '接続中',
  disconnected: '未接続',
  error: 'エラー',
  reconnecting: '再接続中',
};

const formatDate = (created: number) => {
  const timestamp = created < 1_000_000_000_000 ? created * 1000 : created;
  return new Date(timestamp).toLocaleString('ja-JP');
};

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

type LoadMode = 'initial' | 'refresh' | 'soft';

export default function SessionsScreen() {
  const router = useRouter();
  const server = useServersStore((state) => state.getDefaultServer());
  const { colors, dark, radii, shadows, spacing, typography } = useTheme();

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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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
        setActiveSessionId(session.displayName);
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
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing['4xl'],
        },
        centeredContent: {
          justifyContent: 'center',
        },
        headerSection: {
          marginBottom: spacing.lg,
          gap: spacing.md,
        },
        addPrompt: {
          gap: spacing.sm,
        },
        addPromptRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        addPromptIcon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primarySubtle,
        },
        formCard: {
          gap: spacing.lg,
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
        sessionCard: {
          gap: spacing.md,
          ...(dark ? {} : shadows.sm),
        },
        sessionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        sessionTitleWrap: {
          flex: 1,
        },
        statusPill: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: 5,
          borderRadius: radii.full,
          backgroundColor: dark ? colors.surfaceHover : colors.bg,
          borderWidth: 1,
          borderColor: dark ? colors.border : colors.borderSubtle,
        },
        sessionCwd: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        sessionDate: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        sessionFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        sessionHint: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flex: 1,
        },
        renameForm: {
          gap: spacing.md,
          paddingTop: spacing.xs,
        },
        separator: {
          height: spacing.md,
        },
        addPromptCopy: {
          flex: 1,
          gap: spacing.xs,
        },
        pageIndicatorRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: spacing.xs,
          gap: spacing.sm,
        },
      }),
    [colors, dark, radii, shadows, spacing],
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
        const message = getErrorMessage(err, 'セッション一覧を取得できませんでした。');
        setError(message);
        Toast.show({
          type: 'error',
          text1: 'セッション取得失敗',
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
    setActiveSessionId(sessionId);
  }, []);

  const closeTerminal = useCallback(() => {
    setActiveSessionId(null);
    void loadSessions('soft');
  }, [loadSessions]);

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
      const message = getErrorMessage(err, 'セッションを作成できませんでした。');
      Toast.show({
        type: 'error',
        text1: 'セッション作成失敗',
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
        const message = getErrorMessage(err, 'セッションを削除できませんでした。');
        Toast.show({
          type: 'error',
          text1: 'セッション削除失敗',
          text2: message,
        });
      }
    },
    [editingSessionId, isCurrentServer, resetRenameForm, server],
  );

  const confirmDelete = useCallback(
    (session: TmuxSession) => {
      Alert.alert('セッション削除', `${session.displayName} を削除しますか。`, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
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
          text1: 'リネーム失敗',
          text2: '名前を入力してください。',
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
          text1: 'リネーム完了',
        });
      } catch (err) {
        if (!isCurrentServer(currentServer.id)) {
          return;
        }
        const message = getErrorMessage(err, 'セッションをリネームできませんでした。');
        Toast.show({
          type: 'error',
          text1: 'リネーム失敗',
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

  const showSkeleton = loading && sessions.length === 0;
  const showErrorState = Boolean(error) && sessions.length === 0;

  const header = (
    <View style={styles.headerSection}>
      {showCreateForm ? (
        <Card highlighted style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>新しいセッション</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              名前は空欄のままでも作成できます。必要ならあとでスワイプしてリネームできます。
            </Text>
          </View>

          <Input
            autoCapitalize="none"
            label="セッション名"
            onChangeText={setCreateName}
            placeholder="例: 作業メモ / deploy / scratch"
            value={createName}
          />

          <View style={styles.formActions}>
            <Button label="キャンセル" onPress={cancelCreate} size="sm" variant="secondary" />
            <Button label="作成" loading={creating} onPress={() => void handleCreate()} size="sm" />
          </View>
        </Card>
      ) : (
        <Card onPress={openCreateForm} style={styles.addPrompt}>
          <View style={styles.addPromptRow}>
            <View style={styles.addPromptCopy}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>新しいセッションを作成</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                ターミナルを開いて作業を始めましょう。名前はあとで変更できます。
              </Text>
            </View>
            <View style={styles.addPromptIcon}>
              <Ionicons color={colors.primary} name="add-outline" size={22} />
            </View>
          </View>
        </Card>
      )}
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
                    accessibilityLabel="セッション一覧に戻る"
                    accessibilityRole="button"
                    hitSlop={12}
                    onPress={closeTerminal}
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                  >
                    <Ionicons color={colors.textPrimary} name="chevron-back" size={24} />
                  </Pressable>
                ),
                headerRight: () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                    accessibilityLabel="セッションを作成"
                    accessibilityRole="button"
                    disabled={!server || creating}
                    hitSlop={8}
                    onPress={openCreateForm}
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
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
                action={{ label: '再試行', onPress: () => void loadSessions('initial') }}
                description={error ?? '時間をおいて再試行してください'}
                icon="cloud-offline-outline"
                title="セッションを取得できません"
              />
            ) : (
              <EmptyState
                action={{ label: 'セッションを作成', onPress: handleCreateAction }}
                description="新しい tmux セッションを作成して開始しましょう"
                icon="terminal-outline"
                title="セッションがありません"
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
            const sessionAccessibilityLabel = `${item.displayName} ${formatDate(item.created)}`;

            return (
              <SwipeableRow
                leftAction={
                  isEditing
                    ? undefined
                    : {
                        icon: 'pencil-outline',
                        color: colors.primary,
                        label: 'セッションをリネーム',
                        onPress: () => startRename(item),
                      }
                }
                rightAction={
                  isEditing
                    ? undefined
                    : {
                        icon: 'trash-outline',
                        color: colors.error,
                        label: 'セッションを削除',
                        onPress: () => confirmDelete(item),
                      }
                }
              >
                <Card
                  accessibilityLabel={sessionAccessibilityLabel}
                  highlighted={isEditing}
                  onLongPress={isEditing ? undefined : () => confirmDelete(item)}
                  onPress={
                    isEditing
                      ? undefined
                      : () => openTerminal(item.displayName)
                  }
                  style={styles.sessionCard}
                >
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionTitleWrap}>
                      <Text numberOfLines={1} style={[typography.heading, { color: colors.textPrimary }]}>
                        {isEditing && renameValue ? renameValue : item.displayName}
                      </Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Ionicons color={colors.success} name="radio-button-on-outline" size={14} />
                      <Text style={[typography.smallMedium, { color: colors.success }]}>active</Text>
                    </View>
                  </View>

                  <View style={styles.sessionCwd}>
                    <Ionicons color={colors.textMuted} name="folder-outline" size={14} />
                    <Text numberOfLines={1} style={[typography.mono, { color: colors.textSecondary }]}>
                      {item.cwd}
                    </Text>
                  </View>

                  <View style={styles.sessionDate}>
                    <Ionicons color={colors.textMuted} name="time-outline" size={14} />
                    <Text style={[typography.caption, { color: colors.textMuted }]}>作成 {formatDate(item.created)}</Text>
                  </View>

                  <View style={styles.sessionFooter}>
                    <View style={styles.sessionHint}>
                      <Ionicons color={colors.textMuted} name="open-outline" size={14} />
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>タップで接続</Text>
                    </View>
                    <Text style={[typography.small, { color: colors.textMuted }]}>スワイプで操作</Text>
                  </View>

                  {isEditing ? (
                    <View style={styles.renameForm}>
                      <Input
                        autoCapitalize="none"
                        label="表示名"
                        onChangeText={setRenameValue}
                        placeholder="新しい表示名を入力"
                        value={renameValue}
                      />

                      <View style={styles.formActions}>
                        <Button label="キャンセル" onPress={cancelRename} size="sm" variant="secondary" />
                        <Button
                          disabled={!renameValue.trim()}
                          label="保存"
                          loading={isRenaming}
                          onPress={() => void handleRename(item)}
                          size="sm"
                        />
                      </View>
                    </View>
                  ) : null}
                </Card>
              </SwipeableRow>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
