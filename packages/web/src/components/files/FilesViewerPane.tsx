import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme';
import { FilesViewerEmpty } from './FilesViewerEmpty';
import { FilesViewerHeader } from './FilesViewerHeader';
import { FilesTextViewer } from './FilesTextViewer';
import { FilesImageViewer } from './FilesImageViewer';
import { FilesMarkdownViewer } from './FilesMarkdownViewer';
import { FilesEditor } from './FilesEditor';
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

  const { t } = useTranslation();
  const isEditing = useFilesPreviewStore((s) => s.isEditing);
  const editContent = useFilesPreviewStore((s) => s.editContent);
  const isDirty = useFilesPreviewStore((s) => s.isDirty);
  const saving = useFilesPreviewStore((s) => s.saving);
  const textLines = useFilesPreviewStore((s) => s.textLines);
  const textTruncated = useFilesPreviewStore((s) => s.textTruncated);

  const handleSave = async () => {
    const path = useFilesPreviewStore.getState().selectedPath;
    if (!path) return;
    const content = useFilesPreviewStore.getState().editContent;
    useFilesPreviewStore.getState().setSaving(true);
    try {
      await client.writeFileContent(path, content);
      useFilesPreviewStore.getState().finishSave(content);
      useUiStore.getState().pushToast({ type: 'success', message: t('files.saved') });
    } catch (err) {
      useFilesPreviewStore.getState().setSaving(false);
      const msg = err instanceof Error ? err.message : String(err);
      useUiStore.getState().pushToast({ type: 'error', message: `${t('files.saveFailed')}: ${msg}` });
    }
  };

  const handleDownload = async () => {
    const path = useFilesPreviewStore.getState().selectedPath;
    const name = useFilesPreviewStore.getState().selectedName;
    if (!path || !name) return;
    try {
      const res = await fetch(client.buildRawFileUrl(path), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useUiStore.getState().pushToast({ type: 'error', message: `${t('files.downloadFailed')}: ${msg}` });
    }
  };

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
        name={selectedName ?? ''}
        kind={selectedKind}
        isEditing={isEditing}
        isDirty={isDirty}
        saving={saving}
        showMarkdownRendered={showMarkdownRendered}
        onEdit={() => useFilesPreviewStore.getState().startEditing()}
        onSave={handleSave}
        onCancel={() => useFilesPreviewStore.getState().cancelEditing()}
        onDownload={handleDownload}
        onToggleMarkdown={() => useFilesPreviewStore.getState().toggleMarkdownRendered()}
        onClose={() => useFilesPreviewStore.getState().clear()}
      />
      {selectedKind === 'unsupported' && <FilesViewerEmpty mode="unsupported" name={selectedName ?? ''} />}
      {selectedKind === 'image' && (
        <FilesImageViewer rawUrl={client.buildRawFileUrl(selectedPath)} token={token} name={selectedName ?? ''} />
      )}
      {(selectedKind === 'text' || selectedKind === 'markdown') && isEditing && (
        <FilesEditor
          filename={selectedName ?? ''}
          value={editContent}
          onChange={(v) => useFilesPreviewStore.getState().setEditContent(v)}
          onSave={handleSave}
        />
      )}
      {selectedKind === 'text' && !isEditing && (
        <FilesTextViewer textContent={textContent} textLines={textLines} textTruncated={textTruncated} />
      )}
      {selectedKind === 'markdown' && !isEditing && (
        showMarkdownRendered
          ? <FilesMarkdownViewer source={textContent ?? ''} />
          : <FilesTextViewer textContent={textContent} textLines={textLines} textTruncated={textTruncated} />
      )}
    </div>
  );
}
