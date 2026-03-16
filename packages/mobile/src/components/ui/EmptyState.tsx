import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/src/theme';

import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.container, { padding: spacing['4xl'] }]} testID="empty-state-root">
      <Ionicons color={colors.textMuted} name={icon} size={56} />
      <Text style={[typography.heading, styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[typography.body, styles.description, { color: colors.textSecondary }]}>{description}</Text>

      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 16,
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
  },
  action: {
    marginTop: 24,
    width: '100%',
    maxWidth: 240,
  },
});
