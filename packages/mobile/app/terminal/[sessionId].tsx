import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { SpecialKeys } from '@/src/components/SpecialKeys';
import { TerminalWebView, type TerminalWebViewHandle } from '@/src/components/TerminalWebView';
import { useServersStore } from '@/src/stores/servers';

const statusMap = {
  connected: { label: 'connected', color: Colors.dark.success },
  disconnected: { label: 'disconnected', color: Colors.dark.muted },
  error: { label: 'error', color: Colors.dark.danger },
} as const;

export default function TerminalScreen() {
  const params = useLocalSearchParams<{ sessionId: string | string[] }>();
  const server = useServersStore((state) => state.getDefaultServer());
  const terminalRef = useRef<TerminalWebViewHandle>(null);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  const value = params.sessionId;
  const sessionId = Array.isArray(value) ? value[0] ?? '' : value ?? '';

  if (!server) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Terminal' }} />
        <View style={styles.centered}>
          <Text style={styles.title}>デフォルトサーバーがありません</Text>
          <Text style={styles.description}>Servers タブで接続先を設定してください。</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: sessionId || 'Terminal',
          headerRight: () => (
            <Text style={[styles.headerStatus, { color: statusMap[status].color }]}>{statusMap[status].label}</Text>
          ),
        }}
      />

      <View style={styles.container}>
        <TerminalWebView ref={terminalRef} server={server} sessionId={sessionId} onStatusChange={setStatus} />
        <SpecialKeys onKeyPress={(data) => terminalRef.current?.sendInput(data)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
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
    backgroundColor: Colors.dark.background,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: Colors.dark.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  headerStatus: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
