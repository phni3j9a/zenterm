import type { ReactNode } from 'react';
import { useTheme } from '@/theme';

export type StepStatus = 'pending' | 'current' | 'done';
export interface StepperStep {
  title: string;
  description?: ReactNode;
  status: StepStatus;
}
export interface StepperProps {
  steps: StepperStep[];
}

export function Stepper({ steps }: StepperProps) {
  const { tokens } = useTheme();
  return (
    <ol
      role="list"
      style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}
    >
      {steps.map((s, i) => (
        <li
          key={i}
          aria-current={s.status === 'current' ? 'step' : undefined}
          style={{ display: 'flex', gap: tokens.spacing.md, alignItems: 'flex-start' }}
        >
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background:
                s.status === 'done'
                  ? tokens.colors.primary
                  : s.status === 'current'
                    ? tokens.colors.primarySubtle
                    : tokens.colors.surface,
              color:
                s.status === 'done' ? tokens.colors.textInverse : tokens.colors.textPrimary,
              border: `1px solid ${s.status === 'current' ? tokens.colors.primary : tokens.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: tokens.typography.smallMedium.fontSize,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {s.status === 'done' ? '✓' : i + 1}
          </div>
          <div>
            <div
              style={{
                fontSize: tokens.typography.bodyMedium.fontSize,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
              }}
            >
              {s.title}
            </div>
            {s.description && (
              <div
                style={{
                  marginTop: tokens.spacing.xs,
                  fontSize: tokens.typography.small.fontSize,
                  color: tokens.colors.textSecondary,
                }}
              >
                {s.description}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
