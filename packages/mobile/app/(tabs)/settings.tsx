import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useServersStore } from '@/src/stores/servers';

const STORAGE_KEY = 'ccsuite_servers';

export default function SettingsScreen() {
  const server = useServersStore((state) => state.getDefaultServer());
  const clear = useServersStore((state) => state.clear);

  const appName = Constants.expoConfig?.name ?? 'ccsuite-mobile';
  const version = Constants.expoConfig?.version ?? 'unknown';

  const confirmReset = () => {
    Alert.alert('全データ削除', '保存済みサーバー情報をすべて削除しますか。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await SecureStore.deleteItemAsync(STORAGE_KEY);
            clear();
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Settings' }} />

      <View style={styles.card}>
        <Text style={styles.label}>アプリ</Text>
        <Text style={styles.value}>{appName}</Text>
        <Text style={styles.meta}>Version {version}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>デフォルトサーバー</Text>
        {server ? (
          <>
            <Text style={styles.value}>{server.name}</Text>
            <Text style={styles.meta}>{server.url}</Text>
          </>
        ) : (
          <Text style={styles.meta}>未設定</Text>
        )}
      </View>

      <Pressable onPress={confirmReset} style={styles.dangerButton}>
        <Text style={styles.dangerLabel}>全データ削除</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    padding: 16,
    backgroundColor: Colors.dark.background,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 8,
  },
  label: {
    color: Colors.dark.muted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: Colors.dark.muted,
    fontSize: 14,
  },
  dangerButton: {
    marginTop: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: Colors.dark.danger,
  },
  dangerLabel: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
