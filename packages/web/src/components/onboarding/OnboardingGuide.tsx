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
    <div className="zen-ink-in" style={{ maxWidth: 480, margin: '0 auto' }}>
      <Card aria-labelledby="onboarding-title" padding="lg">
        <div className="zen-stagger" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing.sm,
            marginBottom: tokens.spacing.md,
            color: tokens.colors.primary,
          }}>
            <span
              aria-hidden
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: tokens.colors.primarySubtle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconRocket size={20} />
            </span>
            <h3 id="onboarding-title" className="zen-display" style={{
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
              alignSelf: 'flex-start',
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: tokens.colors.textMuted,
              cursor: 'pointer',
              fontSize: tokens.typography.small.fontSize,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {t('onboarding.dismiss')}
          </button>
        </div>
      </Card>
    </div>
  );
}
