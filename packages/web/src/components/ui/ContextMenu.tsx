import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/theme';

export interface ContextMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  shortcut?: string;
}

export interface ContextMenuProps {
  open: boolean;
  /** Absolute viewport position (fixed coordinates). Used when no anchorEl provided. */
  anchorPoint?: { x: number; y: number };
  /** Element to anchor below. Takes precedence over anchorPoint. */
  anchorEl?: HTMLElement | null;
  items: ContextMenuItem[];
  onClose: () => void;
  ariaLabel?: string;
}

export function ContextMenu({
  open,
  anchorPoint,
  anchorEl,
  items,
  onClose,
  ariaLabel,
}: ContextMenuProps) {
  const { tokens } = useTheme();
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Compute position
  let left = anchorPoint?.x ?? 0;
  let top = anchorPoint?.y ?? 0;
  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    left = rect.left;
    top = rect.bottom + 4;
  }

  // Flip at viewport edges (rough estimate: 160w x 200h)
  const menuWidth = 160;
  const menuHeight = 200;
  if (left + menuWidth > window.innerWidth) left = left - menuWidth;
  if (top + menuHeight > window.innerHeight) top = top - menuHeight;

  useEffect(() => {
    if (!open) return;

    // Focus the first enabled menuitem when menu opens
    const menuEl = menuRef.current;
    if (menuEl) {
      const allItems = Array.from(menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      const firstEnabled = allItems.find((el) => el.getAttribute('aria-disabled') !== 'true');
      firstEnabled?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const menuEl = menuRef.current;
        if (!menuEl) return;
        const allItems = Array.from(menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        const enabledItems = allItems.filter((el) => el.getAttribute('aria-disabled') !== 'true');
        if (enabledItems.length === 0) return;
        const currentIndex = enabledItems.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown') {
          const next = (currentIndex + 1) % enabledItems.length;
          enabledItems[next].focus();
        } else {
          const prev = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
          enabledItems[prev].focus();
        }
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        left,
        top,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        padding: tokens.spacing.xs,
        zIndex: 1000,
        minWidth: menuWidth,
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          aria-disabled={item.disabled ? 'true' : undefined}
          tabIndex={item.disabled ? -1 : 0}
          onClick={
            item.disabled
              ? undefined
              : () => {
                  item.onSelect();
                  onClose();
                }
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
            background: 'transparent',
            border: 'none',
            borderRadius: tokens.radii.sm,
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            color: item.destructive
              ? tokens.colors.error
              : item.disabled
                ? tokens.colors.textMuted
                : tokens.colors.textPrimary,
            fontSize: tokens.typography.smallMedium.fontSize,
            textAlign: 'left',
            opacity: item.disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) {
              (e.currentTarget as HTMLButtonElement).style.background =
                tokens.colors.surfaceHover;
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span
              style={{
                marginLeft: tokens.spacing.md,
                color: tokens.colors.textMuted,
                fontSize: tokens.typography.small.fontSize,
              }}
            >
              {item.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}
