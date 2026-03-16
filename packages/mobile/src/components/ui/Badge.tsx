import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/src/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'muted' | 'success' | 'error';
}

export function Badge({ label, variant = 'muted' }: BadgeProps) {
  const { colors, radii, typography } = useTheme();

  const palette = (() => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: colors.primarySubtle, textColor: colors.primary };
      case 'success':
        return { backgroundColor: colors.successSubtle, textColor: colors.success };
      case 'error':
        return { backgroundColor: colors.errorSubtle, textColor: colors.error };
      case 'muted':
      default:
        return { backgroundColor: colors.surfaceHover, textColor: colors.textSecondary };
    }
  })();

  return (
    <View
      style={[styles.container, { backgroundColor: palette.backgroundColor, borderRadius: radii.full }]}
      testID="badge-root"
    >
      <Text style={[typography.smallMedium, { color: palette.textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
