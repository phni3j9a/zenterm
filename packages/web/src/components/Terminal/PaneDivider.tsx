import { useRef, useCallback, useEffect } from 'react';
import styles from './PaneDivider.module.css';

interface PaneDividerProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

const MIN_PX = 120;

export function PaneDivider({ direction, onResize }: PaneDividerProps) {
  const dragging = useRef(false);
  const startPos = useRef(0);
  const parentSize = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
      const parent = (e.target as HTMLElement).parentElement;
      if (parent) {
        parentSize.current =
          direction === 'horizontal' ? parent.offsetWidth : parent.offsetHeight;
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const current = direction === 'horizontal' ? ev.clientX : ev.clientY;
        const px = current - startPos.current;
        const size = parentSize.current || 1;
        if (Math.abs(px) < 2) return;
        const delta = px / size;
        startPos.current = current;
        onResize(delta);
      };

      const handleMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, onResize],
  );

  return (
    <div
      className={styles.divider}
      data-direction={direction}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation={direction}
    />
  );
}
