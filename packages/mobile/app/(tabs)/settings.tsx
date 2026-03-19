import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useMemo, type ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SystemStatus } from '@/src/components/SystemStatus';
import { Button, Card } from '@/src/components/ui';
import { useServersStore } from '@/src/stores/servers';
import { useSettingsStore } from '@/src/stores/settings';
import { useTheme, type ThemeMode } from '@/src/theme';

const STORAGE_KEY = 'palmsh_servers';
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;

type ThemeOption = {
  value: ThemeMode;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { colors, radii, spacing, typography } = useTheme();
  const router = useRouter();
  const server = useServersStore((state) => state.getDefaultServer());
  const clear = useServersStore((state) => state.clear);
  const resetSettings = useSettingsStore((state) => state.reset);
  const fontSize = useSettingsStore((state) => state.settings.fontSize);
  const themeMode = useSettingsStore((state) => state.settings.themeMode);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const appName = Constants.expoConfig?.name ?? 'palmsh-mobile';
  const version = Constants.expoConfig?.version ?? 'unknown';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        content: {
          paddingTop: spacing.md,
          paddingBottom: spacing['4xl'],
          gap: spacing.xl,
        },
        section: {},
        sectionHeader: {
          ...typography.smallMedium,
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.lg,
        },
        card: {
          gap: spacing.lg,
          marginHorizontal: spacing.lg,
        },
        settingLabel: {
          ...typography.bodyMedium,
          color: colors.textPrimary,
        },
        segmentedRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        segmentButton: {
          flex: 1,
          height: 44,
          borderRadius: radii.sm,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.xs,
        },
        segmentLabel: {
          ...typography.captionMedium,
        },
        fontRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        fontValueBlock: {
          flex: 1,
          gap: spacing.xs,
        },
        fontValue: {
          ...typography.heading,
          color: colors.textPrimary,
          fontSize: 28,
          lineHeight: 32,
        },
        fontRange: {
          ...typography.caption,
          color: colors.textMuted,
        },
        stepper: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        serverBlock: {
          gap: spacing.xs,
        },
        serverName: {
          ...typography.bodyMedium,
          color: colors.textPrimary,
        },
        serverUrl: {
          ...typography.mono,
          color: colors.textMuted,
        },
        serverPlaceholder: {
          ...typography.caption,
          color: colors.textMuted,
          fontStyle: 'italic',
        },
        footer: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
          alignItems: 'center',
          gap: spacing.xs,
        },
        footerTitle: {
          ...typography.captionMedium,
          color: colors.textMuted,
          textAlign: 'center',
        },
        footerMeta: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
        },
      }),
    [colors, radii, spacing, typography],
  );

  const confirmReset = () => {
    Alert.alert('全データ削除', '保存済みのサーバー情報と設定をすべて削除しますか。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await SecureStore.deleteItemAsync(STORAGE_KEY);
            clear();
            await resetSettings();
          })();
        },
      },
    ]);
  };

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
          <Text style={styles.sectionHeader}>外観</Text>
          <Card style={styles.card}>
            <Text style={styles.settingLabel}>テーマ</Text>
            <View style={styles.segmentedRow}>
              {THEME_OPTIONS.map((option) => {
                const selected = option.value === themeMode;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => selectTheme(option.value)}
                    style={({ pressed }) => [
                      styles.segmentButton,
                      {
                        backgroundColor: selected
                          ? pressed
                            ? colors.primaryActive
                            : colors.primary
                          : pressed
                            ? colors.surfaceHover
                            : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons color={selected ? colors.textInverse : colors.textSecondary} name={option.icon} size={16} />
                    <Text style={[styles.segmentLabel, { color: selected ? colors.textInverse : colors.textSecondary }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ターミナル</Text>
          <Card style={styles.card}>
            <Text style={styles.settingLabel}>フォントサイズ</Text>
            <View style={styles.fontRow}>
              <View style={styles.fontValueBlock}>
                <Text style={styles.fontValue}>{fontSize}</Text>
                <Text style={styles.fontRange}>
                  {MIN_FONT_SIZE} - {MAX_FONT_SIZE}
                </Text>
              </View>
              <View style={styles.stepper}>
                <Button disabled={fontSize <= MIN_FONT_SIZE} label="-" size="sm" variant="secondary" onPress={() => adjustFontSize(-1)} />
                <Button disabled={fontSize >= MAX_FONT_SIZE} label="+" size="sm" variant="secondary" onPress={() => adjustFontSize(1)} />
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>サーバー管理</Text>
          <Card style={styles.card} onPress={() => router.push('/servers')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                {server ? (
                  <View style={styles.serverBlock}>
                    <Text style={styles.serverName}>{server.name}</Text>
                    <Text style={styles.serverUrl}>{server.url}</Text>
                  </View>
                ) : (
                  <Text style={styles.serverPlaceholder}>タップしてサーバーを追加</Text>
                )}
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
            </View>
          </Card>
          {server && (
            <View style={{ marginTop: spacing.sm, marginHorizontal: spacing.lg }}>
              <SystemStatus server={server} />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>データ管理</Text>
          <Card style={styles.card}>
            <Button label="全データ削除" size="md" variant="danger" onPress={confirmReset} />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>アプリ情報</Text>
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>{appName}</Text>
            <Text style={styles.footerMeta}>Version {version}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
