import { useEffect, useRef, type ReactNode } from 'react';
import { useTheme } from '@/theme';
import { clampRatio } from '@/lib/paneLayout';

export type SplitOrientation = 'horizontal' | 'vertical';

export interface SplitPaneProps {
  orientation: SplitOrientation;
  ratio: number;
  onRatioChange: (next: number) => void;
  first: ReactNode;
  second: ReactNode;
}

export function SplitPane({
  orientation,
  ratio,
  onRatioChange,
  first,
  second,
}: SplitPaneProps) {
  const { tokens } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingRatioRef = useRef<number | null>(null);
  const onRatioChangeRef = useRef(onRatioChange);

  useEffect(() => {
    onRatioChangeRef.current = onRatioChange;
  }, [onRatioChange]);

  const isVertical = orientation === 'vertical';
  const clampedRatio = clampRatio(ratio);
  const firstSize = `${(clampedRatio * 100).toFixed(4)}%`;
  const secondSize = `${((1 - clampedRatio) * 100).toFixed(4)}%`;

  // Stable handler refs so addEventListener / removeEventListener can be paired
  // even if onRatioChange changes during a drag.
  const moveHandlerRef = useRef<(ev: PointerEvent) => void>(() => {});
  const upHandlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    const commit = () => {
      if (pendingRatioRef.current !== null) {
        onRatioChangeRef.current(pendingRatioRef.current);
        pendingRatioRef.current = null;
      }
      rafRef.current = null;
    };

    moveHandlerRef.current = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const total = isVertical ? rect.width : rect.height;
      if (total <= 0) return;
      const offset = isVertical ? ev.clientX - rect.left : ev.clientY - rect.top;
      const next = clampRatio(offset / total);
      pendingRatioRef.current = next;
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(commit);
      }
    };

    upHandlerRef.current = () => {
      draggingRef.current = false;
      window.removeEventListener('pointermove', moveHandlerRef.current);
      window.removeEventListener('pointerup', upHandlerRef.current);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        commit();
      }
    };
  }, [isVertical]);

  useEffect(() => {
    return () => {
      // On unmount: stop any in-flight rAF and detach the currently-installed handlers.
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener('pointermove', moveHandlerRef.current);
      window.removeEventListener('pointerup', upHandlerRef.current);
      draggingRef.current = false;
    };
  }, []);

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    ev.preventDefault();
    window.addEventListener('pointermove', moveHandlerRef.current);
    window.addEventListener('pointerup', upHandlerRef.current);
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'row' : 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexBasis: firstSize,
          flexGrow: 0,
          flexShrink: 0,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={orientation}
        onPointerDown={onPointerDown}
        style={{
          flexBasis: 6,
          flexGrow: 0,
          flexShrink: 0,
          background: tokens.colors.borderSubtle,
          cursor: isVertical ? 'col-resize' : 'row-resize',
          touchAction: 'none',
        }}
      />
      <div
        style={{
          flexBasis: secondSize,
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {second}
      </div>
    </div>
  );
}
