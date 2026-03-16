import React from 'react';
import { Pressable, StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/src/theme';

interface CardProps {
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  children: React.ReactNode;
  highlighted?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({ accessibilityLabel, accessibilityRole, children, highlighted = false, onPress, onLongPress, style }: CardProps) {
  const { colors, dark, radii, shadows, spacing } = useTheme();
  const interactive = Boolean(onPress || onLongPress);

  const baseStyle: ViewStyle = {
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: highlighted ? colors.primarySubtle : colors.surface,
    borderWidth: 1,
    borderColor: highlighted ? colors.primary : dark ? colors.border : colors.borderSubtle,
    ...(dark ? {} : shadows.sm),
  };

  if (interactive) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole ?? 'button'}
        testID="card-root"
        delayLongPress={300}
        onLongPress={onLongPress}
        onPress={onPress}
        style={({ pressed }) => [baseStyle, pressed && styles.pressed, pressed && { backgroundColor: colors.surfaceHover }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole} testID="card-root" style={[baseStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.998 }],
  },
});
