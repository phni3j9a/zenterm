import { useCallback } from 'react';
import type { PaneNode } from '../../stores/panes';
import { usePanesStore } from '../../stores/panes';
import { TerminalView } from './Terminal';
import { PaneDivider } from './PaneDivider';
import styles from './PaneLayout.module.css';

interface PaneLayoutProps {
  node: PaneNode;
}

export function PaneLayout({ node }: PaneLayoutProps) {
  const activePaneId = usePanesStore((s) => s.activePaneId);
  const setActivePane = usePanesStore((s) => s.setActivePane);
  const resizePane = usePanesStore((s) => s.resizePane);

  if (node.type === 'leaf') {
    return (
      <div
        className={styles.leaf}
        data-active={node.paneId === activePaneId}
        onMouseDown={() => setActivePane(node.paneId)}
      >
        <TerminalView
          sessionId={node.sessionId}
          active={node.paneId === activePaneId}
        />
      </div>
    );
  }

  const { direction, ratio, children } = node;
  const firstPaneId =
    children[1].type === 'leaf' ? children[1].paneId : null;

  const handleResize = useCallback(
    (delta: number) => {
      if (firstPaneId) {
        resizePane(firstPaneId, delta);
      }
    },
    [firstPaneId, resizePane],
  );

  const flexDir = direction === 'horizontal' ? 'row' : 'column';
  const firstSize = `${(ratio * 100).toFixed(2)}%`;
  const secondSize = `${((1 - ratio) * 100).toFixed(2)}%`;

  return (
    <div className={styles.split} style={{ flexDirection: flexDir }}>
      <div className={styles.pane} style={{ flexBasis: firstSize }}>
        <PaneLayout node={children[0]} />
      </div>
      <PaneDivider direction={direction} onResize={handleResize} />
      <div className={styles.pane} style={{ flexBasis: secondSize }}>
        <PaneLayout node={children[1]} />
      </div>
    </div>
  );
}
