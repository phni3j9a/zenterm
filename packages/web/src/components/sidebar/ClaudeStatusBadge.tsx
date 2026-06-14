import { useTranslation } from 'react-i18next';
import type { ClaudeWindowStatus } from '@zenterm/shared';
import { useTheme } from '@/theme';

export interface ClaudeStatusBadgeProps {
  status: ClaudeWindowStatus;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ClaudeStatusBadge({ status }: ClaudeStatusBadgeProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const isWorking = status.activity === 'working';
  const agent = status.agent ?? 'claude';
  const label = t(`sessions.${agent === 'codex' ? 'codexStatus' : 'claudeStatus'}.${status.activity}`);
  const tooltip = status.summary ? `${label} · ${status.summary}` : label;
  const color = isWorking ? tokens.colors.warning : tokens.colors.success;
  const animate = isWorking && !prefersReducedMotion();

  return (
    <span
      role="img"
      aria-label={label}
      title={tooltip}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: 8,
        height: 8,
        borderRadius: '50%',
        boxSizing: 'border-box',
        // working = 塗りドット + 鼓動 / waiting = リング(中空) + 静止
        background: isWorking ? color : 'transparent',
        border: isWorking ? 'none' : `2px solid ${color}`,
        animation: animate ? 'zen-status-pulse 1.6s ease-in-out infinite' : undefined,
      }}
    />
  );
}
