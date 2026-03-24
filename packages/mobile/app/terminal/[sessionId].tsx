import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpecialKeys } from '@/src/components/SpecialKeys';
import { TerminalWebView, type TerminalWebViewHandle } from '@/src/components/TerminalWebView';
import { useServersStore } from '@/src/stores/servers';
import { useTheme } from '@/src/theme';
import { terminalColorsLight, terminalColorsDark } from '@/src/theme/tokens';

type TerminalStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting';

const statusConfig = {
  connected: { label: 'Connected', getColor: (c: { success: string }) => c.success },
  disconnected: { label: 'Disconnected', getColor: (c: { textMuted: string }) => c.textMuted },
  error: { label: 'Error', getColor: (c: { error: string }) => c.error },
  reconnecting: { label: 'Reconnecting...', getColor: (c: { warning: string }) => c.warning },
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
  const termBg = dark ? terminalColorsDark.bg : terminalColorsLight.bg;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: termBg,
        },
        container: {
          flex: 1,
          backgroundColor: termBg,
        },
        headerBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
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
    [colors, radii, spacing, termBg, typography],
  );

  // ── Reconnecting pulse ──
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
        <StatusBar backgroundColor={termBg} style={dark ? 'light' : 'dark'} />
        {headerBar}
        <View style={styles.centered}>
          <Text style={styles.title}>No Default Server</Text>
          <Text style={styles.description}>
            Set up a server in the Servers tab.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar backgroundColor={termBg} style={dark ? 'light' : 'dark'} />
      {headerBar}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={styles.container}
      >
        <TerminalWebView ref={terminalRef} server={server} sessionId={sessionId} onStatusChange={setStatus} />
        <SpecialKeys onKeyPress={(data) => terminalRef.current?.sendInput(data)} server={server} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
