import { type ReactNode } from 'react';
import { TerminalPane } from '@/components/TerminalPane';
import { SplitPane } from './SplitPane';
import { usePaneStore } from '@/stores/pane';
import type { LayoutMode } from '@/lib/paneLayout';

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

  const slot = (idx: number): ReactNode => (
    <div
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

  const setR = (mode: LayoutMode, splitterIdx: number) => (v: number) =>
    setRatio(mode, splitterIdx, v);

  if (layout === 'single') {
    return <div style={{ width: '100%', height: '100%' }}>{slot(0)}</div>;
  }

  if (layout === 'cols-2') {
    return (
      <SplitPane
        orientation="vertical"
        ratio={ratios['cols-2'][0]}
        onRatioChange={setR('cols-2', 0)}
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
        onRatioChange={setR('cols-3', 0)}
        first={slot(0)}
        second={
          <SplitPane
            orientation="vertical"
            ratio={ratios['cols-3'][1]}
            onRatioChange={setR('cols-3', 1)}
            first={slot(1)}
            second={slot(2)}
          />
        }
      />
    );
  }

  if (layout === 'grid-2x2') {
    return (
      <SplitPane
        orientation="horizontal"
        ratio={ratios['grid-2x2'][1]}
        onRatioChange={setR('grid-2x2', 1)}
        first={
          <SplitPane
            orientation="vertical"
            ratio={ratios['grid-2x2'][0]}
            onRatioChange={setR('grid-2x2', 0)}
            first={slot(0)}
            second={slot(1)}
          />
        }
        second={
          <SplitPane
            orientation="vertical"
            ratio={ratios['grid-2x2'][0]}
            onRatioChange={setR('grid-2x2', 0)}
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
      onRatioChange={setR('main-side-2', 0)}
      first={slot(0)}
      second={
        <SplitPane
          orientation="horizontal"
          ratio={ratios['main-side-2'][1]}
          onRatioChange={setR('main-side-2', 1)}
          first={slot(1)}
          second={slot(2)}
        />
      }
    />
  );
}
