import { useRef, useState } from 'react';
import type { TmuxWindow } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { validateSessionOrWindowName } from '@/lib/validateName';
import { RowActionsMenu } from './RowActionsMenu';

export interface WindowRowProps {
  sessionDisplayName: string;
  window: TmuxWindow;
  isActive: boolean;
  onSelect: () => void;
  onRename: (
    sessionDisplayName: string,
    windowIndex: number,
    newName: string,
  ) => void | Promise<void>;
  onRequestDelete: (sessionDisplayName: string, window: TmuxWindow) => void;
}

type RowMode = 'idle' | 'editing-name';

export function WindowRow({
  sessionDisplayName,
  window,
  isActive,
  onSelect,
  onRename,
  onRequestDelete,
}: WindowRowProps) {
  const { tokens } = useTheme();
  const [mode, setMode] = useState<RowMode>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const kebabRef = useRef<HTMLButtonElement | null>(null);
  const showKebab = hover || menuOpen;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      <button
        type="button"
        aria-current={isActive ? 'true' : undefined}
        onClick={onSelect}
        style={{
          flex: 1,
          textAlign: 'left',
          padding: tokens.spacing.xs,
          background: isActive ? tokens.colors.primarySubtle : 'transparent',
          border: 'none',
          color: tokens.colors.textSecondary,
          cursor: 'pointer',
          fontSize: tokens.typography.smallMedium.fontSize,
        }}
      >
        {mode === 'editing-name' ? (
          <InlineEdit
            value={window.name}
            validate={validateSessionOrWindowName}
            ariaLabel="window 名を編集"
            onSave={async (next) => {
              await onRename(sessionDisplayName, window.index, next);
              setMode('idle');
            }}
            onCancel={() => setMode('idle')}
          />
        ) : (
          window.name
        )}
      </button>
      <button
        ref={kebabRef}
        type="button"
        aria-label={`Actions for window ${window.name}`}
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
        items={[
          { label: 'Rename', onClick: () => setMode('editing-name') },
          {
            label: 'Delete',
            onClick: () => onRequestDelete(sessionDisplayName, window),
            destructive: true,
          },
        ]}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
