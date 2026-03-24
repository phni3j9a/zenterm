import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/src/theme';

interface CardProps {
  accessibilityActions?: readonly AccessibilityActionInfo[];
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  children: React.ReactNode;
  highlighted?: boolean;
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  accessibilityActions,
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  children,
  highlighted = false,
  onAccessibilityAction,
  onPress,
  onLongPress,
  style,
}: CardProps) {
  const { colors, radii, spacing } = useTheme();
  const interactive = Boolean(onPress || onLongPress);

  const baseStyle: ViewStyle = {
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: highlighted ? colors.primarySubtle : colors.surface,
  };

  if (interactive) {
    return (
      <Pressable
        accessibilityActions={accessibilityActions}
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityState={accessibilityState}
        testID="card-root"
        delayLongPress={300}
        onAccessibilityAction={onAccessibilityAction}
        onLongPress={onLongPress}
        onPress={onPress}
        style={({ pressed }) => [baseStyle, pressed && styles.pressed, pressed && { backgroundColor: colors.surfaceHover }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityActions={accessibilityActions}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      testID="card-root"
      onAccessibilityAction={onAccessibilityAction}
      style={[baseStyle, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.998 }],
  },
});
