import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useLayoutStore,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from '@/stores/layout';

const KEYBOARD_STEP = 16;

export function SidebarResizer() {
  const { t } = useTranslation();
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth);

  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const upHandlerRef = useRef<(() => void) | null>(null);

  const commit = useCallback(() => {
    rafRef.current = null;
    if (pendingRef.current !== null) {
      setSidebarWidth(pendingRef.current);
      pendingRef.current = null;
    }
  }, [setSidebarWidth]);

  useEffect(() => {
    return () => {
      if (moveHandlerRef.current) {
        window.removeEventListener('pointermove', moveHandlerRef.current);
      }
      if (upHandlerRef.current) {
        window.removeEventListener('pointerup', upHandlerRef.current);
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      pendingRef.current = ev.clientX;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(commit);
      }
    };
    const onUp = () => {
      draggingRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      commit();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      moveHandlerRef.current = null;
      upHandlerRef.current = null;
    };
    moveHandlerRef.current = onMove;
    upHandlerRef.current = onUp;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth(sidebarWidth - KEYBOARD_STEP);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth(sidebarWidth + KEYBOARD_STEP);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      aria-valuenow={sidebarWidth}
      aria-label={t('sidebar.resize')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        top: 0,
        right: -3,
        width: 6,
        height: '100%',
        cursor: 'col-resize',
        background: 'transparent',
        zIndex: 10,
        touchAction: 'none',
      }}
    />
  );
}
