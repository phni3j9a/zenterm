import { useEffect } from 'react';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useTheme } from '@/theme';
import { FilesViewerEmpty } from './FilesViewerEmpty';
import { FilesViewerHeader } from './FilesViewerHeader';
import { FilesTextViewer } from './FilesTextViewer';
import { FilesImageViewer } from './FilesImageViewer';
import { FilesMarkdownViewer } from './FilesMarkdownViewer';
import type { FilesApiClient } from './filesApi';

interface Props {
  client: FilesApiClient;
  token: string | null;
}

export function FilesViewerPane({ client, token }: Props) {
  const { tokens } = useTheme();
  const selectedPath = useFilesPreviewStore((s) => s.selectedPath);
  const selectedKind = useFilesPreviewStore((s) => s.selectedKind);
  const selectedName = useFilesPreviewStore((s) => s.selectedName);
  const showMarkdownRendered = useFilesPreviewStore((s) => s.showMarkdownRendered);
  const textContent = useFilesPreviewStore((s) => s.textContent);

  useEffect(() => {
    if (!selectedPath) return;
    if (selectedKind !== 'text' && selectedKind !== 'markdown') return;
    let cancelled = false;
    useFilesPreviewStore.getState().setLoadingPreview(true);
    useFilesPreviewStore.getState().setPreviewError(null);
    (async () => {
      try {
        const res = await client.getFileContent(selectedPath);
        if (cancelled) return;
        useFilesPreviewStore.getState().setText(res.content, res.lines, res.truncated);
      } catch (err) {
        if (cancelled) return;
        useFilesPreviewStore.getState().setPreviewError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) useFilesPreviewStore.getState().setLoadingPreview(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, selectedPath, selectedKind]);

  const containerStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: tokens.colors.bg,
    minWidth: 0,
  };

  if (!selectedPath || !selectedKind) {
    return <div style={containerStyle}><FilesViewerEmpty /></div>;
  }

  return (
    <div style={containerStyle}>
      <FilesViewerHeader
        onEdit={() => useFilesPreviewStore.getState().startEditing()}
        onSave={() => { /* wired in Sub-phase 2c-4 (Task 28) */ }}
        onCancel={() => useFilesPreviewStore.getState().cancelEditing()}
        onDownload={() => { /* wired in Sub-phase 2c-8 (Task 51) */ }}
        onToggleMarkdown={() => useFilesPreviewStore.getState().toggleMarkdownRendered()}
      />
      {selectedKind === 'unsupported' && <FilesViewerEmpty mode="unsupported" name={selectedName ?? ''} />}
      {selectedKind === 'image' && (
        <FilesImageViewer rawUrl={client.buildRawFileUrl(selectedPath)} token={token} name={selectedName ?? ''} />
      )}
      {selectedKind === 'text' && <FilesTextViewer />}
      {selectedKind === 'markdown' && (
        showMarkdownRendered
          ? <FilesMarkdownViewer source={textContent ?? ''} />
          : <FilesTextViewer />
      )}
    </div>
  );
}
