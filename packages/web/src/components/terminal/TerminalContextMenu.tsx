import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

export interface TerminalContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  hasSelection: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onReconnect: () => void;
  onClose: () => void;
}

export function TerminalContextMenu({
  open,
  x,
  y,
  hasSelection,
  onCopy,
  onPaste,
  onClear,
  onReconnect,
  onClose,
}: TerminalContextMenuProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    const onMouseDown = (ev: MouseEvent) => {
      if (!ref.current) return;
      if (ev.target instanceof Node && ref.current.contains(ev.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const itemStyle = (disabled: boolean) => ({
    padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
    cursor: disabled ? ('not-allowed' as const) : ('pointer' as const),
    color: disabled ? tokens.colors.textMuted : tokens.colors.textPrimary,
    fontSize: tokens.typography.smallMedium.fontSize,
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    opacity: disabled ? 0.5 : 1,
  });

  const handleClick = (cb: () => void) => () => {
    cb();
    onClose();
  };

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        padding: tokens.spacing.xs,
        zIndex: 1000,
        minWidth: 160,
      }}
    >
      <button
        type="button"
        role="menuitem"
        aria-disabled={!hasSelection}
        disabled={!hasSelection}
        onClick={handleClick(onCopy)}
        style={itemStyle(!hasSelection)}
      >
        {t('terminal.menu.copy')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleClick(onPaste)}
        style={itemStyle(false)}
      >
        {t('terminal.menu.paste')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleClick(onClear)}
        style={itemStyle(false)}
      >
        {t('terminal.menu.clear')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleClick(onReconnect)}
        style={itemStyle(false)}
      >
        {t('terminal.menu.reconnect')}
      </button>
    </div>
  );
}
