import { useTheme } from '@/theme';
import { AppearanceSection } from './AppearanceSection';
import { TerminalSection } from './TerminalSection';

function SectionPlaceholder({ titleKey, ariaLabel }: { titleKey: string; ariaLabel: string }) {
  const { tokens } = useTheme();
  return (
    <section
      role="region"
      aria-label={ariaLabel}
      style={{
        marginTop: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
        borderTop: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <h3
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: tokens.typography.caption.fontSize,
          color: tokens.colors.textMuted,
          margin: `0 0 ${tokens.spacing.sm}px 0`,
        }}
      >
        {titleKey}
      </h3>
      <div style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.small.fontSize }}>
        (placeholder)
      </div>
    </section>
  );
}

export function SettingsPanel() {
  const { tokens } = useTheme();
  return (
    <div style={{ padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px ${tokens.spacing.xl}px`, height: '100%', overflowY: 'auto' }}>
      <AppearanceSection />
      <TerminalSection />
      <SectionPlaceholder titleKey="Gateway" ariaLabel="Gateway" />
      <SectionPlaceholder titleKey="System status" ariaLabel="System status" />
      <SectionPlaceholder titleKey="Rate limits" ariaLabel="Rate limits" />
    </div>
  );
}
