import { type ReactNode, useMemo } from 'react';
import { TerminalPane } from '@/components/TerminalPane';
import { SplitPane } from './SplitPane';
import { usePaneStore } from '@/stores/pane';

// NOTE: Layout switches (e.g. cols-2 → grid-2x2) cause TerminalPane to
// remount because React reconciles by tree position, and SplitPane's
// nested structure differs across layouts. Within a given layout, focus
// and ratio changes preserve pane identity (verified by tests). A future
// refactor (always-mount + portal/CSS grid) will eliminate cross-layout
// remount; for now, xterm scrollback is lost on layout switch and the
// terminal reconnects via Phase 2d's WebSocket reconnect logic. tmux
// sessions are unaffected (server-side state).

export interface MultiPaneAreaProps {
  gatewayUrl: string;
  token: string;
  isVisible: boolean;
}

export function MultiPaneArea({ gatewayUrl, token, isVisible }: MultiPaneAreaProps) {
  const layout = usePaneStore((s) => s.layout);
  const panes = usePaneStore((s) => s.panes);
  const focusedIndex = usePaneStore((s) => s.focusedIndex);
  const ratios = usePaneStore((s) => s.ratios);
  const setFocusedIndex = usePaneStore((s) => s.setFocusedIndex);
  const setRatio = usePaneStore((s) => s.setRatio);

  const ratioSetters = useMemo(
    () => ({
      'cols-2-0': (v: number) => setRatio('cols-2', 0, v),
      'cols-3-0': (v: number) => setRatio('cols-3', 0, v),
      'cols-3-1': (v: number) => setRatio('cols-3', 1, v),
      'grid-2x2-0': (v: number) => setRatio('grid-2x2', 0, v),
      'grid-2x2-1': (v: number) => setRatio('grid-2x2', 1, v),
      'main-side-2-0': (v: number) => setRatio('main-side-2', 0, v),
      'main-side-2-1': (v: number) => setRatio('main-side-2', 1, v),
    }),
    [setRatio],
  );

  const slot = (idx: number): ReactNode => (
    <div
      key={`pane-${idx}`}
      onClick={() => setFocusedIndex(idx)}
      style={{ width: '100%', height: '100%' }}
    >
      <TerminalPane
        gatewayUrl={gatewayUrl}
        token={token}
        sessionId={panes[idx]?.sessionId ?? null}
        windowIndex={panes[idx]?.windowIndex ?? null}
        paneIndex={idx}
        isFocused={idx === focusedIndex}
        isVisible={isVisible}
      />
    </div>
  );

  if (layout === 'single') {
    return <div style={{ width: '100%', height: '100%' }}>{slot(0)}</div>;
  }

  if (layout === 'cols-2') {
    return (
      <SplitPane
        orientation="vertical"
        ratio={ratios['cols-2'][0]}
        onRatioChange={ratioSetters['cols-2-0']}
        first={slot(0)}
        second={slot(1)}
      />
    );
  }

  if (layout === 'cols-3') {
    return (
      <SplitPane
        orientation="vertical"
        ratio={ratios['cols-3'][0]}
        onRatioChange={ratioSetters['cols-3-0']}
        first={slot(0)}
        second={
          <SplitPane
            orientation="vertical"
            ratio={ratios['cols-3'][1]}
            onRatioChange={ratioSetters['cols-3-1']}
            first={slot(1)}
            second={slot(2)}
          />
        }
      />
    );
  }

  if (layout === 'grid-2x2') {
    // grid-2x2: both rows share ratios['grid-2x2'][0] for column split (rows align column boundaries).
    return (
      <SplitPane
        orientation="horizontal"
        ratio={ratios['grid-2x2'][1]}
        onRatioChange={ratioSetters['grid-2x2-1']}
        first={
          <SplitPane
            orientation="vertical"
            ratio={ratios['grid-2x2'][0]}
            onRatioChange={ratioSetters['grid-2x2-0']}
            first={slot(0)}
            second={slot(1)}
          />
        }
        second={
          <SplitPane
            orientation="vertical"
            ratio={ratios['grid-2x2'][0]}
            onRatioChange={ratioSetters['grid-2x2-0']}
            first={slot(2)}
            second={slot(3)}
          />
        }
      />
    );
  }

  // main-side-2
  return (
    <SplitPane
      orientation="vertical"
      ratio={ratios['main-side-2'][0]}
      onRatioChange={ratioSetters['main-side-2-0']}
      first={slot(0)}
      second={
        <SplitPane
          orientation="horizontal"
          ratio={ratios['main-side-2'][1]}
          onRatioChange={ratioSetters['main-side-2-1']}
          first={slot(1)}
          second={slot(2)}
        />
      }
    />
  );
}
