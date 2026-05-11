import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '@/stores/settings';
import type { TerminalStatus, ReconnectInfo } from './XtermView';

export interface TerminalHeaderProps {
  sessionId: string;
  windowIndex: number;
  displayName: string;
  windowName: string;
  status: TerminalStatus;
  reconnectInfo: ReconnectInfo | null;
  fontSize: number;
  onReconnect: () => void;
  onCopySessionId: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  layoutSlot?: ReactNode;
}

export function TerminalHeader({
  sessionId,
  windowIndex,
  displayName,
  windowName,
  status,
  reconnectInfo,
  fontSize,
  onReconnect,
  onCopySessionId,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  layoutSlot,
}: TerminalHeaderProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

  const statusColor: string = (() => {
    switch (status) {
      case 'connected': return tokens.colors.success;
      case 'reconnecting': return tokens.colors.warning;
      case 'error': return tokens.colors.error;
      default: return tokens.colors.textMuted;
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
      <span style={{ color: tokens.colors.textMuted, fontSize: tokens.typography.smallMedium.fontSize }}>
        [w{windowIndex}]
      </span>
      {layoutSlot}
      <button
        type="button"
        aria-label={t('terminal.copySessionId')}
        onClick={onCopySessionId}
        style={{
          background: 'transparent',
          border: `1px solid ${tokens.colors.borderSubtle}`,
          color: tokens.colors.textSecondary,
          padding: `2px 8px`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.caption.fontSize,
          cursor: 'pointer',
        }}
      >
        ID
      </button>
      <span style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs }}>
        <button
          type="button"
          aria-label={t('terminal.zoomOut')}
          onClick={onZoomOut}
          disabled={fontSize <= MIN_FONT_SIZE}
          style={stepBtn(fontSize <= MIN_FONT_SIZE)}
        >
          −
        </button>
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
        <button
          type="button"
          aria-label={t('terminal.zoomIn')}
          onClick={onZoomIn}
          disabled={fontSize >= MAX_FONT_SIZE}
          style={stepBtn(fontSize >= MAX_FONT_SIZE)}
        >
          +
        </button>
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
        <button
          type="button"
          aria-label={t('terminal.reconnect')}
          onClick={onReconnect}
          style={{
            background: tokens.colors.surface,
            color: tokens.colors.textPrimary,
            border: `1px solid ${tokens.colors.border}`,
            padding: `4px 10px`,
            borderRadius: tokens.radii.sm,
            fontSize: tokens.typography.caption.fontSize,
            cursor: 'pointer',
            marginLeft: tokens.spacing.sm,
          }}
        >
          ↺ {t('terminal.reconnect')}
        </button>
      )}

      <span
        aria-label={`Connection ${t(`terminal.status.${status}` as 'terminal.status.connected')}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: tokens.spacing.xs,
          marginLeft: tokens.spacing.sm,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
          }}
        />
        <span style={{ color: tokens.colors.textSecondary, fontSize: tokens.typography.caption.fontSize }}>
          {t(`terminal.status.${status}` as 'terminal.status.connected')}
        </span>
      </span>
    </header>
  );
}
