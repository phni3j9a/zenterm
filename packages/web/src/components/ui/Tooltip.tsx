import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useTheme } from '@/theme';

const DELAY_MS = 500;

export interface TooltipProps {
  label: string;
  children: ReactNode;
  /** Optional override (defaults to "top"). */
  placement?: 'top' | 'bottom';
}

export function Tooltip({ label, children, placement = 'top' }: TooltipProps) {
  const { tokens } = useTheme();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const handleEnter = () => {
    clearTimer();
    timerRef.current = window.setTimeout(() => setVisible(true), DELAY_MS);
  };
  const handleLeave = () => {
    clearTimer();
    setVisible(false);
  };

  if (!isValidElement(children)) return <>{children}</>;
  type DOMProps = {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    'aria-describedby'?: string;
  };
  const childProps = (children as ReactElement<DOMProps>).props;
  const trigger = cloneElement(children as ReactElement<DOMProps>, {
    onMouseEnter: (ev: React.MouseEvent) => {
      childProps.onMouseEnter?.(ev);
      handleEnter();
    },
    onMouseLeave: (ev: React.MouseEvent) => {
      childProps.onMouseLeave?.(ev);
      handleLeave();
    },
    onFocus: (ev: React.FocusEvent) => {
      childProps.onFocus?.(ev);
      handleEnter();
    },
    onBlur: (ev: React.FocusEvent) => {
      childProps.onBlur?.(ev);
      handleLeave();
    },
    'aria-describedby': visible
      ? [childProps['aria-describedby'], id].filter(Boolean).join(' ') || undefined
      : childProps['aria-describedby'],
  });

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {visible && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            ...(placement === 'top'
              ? { bottom: 'calc(100% + 4px)' }
              : { top: 'calc(100% + 4px)' }),
            left: '50%',
            transform: 'translateX(-50%)',
            background: tokens.colors.surface,
            color: tokens.colors.textPrimary,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radii.sm,
            padding: '2px 6px',
            fontSize: tokens.typography.caption.fontSize,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
