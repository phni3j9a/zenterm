import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/theme';

export interface RowActionsMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export interface RowActionsMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  items: RowActionsMenuItem[];
  onClose: () => void;
}

export function RowActionsMenu({ open, anchorEl, items, onClose }: RowActionsMenuProps) {
  const { tokens } = useTheme();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 160;
    const flipLeft = rect.right + menuWidth > window.innerWidth;
    setPosition({
      top: rect.bottom + 4,
      left: flipLeft ? rect.right - menuWidth : rect.left,
    });
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      if (anchorEl && target && anchorEl.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open, anchorEl, onClose]);

  if (!open || !position) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        minWidth: 160,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        padding: tokens.spacing.xs,
        zIndex: 100,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onClick();
            onClose();
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
            background: 'transparent',
            color: item.destructive ? tokens.colors.error : tokens.colors.textPrimary,
            border: 'none',
            borderRadius: tokens.radii.sm,
            cursor: 'pointer',
            fontSize: tokens.typography.smallMedium.fontSize,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
