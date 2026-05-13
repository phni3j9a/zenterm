import { type CSSProperties, type ReactNode } from 'react';
import { TerminalPane } from '@/components/TerminalPane';
import { usePaneStore } from '@/stores/pane';
import { useSessionsStore } from '@/stores/sessions';
import type { LayoutMode } from '@/lib/paneLayout';

// NOTE: Layout switches cause TerminalPane to remount because the surrounding
// grid structure changes. Within a given layout, focus changes preserve pane
// identity. xterm scrollback is lost on layout switch and the terminal
// reconnects via the WebSocket reconnect logic. tmux sessions are unaffected
// (server-side state).

export interface MultiPaneAreaProps {
  gatewayUrl: string;
  token: string;
  isVisible: boolean;
  onSearch?: () => void;
  onNewPane?: () => void;
  canCreateNewPane?: boolean;
  onDropFiles?: (files: File[], cwd: string) => void;
  uploadProgress?: {
    active: boolean;
    total: number;
    completed: number;
    currentFile?: string;
    error?: string;
  };
}

const GRID_TEMPLATE: Record<LayoutMode, Pick<CSSProperties, 'gridTemplateColumns' | 'gridTemplateRows'>> = {
  single: { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' },
  'cols-2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' },
  'cols-3': { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr' },
  'grid-2x2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' },
};

export function MultiPaneArea({ gatewayUrl, token, isVisible, onSearch, onNewPane, canCreateNewPane = false, onDropFiles, uploadProgress }: MultiPaneAreaProps) {
  const layout = usePaneStore((s) => s.layout);
  const panes = usePaneStore((s) => s.panes);
  const focusedIndex = usePaneStore((s) => s.focusedIndex);
  const setFocusedIndex = usePaneStore((s) => s.setFocusedIndex);
  const sessions = useSessionsStore((s) => s.sessions);

  const slot = (idx: number): ReactNode => {
    const pane = panes[idx];
    const session = Array.isArray(sessions)
      ? sessions.find((s) => s.displayName === pane?.sessionId)
      : undefined;
    const sessionCwd = session?.cwd;
    return (
      <div
        key={`pane-${idx}`}
        onClick={() => setFocusedIndex(idx)}
        style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
      >
        <TerminalPane
          gatewayUrl={gatewayUrl}
          token={token}
          sessionId={pane?.sessionId ?? null}
          windowIndex={pane?.windowIndex ?? null}
          paneIndex={idx}
          isFocused={idx === focusedIndex}
          isVisible={isVisible}
          onSearch={onSearch}
          onNewPane={onNewPane}
          canCreateNewPane={canCreateNewPane}
          sessionCwd={sessionCwd}
          onDropFiles={onDropFiles}
          uploadProgress={uploadProgress}
        />
      </div>
    );
  };

  const slotCount = layout === 'single' ? 1 : layout === 'cols-2' ? 2 : layout === 'cols-3' ? 3 : 4;
  const slots: ReactNode[] = [];
  for (let i = 0; i < slotCount; i += 1) slots.push(slot(i));

  return (
    <div
      style={{
        display: 'grid',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...GRID_TEMPLATE[layout],
      }}
    >
      {slots}
    </div>
  );
}
