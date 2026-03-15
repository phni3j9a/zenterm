import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { createSession, deleteSession, listSessions } from '@/src/api/client';
import { useServersStore } from '@/src/stores/servers';
import type { TmuxSession } from '@/src/types';
import Colors from '@/constants/Colors';

const formatDate = (created: number) => {
  const timestamp = created < 1_000_000_000_000 ? created * 1000 : created;
  return new Date(timestamp).toLocaleString('ja-JP');
};

export default function SessionsScreen() {
  const router = useRouter();
  const server = useServersStore((state) => state.getDefaultServer());

  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!server) {
      setSessions([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listSessions(server);
      setSessions(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'セッション一覧を取得できませんでした。';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [server]);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions]),
  );

  const handleCreate = async () => {
    if (!server || creating) {
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const session = await createSession(server);
      setSessions((current) => [session, ...current]);
      router.push({
        pathname: '/terminal/[sessionId]',
        params: { sessionId: session.displayName },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'セッションを作成できませんでした。';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (session: TmuxSession) => {
    if (!server) {
      return;
    }

    Alert.alert('セッション削除', `${session.displayName} を削除しますか。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteSession(server, session.name);
              setSessions((current) => current.filter((item) => item.name !== session.name));
            } catch (err) {
              const message = err instanceof Error ? err.message : 'セッションを削除できませんでした。';
              setError(message);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Sessions',
          headerRight: () => (
            <Pressable disabled={!server || creating} hitSlop={8} onPress={() => void handleCreate()}>
              <Ionicons
                color={!server || creating ? Colors.dark.muted : Colors.dark.text}
                name="add"
                size={22}
              />
            </Pressable>
          ),
        }}
      />

      {!server ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>サーバーを追加してください</Text>
          <Text style={styles.emptyText}>Servers タブでデフォルトサーバーを設定すると使えます。</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.dark.tint} size="large" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.name}
          contentContainerStyle={sessions.length === 0 ? styles.emptyContent : styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              delayLongPress={300}
              onPress={() =>
                router.push({
                  pathname: '/terminal/[sessionId]',
                  params: { sessionId: item.displayName },
                })
              }
              onLongPress={() => confirmDelete(item)}
              style={styles.sessionCard}
            >
              <Text style={styles.sessionName}>{item.displayName}</Text>
              <Text style={styles.sessionMeta}>{formatDate(item.created)}</Text>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>セッションがありません</Text>
              <Text style={styles.emptyText}>右上の + から新しい tmux セッションを作成してください。</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={() => void loadSessions()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
    padding: 16,
  },
  sessionCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  sessionName: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: '700',
  },
  sessionMeta: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.dark.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  errorBanner: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(212, 93, 93, 0.16)',
    borderWidth: 1,
    borderColor: Colors.dark.danger,
  },
  errorText: {
    color: '#f2b1b1',
    fontSize: 14,
  },
});
