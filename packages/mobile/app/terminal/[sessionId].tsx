import { StatusBar } from 'expo-status-bar';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpecialKeys } from '@/src/components/SpecialKeys';
import { TerminalWebView, type TerminalWebViewHandle } from '@/src/components/TerminalWebView';
import { useServersStore } from '@/src/stores/servers';
import { useTheme } from '@/src/theme';
import { colorsDark, terminalColors } from '@/src/theme/tokens';

type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

const statusConfig = {
  connected: { label: '接続中', dotColor: colorsDark.success },
  disconnected: { label: '未接続', dotColor: colorsDark.textMuted },
  error: { label: 'エラー', dotColor: colorsDark.error },
  reconnecting: { label: '再接続中...', dotColor: colorsDark.warning },
} as const;

export default function TerminalScreen() {
  const params = useLocalSearchParams<{ sessionId: string | string[] }>();
  const server = useServersStore((state) => state.getDefaultServer());
  const terminalRef = useRef<TerminalWebViewHandle>(null);
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const [status, setStatus] = useState<TerminalStatus>('disconnected');
  const { spacing, typography } = useTheme();

  const value = params.sessionId;
  const sessionId = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  const currentStatus = statusConfig[status];

  useEffect(() => {
    if (status !== 'reconnecting') {
      pulseOpacity.stopAnimation();
      pulseOpacity.setValue(1);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.3,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
      pulseOpacity.stopAnimation();
      pulseOpacity.setValue(1);
    };
  }, [pulseOpacity, status]);

  if (!server) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <StatusBar backgroundColor={terminalColors.bg} style="light" />
        <Stack.Screen
          options={{
            title: 'Terminal',
            headerStyle: { backgroundColor: terminalColors.bg },
            headerTintColor: colorsDark.textPrimary,
            headerTitleStyle: { color: colorsDark.textPrimary, fontWeight: '600' },
          }}
        />
        <View style={styles.centered}>
          <Text style={[styles.title, typography.heading]}>デフォルトサーバーがありません</Text>
          <Text style={[styles.description, typography.caption, { marginTop: spacing.xs }]}>
            Servers タブで接続先を設定してください。
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <StatusBar backgroundColor={terminalColors.bg} style="light" />
      <Stack.Screen
        options={{
          title: sessionId || 'Terminal',
          headerStyle: { backgroundColor: terminalColors.bg },
          headerTintColor: colorsDark.textPrimary,
          headerTitleStyle: { color: colorsDark.textPrimary, fontWeight: '600' },
          headerRight: () => (
            <View style={styles.headerStatus}>
              <Animated.View
                style={[
                  styles.headerStatusDot,
                  {
                    backgroundColor: currentStatus.dotColor,
                    opacity: pulseOpacity,
                  },
                ]}
              />
              <Text style={[styles.headerStatusLabel, { color: currentStatus.dotColor }]}>
                {currentStatus.label}
              </Text>
            </View>
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
    backgroundColor: terminalColors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: terminalColors.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: terminalColors.bg,
  },
  title: {
    color: colorsDark.textPrimary,
    textAlign: 'center',
  },
  description: {
    color: colorsDark.textSecondary,
    textAlign: 'center',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
  },
  headerStatusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
