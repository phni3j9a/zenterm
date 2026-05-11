import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TmuxSession } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { validateSessionOrWindowName, nameValidationKey } from '@/lib/validateName';
import { RowActionsMenu } from './RowActionsMenu';

export interface SessionRowProps {
  session: TmuxSession;
  isActive: boolean;
  isExpanded: boolean;
  onSelect: (sessionId: string, windowIndex?: number) => void;
  onToggleExpand: (sessionName: string) => void;
  onRename: (currentDisplayName: string, newName: string) => void | Promise<void>;
  onRequestDelete: (session: TmuxSession) => void;
}

type RowMode = 'idle' | 'editing-name';

export function SessionRow({
  session,
  isActive,
  isExpanded,
  onSelect,
  onToggleExpand,
  onRename,
  onRequestDelete,
}: SessionRowProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<RowMode>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const kebabRef = useRef<HTMLButtonElement | null>(null);

  const hasWindows = (session.windows?.length ?? 0) > 1;
  const showKebab = hover || menuOpen;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-current={isActive ? 'true' : undefined}
        onClick={() => onSelect(session.displayName, undefined)}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          padding: tokens.spacing.sm,
          margin: 0,
          background: isActive ? tokens.colors.primarySubtle : 'transparent',
          color: tokens.colors.textPrimary,
          border: 'none',
          borderRadius: tokens.radii.sm,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: tokens.colors.success,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          {mode === 'editing-name' ? (
            <InlineEdit
              value={session.displayName}
              validate={(name) => { const e = validateSessionOrWindowName(name); return e ? t(nameValidationKey(e)) : null; }}
              ariaLabel={t('common.rename') + ' ' + session.displayName}
              onSave={async (next) => {
                await onRename(session.displayName, next);
                setMode('idle');
              }}
              onCancel={() => setMode('idle')}
            />
          ) : (
            <>
              <span style={{ display: 'block', fontSize: tokens.typography.bodyMedium.fontSize }}>
                {session.displayName}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: tokens.typography.small.fontSize,
                  color: tokens.colors.textMuted,
                  fontFamily: tokens.typography.mono.fontFamily,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={session.cwd}
              >
                {session.cwd}
              </span>
            </>
          )}
        </span>
        {hasWindows && (
          <span
            role="button"
            tabIndex={0}
            aria-label={isExpanded ? t('sessions.collapseWindows') : t('sessions.expandWindows')}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(session.name);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleExpand(session.name);
              }
            }}
            style={{
              padding: tokens.spacing.xs,
              color: tokens.colors.textMuted,
              cursor: 'pointer',
              fontSize: tokens.typography.caption.fontSize,
            }}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
        )}
        <button
          ref={kebabRef}
          type="button"
          aria-label={t('sessions.actionsFor', { type: 'session', name: session.displayName })}
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
            fontSize: tokens.typography.bodyMedium.fontSize,
            visibility: showKebab ? 'visible' : 'hidden',
          }}
        >
          ⋯
        </button>
      </button>
      <RowActionsMenu
        open={menuOpen}
        anchorEl={kebabRef.current}
        items={[
          { label: t('common.rename'), onClick: () => setMode('editing-name') },
          { label: t('common.delete'), onClick: () => onRequestDelete(session), destructive: true },
        ]}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
