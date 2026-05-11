import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TmuxWindow } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { validateSessionOrWindowName, nameValidationKey } from '@/lib/validateName';
import { RowActionsMenu } from './RowActionsMenu';

export interface WindowRowProps {
  sessionDisplayName: string;
  window: TmuxWindow;
  isActive: boolean;
  isOccupiedElsewhere: boolean;
  openInPaneOptions: number[]; // 0-based pane indices
  onSelect: () => void;
  onRename: (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ) => void | Promise<void>;
  onRequestDelete: (sessionDisplayName: string, window: TmuxWindow) => void;
  onOpenInPane: (paneIndex: number) => void;
}

type RowMode = 'idle' | 'editing-name';

export function WindowRow({
  sessionDisplayName,
  window,
  isActive,
  isOccupiedElsewhere,
  openInPaneOptions,
  onSelect,
  onRename,
  onRequestDelete,
  onOpenInPane,
}: WindowRowProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<RowMode>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const kebabRef = useRef<HTMLButtonElement | null>(null);
  const showKebab = hover || menuOpen;

  const openInItems = openInPaneOptions.map((idx) => ({
    label: t('sessions.openInPane.label', { pane: idx + 1 }),
    onClick: () => onOpenInPane(idx),
  }));
  const baseItems = [
    { label: t('common.rename'), onClick: () => setMode('editing-name') },
    {
      label: t('common.delete'),
      onClick: () => onRequestDelete(sessionDisplayName, window),
      destructive: true,
    },
  ];
  const items = [...openInItems, ...baseItems];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      <button
        type="button"
        aria-current={isActive ? 'true' : undefined}
        disabled={isOccupiedElsewhere}
        onClick={!isOccupiedElsewhere ? onSelect : undefined}
        style={{
          flex: 1,
          textAlign: 'left',
          padding: tokens.spacing.xs,
          background: isActive ? tokens.colors.primarySubtle : 'transparent',
          border: 'none',
          color: tokens.colors.textSecondary,
          cursor: isOccupiedElsewhere ? 'not-allowed' : 'pointer',
          opacity: isOccupiedElsewhere ? 0.5 : 1,
          fontSize: tokens.typography.smallMedium.fontSize,
        }}
      >
        {mode === 'editing-name' ? (
          <InlineEdit
            value={window.name}
            validate={(name) => { const e = validateSessionOrWindowName(name); return e ? t(nameValidationKey(e)) : null; }}
            ariaLabel={t('common.rename') + ' ' + window.name}
            onSave={async (next) => {
              await onRename(sessionDisplayName, window.index, next);
              setMode('idle');
            }}
            onCancel={() => setMode('idle')}
          />
        ) : (
          `${isOccupiedElsewhere ? '⛔ ' : ''}${window.name}`
        )}
      </button>
      <button
        ref={kebabRef}
        type="button"
        aria-label={t('sessions.actionsFor', { type: 'window', name: window.name })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(true);
        }}
        style={{
          padding: tokens.spacing.xs,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: tokens.colors.textMuted,
          visibility: showKebab ? 'visible' : 'hidden',
        }}
      >
        ⋯
      </button>
      <RowActionsMenu
        open={menuOpen}
        anchorEl={kebabRef.current}
        items={items}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
