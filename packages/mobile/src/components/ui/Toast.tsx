import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast, { BaseToast, type ToastConfig as ToastConfigMap } from 'react-native-toast-message';

import { useTheme } from '@/src/theme';

type ToastVariant = 'success' | 'error' | 'info';

export function ToastConfig() {
  const { colors, radii, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const config = useMemo<ToastConfigMap>(
    () => ({
      success: ({ text1, text2, ...rest }) => (
        <BaseToast
          {...rest}
          contentContainerStyle={styles.content}
          renderLeadingIcon={() => (
            <View style={[styles.iconWrap, { marginLeft: spacing.md }]}>
              <Ionicons color={colors.success} name="checkmark-circle" size={20} />
            </View>
          )}
          style={createToastStyle('success', colors, radii, spacing)}
          text1={text1}
          text1NumberOfLines={2}
          text1Style={[typography.captionMedium, styles.textPrimary, { color: colors.textPrimary }]}
          text2={text2}
          text2NumberOfLines={2}
          text2Style={[typography.small, styles.textSecondary, { color: colors.textSecondary }]}
        />
      ),
      error: ({ text1, text2, ...rest }) => (
        <BaseToast
          {...rest}
          contentContainerStyle={styles.content}
          renderLeadingIcon={() => (
            <View style={[styles.iconWrap, { marginLeft: spacing.md }]}>
              <Ionicons color={colors.error} name="alert-circle" size={20} />
            </View>
          )}
          style={createToastStyle('error', colors, radii, spacing)}
          text1={text1}
          text1NumberOfLines={2}
          text1Style={[typography.captionMedium, styles.textPrimary, { color: colors.textPrimary }]}
          text2={text2}
          text2NumberOfLines={2}
          text2Style={[typography.small, styles.textSecondary, { color: colors.textSecondary }]}
        />
      ),
      info: ({ text1, text2, ...rest }) => (
        <BaseToast
          {...rest}
          contentContainerStyle={styles.content}
          renderLeadingIcon={() => (
            <View style={[styles.iconWrap, { marginLeft: spacing.md }]}>
              <Ionicons color={colors.info} name="information-circle" size={20} />
            </View>
          )}
          style={createToastStyle('info', colors, radii, spacing)}
          text1={text1}
          text1NumberOfLines={2}
          text1Style={[typography.captionMedium, styles.textPrimary, { color: colors.textPrimary }]}
          text2={text2}
          text2NumberOfLines={2}
          text2Style={[typography.small, styles.textSecondary, { color: colors.textSecondary }]}
        />
      ),
    }),
    [colors, radii, spacing, typography],
  );

  return <Toast bottomOffset={insets.bottom + 72} config={config} keyboardOffset={spacing.lg} position="bottom" />;
}

function createToastStyle(
  variant: ToastVariant,
  colors: ReturnType<typeof useTheme>['colors'],
  radii: ReturnType<typeof useTheme>['radii'],
  spacing: ReturnType<typeof useTheme>['spacing'],
) {
  const backgroundColor =
    variant === 'success' ? colors.successSubtle : variant === 'error' ? colors.errorSubtle : colors.infoSubtle;

  return {
    width: '92%' as const,
    minHeight: 0,
    borderLeftWidth: 0,
    borderRadius: radii.md,
    backgroundColor,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  };
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textPrimary: {
    marginBottom: 2,
  },
  textSecondary: {
    marginTop: 0,
  },
});
