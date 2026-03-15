import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { verifyAuth } from '@/src/api/client';
import { useServersStore } from '@/src/stores/servers';
import type { Server } from '@/src/types';
import Colors from '@/constants/Colors';

const initialForm = {
  name: '',
  url: '',
  token: '',
};

export default function ServersScreen() {
  const servers = useServersStore((state) => state.servers);
  const addServer = useServersStore((state) => state.addServer);
  const updateServer = useServersStore((state) => state.updateServer);
  const removeServer = useServersStore((state) => state.removeServer);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const formComplete = form.name.trim().length > 0 && form.url.trim().length > 0 && form.token.trim().length > 0;

  const setField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const runAuthTest = async () => {
    if (!formComplete) {
      Alert.alert('入力不足', 'Name、URL、Token をすべて入力してください。');
      return;
    }

    setTesting(true);
    try {
      await verifyAuth({
        id: 'verify',
        name: form.name.trim(),
        url: form.url.trim(),
        token: form.token.trim(),
        isDefault: false,
      });
      Alert.alert('接続成功', '認証に成功しました。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '接続に失敗しました。';
      Alert.alert('接続失敗', message);
    } finally {
      setTesting(false);
    }
  };

  const submit = async () => {
    if (!formComplete) {
      Alert.alert('入力不足', 'Name、URL、Token をすべて入力してください。');
      return;
    }

    setSaving(true);
    try {
      await addServer(form);
      setForm(initialForm);
      setShowForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'サーバーを追加できませんでした。';
      Alert.alert('追加失敗', message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (server: Server) => {
    Alert.alert('サーバー削除', `${server.name} を削除しますか。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void removeServer(server.id);
        },
      },
    ]);
  };

  const setDefault = async (server: Server) => {
    if (server.isDefault) {
      return;
    }

    try {
      await updateServer(server.id, { isDefault: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'デフォルトサーバーを更新できませんでした。';
      Alert.alert('更新失敗', message);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Servers',
          headerRight: () => (
            <Pressable hitSlop={8} onPress={() => setShowForm((current) => !current)}>
              <Ionicons color={Colors.dark.text} name={showForm ? 'close' : 'add'} size={22} />
            </Pressable>
          ),
        }}
      />

      {showForm ? (
        <View style={styles.formCard}>
          <TextInput
            placeholder="Name"
            placeholderTextColor={Colors.dark.muted}
            style={styles.input}
            value={form.name}
            onChangeText={(value) => setField('name', value)}
          />
          <TextInput
            placeholder="URL"
            placeholderTextColor={Colors.dark.muted}
            style={styles.input}
            value={form.url}
            autoCapitalize="none"
            keyboardType="url"
            onChangeText={(value) => setField('url', value)}
          />
          <TextInput
            placeholder="Token"
            placeholderTextColor={Colors.dark.muted}
            style={styles.input}
            value={form.token}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => setField('token', value)}
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              disabled={testing}
              style={[styles.secondaryButton, testing && styles.disabledButton]}
              onPress={() => void runAuthTest()}
            >
              <Text style={styles.secondaryButtonLabel}>{testing ? '確認中...' : 'テスト'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={saving}
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={() => void submit()}
            >
              <Text style={styles.primaryButtonLabel}>{saving ? '追加中...' : '追加'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <FlatList
        data={servers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={servers.length === 0 ? styles.emptyContent : styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            delayLongPress={300}
            onLongPress={() => confirmDelete(item)}
            onPress={() => void setDefault(item)}
            style={[styles.serverCard, item.isDefault && styles.serverCardDefault]}
          >
            <View style={styles.serverHeader}>
              <Text style={styles.serverName}>{item.name}</Text>
              {item.isDefault ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>DEFAULT</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.serverUrl}>{item.url}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>サーバーがありません</Text>
            <Text style={styles.emptyText}>右上の + から接続先を追加してください。</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  formCard: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.card,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.cardMuted,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: Colors.dark.tint,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: Colors.dark.cardMuted,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonLabel: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButtonLabel: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
    padding: 16,
  },
  serverCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 8,
  },
  serverCardDefault: {
    borderColor: Colors.dark.tint,
  },
  serverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  serverName: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.dark.tint,
  },
  badgeLabel: {
    color: Colors.dark.background,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  serverUrl: {
    color: Colors.dark.muted,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.dark.muted,
    fontSize: 14,
    textAlign: 'center',
  },
});
