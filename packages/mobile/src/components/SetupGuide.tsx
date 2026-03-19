import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
    title: 'Gateway を起動',
    description: 'サーバー上で .env に AUTH_TOKEN を設定し、npm run dev:gateway で Gateway を起動します。',
  },
  {
    icon: 'add-circle-outline',
    title: 'サーバーを追加',
    description: 'Settings → サーバー管理で接続先の URL と Token を登録します。',
  },
  {
    icon: 'shield-checkmark-outline',
    title: '接続を確認',
    description: '認証テストボタンで接続が成功することを確認したら準備完了です。',
  },
];

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
          <Text style={styles.title}>はじめましょう</Text>
          <Text style={styles.subtitle}>
            Gateway サーバーへの接続を設定すると、ターミナルやファイル操作が使えるようになります。
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          {STEPS.map((step, index) => (
            <StepCard key={step.title} index={index} step={step} styles={styles} />
          ))}
        </View>

        <Button
          icon={<Ionicons color={colors.textInverse} name="server-outline" size={16} />}
          label="サーバー管理へ"
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
  });
}
