import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '@/stores/settings';
import type { TerminalStatus, ReconnectInfo } from './XtermView';
import { Tooltip } from '@/components/ui/Tooltip';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { IconRefresh, IconWifi, IconWifiOff } from '@/components/ui/icons';

export interface TerminalHeaderProps {
  sessionId: string;
  displayName: string;
  windowName: string;
  status: TerminalStatus;
  reconnectInfo: ReconnectInfo | null;
  fontSize: number;
  onReconnect: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function TerminalHeader({
  sessionId,
  displayName,
  windowName,
  status,
  reconnectInfo,
  fontSize,
  onReconnect,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: TerminalHeaderProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

  const badgeTone = (() => {
    switch (status) {
      case 'connected': return 'success' as const;
      case 'reconnecting': return 'warning' as const;
      case 'error': return 'error' as const;
      default: return 'neutral' as const;
    }
  })();

  const showReconnectBtn = status === 'disconnected' || status === 'reconnecting' || status === 'error';
  const showEta = status === 'reconnecting' && reconnectInfo && !reconnectInfo.exhausted;

  const stepBtn = (disabled: boolean) => ({
    background: tokens.colors.surface,
    border: `1px solid ${tokens.colors.border}`,
    color: tokens.colors.textPrimary,
    width: 24,
    height: 24,
    borderRadius: tokens.radii.sm,
    cursor: disabled ? ('not-allowed' as const) : ('pointer' as const),
    opacity: disabled ? 0.4 : 1,
    fontSize: tokens.typography.caption.fontSize,
  });

  const labelText = displayName && displayName.length > 0 ? displayName : sessionId;

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: `0 ${tokens.spacing.lg}px`,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: tokens.typography.bodyMedium.fontSize }}>
        {labelText}
      </span>
      {windowName && (
        <span style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.smallMedium.fontSize }}>
          {windowName}
        </span>
      )}
      <span style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs }}>
        <Tooltip label={t('terminal.zoomOut')}>
          <button
            type="button"
            aria-label={t('terminal.zoomOut')}
            onClick={onZoomOut}
            disabled={fontSize <= MIN_FONT_SIZE}
            style={stepBtn(fontSize <= MIN_FONT_SIZE)}
          >
            −
          </button>
        </Tooltip>
        <Tooltip label={t('terminal.zoomReset')}>
          <button
            type="button"
            aria-label={t('terminal.zoomReset')}
            onClick={onZoomReset}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.textPrimary,
              cursor: 'pointer',
              minWidth: 24,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              fontSize: tokens.typography.caption.fontSize,
            }}
          >
            {fontSize}
          </button>
        </Tooltip>
        <Tooltip label={t('terminal.zoomIn')}>
          <button
            type="button"
            aria-label={t('terminal.zoomIn')}
            onClick={onZoomIn}
            disabled={fontSize >= MAX_FONT_SIZE}
            style={stepBtn(fontSize >= MAX_FONT_SIZE)}
          >
            +
          </button>
        </Tooltip>
      </div>

      {showEta && reconnectInfo && (
        <span
          data-testid="terminal-reconnect-eta"
          style={{
            color: tokens.colors.textMuted,
            fontSize: tokens.typography.caption.fontSize,
            marginLeft: tokens.spacing.sm,
          }}
        >
          {t('terminal.reconnectingEta', {
            seconds: Math.max(1, Math.ceil(reconnectInfo.etaMs / 1000)),
            attempt: reconnectInfo.attempt,
          })}
        </span>
      )}

      {showReconnectBtn && (
        <IconButton
          icon={<IconRefresh size={14} />}
          label={t('terminal.reconnect')}
          size="sm"
          variant="outline"
          onClick={onReconnect}
        />
      )}

      <span
        aria-label={`Connection ${t(`terminal.status.${status}` as 'terminal.status.connected')}`}
        style={{ marginLeft: tokens.spacing.sm }}
      >
        <Badge
          tone={badgeTone}
          icon={status === 'connected' ? <IconWifi size={12} /> : <IconWifiOff size={12} />}
        >
          {t(`terminal.status.${status}` as 'terminal.status.connected')}
        </Badge>
      </span>
    </header>
  );
}
