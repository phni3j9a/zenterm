import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { Button, Card } from '@/src/components/ui';
import { useTheme } from '@/src/theme';

type SetupStep = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
};

const STEPS: readonly SetupStep[] = [
  {
    icon: 'terminal-outline',
    title: 'Start the Gateway',
    description: 'Just run npx zenterm-gateway on Mac or Linux. Token generation and setup are automatic.',
  },
  {
    icon: 'qr-code-outline',
    title: 'Scan the QR Code',
    description: 'Scan the QR code shown in the terminal at startup to auto-fill connection info.',
  },
  {
    icon: 'globe-outline',
    title: 'Also Available via Browser',
    description: 'No app needed — just visit http://<server-ip>:18765 in your browser.',
  },
];

const SETUP_COMMAND = 'npx zenterm-gateway setup';

type SetupGuideStyles = ReturnType<typeof createStyles>;

interface StepCardProps {
  index: number;
  step: SetupStep;
  styles: SetupGuideStyles;
}

function StepCard({ index, step, styles }: StepCardProps) {
  return (
    <Card>
      <View style={styles.stepCard}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepDescription}>{step.description}</Text>
        </View>
      </View>
    </Card>
  );
}

interface AutoStartCardProps {
  styles: SetupGuideStyles;
  colors: ReturnType<typeof useTheme>['colors'];
}

function AutoStartCard({ styles, colors }: AutoStartCardProps) {
  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(SETUP_COMMAND);
    Toast.show({ type: 'success', text1: 'Copied' });
  }, []);

  return (
    <Card>
      <View style={styles.stepCard}>
        <View style={styles.stepNumberOptional}>
          <Ionicons color={colors.textMuted} name="time-outline" size={16} />
        </View>
        <View style={styles.stepContent}>
          <View style={styles.optionalHeader}>
            <Text style={styles.stepTitle}>Auto-Start on Boot</Text>
            <Text style={styles.optionalBadge}>Optional</Text>
          </View>
          <Text style={styles.stepDescription}>
            To auto-start the gateway on boot, run the command below. It registers with launchd on macOS or systemd on Linux.
          </Text>
          <Pressable onPress={handleCopy} style={styles.commandChip}>
            <Text style={styles.commandText}>{SETUP_COMMAND}</Text>
            <Ionicons color={colors.textMuted} name="copy-outline" size={14} />
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

export function SetupGuide() {
  const { colors, radii, spacing, typography } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors, radii, spacing, typography), [colors, radii, spacing, typography]);

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.scrollView}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons color={colors.primary} name="rocket-outline" size={28} />
          </View>
          <Text style={styles.title}>Get Started</Text>
          <Text style={styles.subtitle}>
            Set up a connection to the gateway server to use the terminal and file browser.
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          {STEPS.map((step, index) => (
            <StepCard key={step.title} index={index} step={step} styles={styles} />
          ))}
          <AutoStartCard colors={colors} styles={styles} />
        </View>

        <Button
          icon={<Ionicons color={colors.textInverse} name="server-outline" size={16} />}
          label="Manage Servers"
          onPress={() => router.push('/servers')}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  radii: ReturnType<typeof useTheme>['radii'],
  spacing: ReturnType<typeof useTheme>['spacing'],
  typography: ReturnType<typeof useTheme>['typography'],
) {
  return StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing['2xl'],
      gap: spacing.xl,
    },
    header: {
      alignItems: 'center',
      gap: spacing.md,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySubtle,
    },
    title: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    stepsContainer: {
      gap: spacing.md,
    },
    stepCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    stepNumberText: {
      ...typography.captionMedium,
      color: colors.textInverse,
    },
    stepNumberOptional: {
      width: 28,
      height: 28,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepContent: {
      flex: 1,
      gap: spacing.xs,
    },
    stepTitle: {
      ...typography.bodyMedium,
      color: colors.textPrimary,
    },
    stepDescription: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    optionalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    optionalBadge: {
      ...typography.small,
      color: colors.textMuted,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: 1,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    commandChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
      alignSelf: 'flex-start',
    },
    commandText: {
      ...typography.mono,
      color: colors.textPrimary,
    },
  });
}
