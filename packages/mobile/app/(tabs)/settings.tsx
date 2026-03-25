import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useMemo, type ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SystemStatus } from '@/src/components/SystemStatus';
import { useServersStore } from '@/src/stores/servers';
import { useSettingsStore } from '@/src/stores/settings';
import { useTheme, type ThemeMode } from '@/src/theme';

const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 20;

type ThemeOption = {
  value: ThemeMode;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { colors, radii, spacing, typography } = useTheme();
  const router = useRouter();
  const server = useServersStore((state) => state.getDefaultServer());
  const fontSize = useSettingsStore((state) => state.settings.fontSize);
  const themeMode = useSettingsStore((state) => state.settings.themeMode);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const appName = Constants.expoConfig?.name ?? 'ZenTerm';
  const version = Constants.expoConfig?.version ?? 'unknown';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        content: {
          paddingTop: spacing.xs,
          paddingBottom: spacing['4xl'],
        },
        section: {
          marginBottom: spacing.xs,
        },
        sectionHeader: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: colors.textMuted,
          paddingTop: spacing.xl,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.xl,
        },
        settingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          minHeight: 48,
        },
        settingLabel: {
          ...typography.body,
          color: colors.textPrimary,
        },
        themeRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        themeButton: {
          paddingVertical: 8,
          paddingHorizontal: 20,
          borderRadius: radii.sm,
          borderWidth: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        themeLabel: {
          fontSize: 13,
          fontWeight: '500',
        },
        fontVal: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        fontNum: {
          fontSize: 18,
          fontWeight: '600',
          fontFamily: 'Menlo',
          color: colors.textPrimary,
          minWidth: 28,
          textAlign: 'center',
        },
        stepRow: {
          flexDirection: 'row',
          gap: spacing.xs,
        },
        stepButton: {
          width: 40,
          height: 36,
          borderRadius: radii.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
        stepButtonText: {
          fontSize: 17,
          fontWeight: '500',
          color: colors.textSecondary,
        },
        serverRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
        },
        serverIcon: {
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: colors.primarySubtle,
          alignItems: 'center',
          justifyContent: 'center',
        },
        serverBody: {
          flex: 1,
        },
        serverName: {
          ...typography.bodyMedium,
          color: colors.textPrimary,
        },
        serverUrl: {
          ...typography.mono,
          fontSize: 12,
          color: colors.textMuted,
          marginTop: 2,
        },
        serverPlaceholder: {
          ...typography.caption,
          color: colors.textMuted,
          fontStyle: 'italic',
        },
        footer: {
          paddingTop: spacing['2xl'],
          alignItems: 'center',
          gap: 1,
        },
        footerTitle: {
          fontSize: 12,
          letterSpacing: 1,
          color: colors.textMuted,
          textAlign: 'center',
        },
        footerMeta: {
          fontSize: 10,
          color: colors.textMuted,
          textAlign: 'center',
          opacity: 0.6,
        },
      }),
    [colors, radii, spacing, typography],
  );

  const adjustFontSize = (delta: number) => {
    const next = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSize + delta));
    if (next === fontSize) {
      return;
    }

    void updateSettings({ fontSize: next });
  };

  const selectTheme = (value: ThemeMode) => {
    if (value === themeMode) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void updateSettings({ themeMode: value });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Settings' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Appearance</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Theme</Text>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((option) => {
                const selected = option.value === themeMode;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => selectTheme(option.value)}
                    style={[
                      styles.themeButton,
                      {
                        backgroundColor: selected ? colors.primary : 'transparent',
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons color={selected ? colors.textInverse : colors.textSecondary} name={option.icon} size={15} />
                    <Text style={[styles.themeLabel, { color: selected ? colors.textInverse : colors.textSecondary }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Terminal</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Font Size</Text>
            <View style={styles.fontVal}>
              <Text style={styles.fontNum}>{fontSize}</Text>
              <View style={styles.stepRow}>
                <Pressable
                  disabled={fontSize <= MIN_FONT_SIZE}
                  onPress={() => adjustFontSize(-1)}
                  style={[styles.stepButton, { opacity: fontSize <= MIN_FONT_SIZE ? 0.4 : 1 }]}
                >
                  <Text style={styles.stepButtonText}>-</Text>
                </Pressable>
                <Pressable
                  disabled={fontSize >= MAX_FONT_SIZE}
                  onPress={() => adjustFontSize(1)}
                  style={[styles.stepButton, { opacity: fontSize >= MAX_FONT_SIZE ? 0.4 : 1 }]}
                >
                  <Text style={styles.stepButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Server</Text>
          <Pressable
            onPress={() => router.push('/servers')}
            style={({ pressed }) => [styles.serverRow, pressed && { backgroundColor: colors.surfaceHover }]}
          >
            <View style={styles.serverIcon}>
              <Ionicons color={colors.primary} name="server-outline" size={16} />
            </View>
            {server ? (
              <View style={styles.serverBody}>
                <Text style={styles.serverName}>{server.name}</Text>
                <Text style={styles.serverUrl}>{server.url}</Text>
              </View>
            ) : (
              <View style={styles.serverBody}>
                <Text style={styles.serverPlaceholder}>Tap to add a server</Text>
              </View>
            )}
            <Ionicons color={colors.textMuted} name="chevron-forward" size={16} style={{ opacity: 0.4 }} />
          </Pressable>
          {server && <SystemStatus server={server} />}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>{appName}</Text>
          <Text style={styles.footerMeta}>v{version}</Text>
          <Pressable
            onPress={() => Linking.openURL('https://github.com/phni3j9a/zenterm/blob/main/PRIVACY_POLICY.md')}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: spacing.xs })}
          >
            <Text style={[styles.footerMeta, { textDecorationLine: 'underline', color: colors.primary, opacity: 1 }]}>
              Privacy Policy
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
