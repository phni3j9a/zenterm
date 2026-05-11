import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { usePaneStore } from '@/stores/pane';
import { LAYOUT_MODES, type LayoutMode } from '@/lib/paneLayout';

const I18N_KEY: Record<LayoutMode, string> = {
  single: 'terminal.layout.single',
  'cols-2': 'terminal.layout.cols2',
  'cols-3': 'terminal.layout.cols3',
  'grid-2x2': 'terminal.layout.grid2x2',
  'main-side-2': 'terminal.layout.mainSide2',
};

export function LayoutSelector() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const layout = usePaneStore((s) => s.layout);
  const setLayout = usePaneStore((s) => s.setLayout);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('terminal.layout.menuLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          background: tokens.colors.surface,
          color: tokens.colors.textPrimary,
          border: `1px solid ${tokens.colors.border}`,
          padding: `2px 8px`,
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.caption.fontSize,
          cursor: 'pointer',
        }}
      >
        ⊟▾
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: tokens.colors.bgElevated,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radii.md,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: tokens.spacing.xs,
            minWidth: 180,
            zIndex: 100,
          }}
        >
          {LAYOUT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              aria-checked={mode === layout}
              onClick={() => {
                setLayout(mode);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
                background: mode === layout ? tokens.colors.primarySubtle : 'transparent',
                color: tokens.colors.textPrimary,
                border: 'none',
                borderRadius: tokens.radii.sm,
                cursor: 'pointer',
                fontSize: tokens.typography.smallMedium.fontSize,
              }}
            >
              {t(I18N_KEY[mode])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
