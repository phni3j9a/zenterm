import { useMemo, useState } from 'react';
import { ApiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { AppearanceSection } from './AppearanceSection';
import { TerminalSection } from './TerminalSection';
import { GatewaySection } from './GatewaySection';
import { SystemStatusSection } from './SystemStatusSection';
import { RateLimitsSection } from './RateLimitsSection';

function SectionPlaceholder({ titleKey, ariaLabel }: { titleKey: string; ariaLabel: string }) {
  const { tokens } = useTheme();
  return (
    <Card variant="elevated" padding="lg" aria-labelledby="settings-rate-limits">
      <h3
        id="settings-rate-limits"
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
        {ariaLabel}
      </div>
    </Card>
  );
}

export function SettingsPanel() {
  const { tokens } = useTheme();
  const auth = useAuthStore();
  const [gatewayVersion, setGatewayVersion] = useState<string | null>(null);

  const client = useMemo(() => {
    if (!auth.gatewayUrl || !auth.token) return null;
    return new ApiClient(auth.gatewayUrl, auth.token);
  }, [auth.gatewayUrl, auth.token]);

  return (
    <div style={{
      padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px ${tokens.spacing.xl}px`,
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.lg,
    }}>
      <Card variant="elevated" padding="lg" aria-labelledby="settings-appearance">
        <AppearanceSection headingId="settings-appearance" />
      </Card>
      <Card variant="elevated" padding="lg" aria-labelledby="settings-terminal">
        <TerminalSection headingId="settings-terminal" />
      </Card>
      <Card variant="elevated" padding="lg" aria-labelledby="settings-gateway">
        <GatewaySection gatewayVersion={gatewayVersion} headingId="settings-gateway" />
      </Card>
      <Card variant="elevated" padding="lg" aria-labelledby="settings-system-status">
        <SystemStatusSection client={client} onGatewayVersion={setGatewayVersion} headingId="settings-system-status" />
      </Card>
      {client ? (
        <Card variant="elevated" padding="lg" aria-labelledby="settings-rate-limits">
          <RateLimitsSection client={client} headingId="settings-rate-limits" />
        </Card>
      ) : (
        <SectionPlaceholder titleKey="Rate limits" ariaLabel="Rate limits" />
      )}
    </div>
  );
}
