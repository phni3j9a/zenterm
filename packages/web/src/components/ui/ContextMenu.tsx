import { useEffect, useRef, useCallback, useState } from 'react';
import styles from './ContextMenu.module.css';

export interface MenuItem {
  label: string;
  icon?: string;
  action: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Adjust position to stay within viewport
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      x: x + rect.width > vw ? Math.max(0, vw - rect.width - 8) : x,
      y: y + rect.height > vh ? Math.max(0, vh - rect.height - 8) : y,
    });
  }, [x, y]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Close on outside click, Escape, scroll, resize
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [handleClose]);

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && <div className={styles.divider} />}
          <button
            className={styles.item}
            data-variant={item.variant ?? 'default'}
            data-disabled={item.disabled ?? false}
            role="menuitem"
            onClick={() => {
              if (item.disabled) return;
              item.action();
              onClose();
            }}
          >
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            <span className={styles.label}>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
