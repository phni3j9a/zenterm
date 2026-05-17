import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Card } from '../ui/Card';
import { Stepper, type StepperStep } from '../ui/Stepper';
import { IconRocket } from '../ui/icons';

export interface OnboardingGuideProps {
  tokenEntered: boolean;
  sessionsCount: number;
  onDismiss: () => void;
}

export function OnboardingGuide({ tokenEntered, sessionsCount, onDismiss }: OnboardingGuideProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const steps: StepperStep[] = [
    {
      title: t('onboarding.step1.title'),
      description: (
        <code style={{
          display: 'inline-block',
          padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
          background: tokens.colors.surface,
          borderRadius: tokens.radii.sm,
          fontFamily: tokens.typography.mono.fontFamily,
          fontSize: tokens.typography.small.fontSize,
          wordBreak: 'break-all',
          maxWidth: '100%',
        }}>curl -fsSL https://github.com/phni3j9a/zenterm/releases/latest/download/install.sh | bash</code>
      ),
      status: 'done',
    },
    {
      title: t('onboarding.step2.title'),
      description: t('onboarding.step2.description'),
      status: tokenEntered ? 'done' : 'current',
    },
    {
      title: t('onboarding.step3.title'),
      description: t('onboarding.step3.description'),
      status: sessionsCount > 0 ? 'done' : tokenEntered ? 'current' : 'pending',
    },
  ];
  return (
    <Card aria-labelledby="onboarding-title" padding="lg" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        marginBottom: tokens.spacing.md,
        color: tokens.colors.primary,
      }}>
        <IconRocket size={24} aria-hidden />
        <h3 id="onboarding-title" style={{
          margin: 0,
          fontSize: tokens.typography.heading.fontSize,
          color: tokens.colors.textPrimary,
        }}>
          {t('onboarding.title')}
        </h3>
      </div>
      <Stepper steps={steps} />
      <button
        type="button"
        onClick={onDismiss}
        style={{
          marginTop: tokens.spacing.lg,
          background: 'transparent',
          border: 'none',
          color: tokens.colors.textMuted,
          cursor: 'pointer',
          fontSize: tokens.typography.small.fontSize,
          textDecoration: 'underline',
        }}
      >
        {t('onboarding.dismiss')}
      </button>
    </Card>
  );
}
