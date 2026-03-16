import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpecialKeys } from '@/src/components/SpecialKeys';
import { TerminalWebView, type TerminalWebViewHandle } from '@/src/components/TerminalWebView';
import { useServersStore } from '@/src/stores/servers';
import { useTheme } from '@/src/theme';
import { terminalColorsLight, terminalColorsDark } from '@/src/theme/tokens';

type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

const statusConfig = {
  connected: { label: '\u63A5\u7D9A\u4E2D', getColor: (c: { success: string }) => c.success },
  disconnected: { label: '\u672A\u63A5\u7D9A', getColor: (c: { textMuted: string }) => c.textMuted },
  error: { label: '\u30A8\u30E9\u30FC', getColor: (c: { error: string }) => c.error },
  reconnecting: { label: '\u518D\u63A5\u7D9A\u4E2D...', getColor: (c: { warning: string }) => c.warning },
} as const;

export default function TerminalScreen() {
  const params = useLocalSearchParams<{ sessionId: string | string[] }>();
  const server = useServersStore((state) => state.getDefaultServer());
  const terminalRef = useRef<TerminalWebViewHandle>(null);
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const [status, setStatus] = useState<TerminalStatus>('disconnected');
  const router = useRouter();
  const { dark, colors, spacing, radii, typography } = useTheme();

  const value = params.sessionId;
  const sessionId = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  const currentStatus = statusConfig[status];
  const statusColor = currentStatus.getColor(colors);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        container: {
          flex: 1,
          backgroundColor: dark ? terminalColorsDark.bg : terminalColorsLight.bg,
        },
        headerBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        closeButton: {
          width: 36,
          height: 36,
          borderRadius: radii.sm,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerTitle: {
          ...typography.bodyMedium,
          color: colors.textPrimary,
          flex: 1,
          textAlign: 'center',
          marginHorizontal: spacing.md,
        },
        statusPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: 5,
          borderRadius: radii.full,
          backgroundColor: colors.surfaceHover,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        },
        statusDot: {
          width: 7,
          height: 7,
          borderRadius: 9999,
        },
        statusLabel: {
          ...typography.small,
        },
        centered: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing['2xl'],
          backgroundColor: dark ? terminalColorsDark.bg : terminalColorsLight.bg,
        },
        title: {
          ...typography.heading,
          color: colors.textPrimary,
          textAlign: 'center',
        },
        description: {
          ...typography.caption,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: spacing.xs,
        },
      }),
    [colors, dark, radii, spacing, typography],
  );

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

  const headerBar = (
    <View style={styles.headerBar}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => [
          styles.closeButton,
          pressed && { backgroundColor: colors.surfaceHover },
        ]}
      >
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>

      <Text numberOfLines={1} style={styles.headerTitle}>
        {sessionId || 'Terminal'}
      </Text>

      <View style={styles.statusPill}>
        <Animated.View
          style={[
            styles.statusDot,
            { backgroundColor: statusColor, opacity: pulseOpacity },
          ]}
        />
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {currentStatus.label}
        </Text>
      </View>
    </View>
  );

  if (!server) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <StatusBar backgroundColor={colors.bg} style={dark ? 'light' : 'dark'} />
        {headerBar}
        <View style={styles.centered}>
          <Text style={styles.title}>{'\u30C7\u30D5\u30A9\u30EB\u30C8\u30B5\u30FC\u30D0\u30FC\u304C\u3042\u308A\u307E\u305B\u3093'}</Text>
          <Text style={styles.description}>
            {'Servers \u30BF\u30D6\u3067\u63A5\u7D9A\u5148\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar backgroundColor={colors.bg} style={dark ? 'light' : 'dark'} />
      {headerBar}

      <View style={styles.container}>
        <TerminalWebView ref={terminalRef} server={server} sessionId={sessionId} onStatusChange={setStatus} />
        <SpecialKeys onKeyPress={(data) => terminalRef.current?.sendInput(data)} />
      </View>
    </SafeAreaView>
  );
}
