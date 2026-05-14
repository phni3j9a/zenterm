import { type CSSProperties, type ReactNode } from 'react';
import { TerminalPane } from '@/components/TerminalPane';
import { usePaneStore } from '@/stores/pane';
import type { LayoutMode } from '@/lib/paneLayout';
import type { ApiClient } from '@/api/client';
import type { UploadProgressApi } from '@/hooks/useUploadProgress';

export interface MultiPaneAreaProps {
  gatewayUrl: string;
  token: string;
  isVisible: boolean;
  onSearch?: () => void;
  onNewPane?: () => void;
  canCreateNewPane?: boolean;
  apiClient: ApiClient | null;
  uploadProgress: UploadProgressApi;
  onAuthError?: () => void;
}

const GRID_TEMPLATE: Record<LayoutMode, Pick<CSSProperties, 'gridTemplateColumns' | 'gridTemplateRows'>> = {
  single: { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' },
  'cols-2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' },
  'cols-3': { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr' },
  'grid-2x2': { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' },
};

export function MultiPaneArea({
  gatewayUrl,
  token,
  isVisible,
  onSearch,
  onNewPane,
  canCreateNewPane = false,
  apiClient,
  uploadProgress,
  onAuthError,
}: MultiPaneAreaProps) {
  const layout = usePaneStore((s) => s.layout);
  const panes = usePaneStore((s) => s.panes);
  const focusedIndex = usePaneStore((s) => s.focusedIndex);
  const setFocusedIndex = usePaneStore((s) => s.setFocusedIndex);

  const slot = (idx: number): ReactNode => {
    const pane = panes[idx];
    const wrap = (child: ReactNode): ReactNode => (
      <div
        key={`pane-${idx}`}
        onClick={() => setFocusedIndex(idx)}
        style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
      >
        {child}
      </div>
    );

    if (pane && pane.kind === 'file') {
      // Task 6 で FilePaneViewer を実装し、Task 7 でここに接続する。
      // それまでは暫定 placeholder を表示する。
      return wrap(<div style={{ color: '#888', padding: 16 }}>file: {pane.path}</div>);
    }

    // terminal kind または null(空ペイン)は従来通り TerminalPane に流す。
    const sessionId = pane && pane.kind === 'terminal' ? pane.sessionId : null;
    const windowIndex = pane && pane.kind === 'terminal' ? pane.windowIndex : null;
    return wrap(
      <TerminalPane
        gatewayUrl={gatewayUrl}
        token={token}
        sessionId={sessionId}
        windowIndex={windowIndex}
        paneIndex={idx}
        isFocused={idx === focusedIndex}
        isVisible={isVisible}
        onSearch={onSearch}
        onNewPane={onNewPane}
        canCreateNewPane={canCreateNewPane}
        apiClient={apiClient}
        uploadProgress={uploadProgress}
        onAuthError={onAuthError}
      />,
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
