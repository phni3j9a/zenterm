import React from 'react';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/src/theme';

interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
}

const sizeMap = {
  md: 48,
  sm: 38,
} as const;

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  onPress,
}: ButtonProps) {
  const { colors, radii, spacing, typography } = useTheme();
  const isDisabled = disabled || loading;

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const getColors = (pressed: boolean) => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: pressed ? colors.surfaceHover : 'transparent',
          borderColor: colors.border,
          textColor: colors.textPrimary,
          indicatorColor: colors.primary,
          borderWidth: 1,
        };
      case 'danger':
        return {
          backgroundColor: pressed ? colors.errorSubtle : 'transparent',
          borderColor: colors.error,
          textColor: colors.error,
          indicatorColor: colors.error,
          borderWidth: 1,
        };
      case 'ghost':
        return {
          backgroundColor: pressed ? colors.primarySubtle : 'transparent',
          borderColor: 'transparent',
          textColor: colors.primary,
          indicatorColor: colors.primary,
          borderWidth: 0,
        };
      case 'primary':
      default:
        return {
          backgroundColor: pressed ? colors.primaryActive : colors.primary,
          borderColor: 'transparent',
          textColor: colors.textInverse,
          indicatorColor: colors.textInverse,
          borderWidth: 0,
        };
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={handlePress}
      testID="button-root"
      style={({ pressed }) => {
        const palette = getColors(pressed);
        return [
          styles.base,
          {
            height: sizeMap[size],
            borderRadius: radii.sm,
            paddingHorizontal: size === 'md' ? spacing.lg : spacing.md,
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
            borderWidth: palette.borderWidth,
            opacity: isDisabled ? 0.5 : 1,
          },
        ];
      }}
    >
      {({ pressed }) => {
        const palette = getColors(pressed);
        return (
          <View style={styles.content}>
            {loading ? <ActivityIndicator color={palette.indicatorColor} /> : null}
            {!loading && icon ? <View style={styles.icon}>{icon}</View> : null}
            {!loading ? (
              <Text
                style={[
                  size === 'md' ? typography.bodyMedium : typography.captionMedium,
                  { color: palette.textColor },
                ]}
                testID="button-label"
              >
                {label}
              </Text>
            ) : null}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
