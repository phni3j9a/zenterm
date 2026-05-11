import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { useFilesStore } from '@/stores/files';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useUiStore } from '@/stores/ui';
import { buildEntryPath } from '@/lib/filesPath';
import { getPreviewKind } from '@/lib/filesIcon';
import { FilesToolbar } from './FilesToolbar';
import { FilesBreadcrumbs } from './FilesBreadcrumbs';
import { FilesList } from './FilesList';
import { FilesContextMenu } from './FilesContextMenu';
import { FilesNewNameDialog } from './FilesNewNameDialog';
import { FilesDetailsDialog } from './FilesDetailsDialog';
import { loadDirectory, type FilesApiClient } from './filesApi';

interface Props {
  client: FilesApiClient;
}

export function FilesSidebarPanel({ client }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const currentPath = useFilesStore((s) => s.currentPath);
  const showHidden = useFilesStore((s) => s.showHidden);
  const loading = useFilesStore((s) => s.loading);
  const error = useFilesStore((s) => s.error);

  useEffect(() => {
    void loadDirectory(client, currentPath, showHidden);
    // Re-fetch when path or hidden flag changes
  }, [client, currentPath, showHidden]);

  const [contextMenu, setContextMenu] = useState<{ entry: FileEntry; x: number; y: number } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<FileEntry | null>(null);
  const pushToast = useUiStore((s) => s.pushToast);
  const showConfirm = useUiStore((s) => s.showConfirm);

  const refresh = () => loadDirectory(client, useFilesStore.getState().currentPath, useFilesStore.getState().showHidden);

  const handleContextMenu = (entry: FileEntry, e: MouseEvent) => {
    setContextMenu({ entry, x: e.clientX, y: e.clientY });
  };

  const doDelete = async (entry: FileEntry) => {
    showConfirm({
      title: t('files.deleteConfirmTitle'),
      message: t('files.deleteConfirmMessage', { name: entry.name }),
      destructive: true,
      onConfirm: async () => {
        const targetPath = buildEntryPath(useFilesStore.getState().currentPath, entry.name);
        try {
          await client.deleteFile(targetPath);
          pushToast({ type: 'success', message: t('files.deleteSuccess') });
          if (useFilesPreviewStore.getState().selectedPath === targetPath) {
            useFilesPreviewStore.getState().clear();
          }
          await refresh();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          pushToast({ type: 'error', message: `${t('files.deleteFailed')}: ${msg}` });
        }
      },
    });
  };

  const doRename = async (newName: string) => {
    if (!renameTarget) return;
    const oldPath = buildEntryPath(useFilesStore.getState().currentPath, renameTarget.name);
    const newPath = buildEntryPath(useFilesStore.getState().currentPath, newName);
    try {
      await client.renameFile(oldPath, newName);
      pushToast({ type: 'success', message: t('files.renameSuccess') });
      if (useFilesPreviewStore.getState().selectedPath === oldPath) {
        const kind = useFilesPreviewStore.getState().selectedKind;
        if (kind) useFilesPreviewStore.getState().selectFile(newPath, newName, kind);
      }
      setRenameTarget(null);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast({ type: 'error', message: `${t('files.renameFailed')}: ${msg}` });
    }
  };

  const doMkdir = async (name: string) => {
    try {
      await client.createDirectory(buildEntryPath(useFilesStore.getState().currentPath, name));
      pushToast({ type: 'success', message: t('files.mkdirSuccess') });
      setMkdirOpen(false);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast({ type: 'error', message: `${t('files.mkdirFailed')}: ${msg}` });
    }
  };

  const doNewFile = (name: string) => {
    // Create empty buffer in editor; actual file is written on Save (Task 28)
    const path = buildEntryPath(useFilesStore.getState().currentPath, name);
    useFilesPreviewStore.getState().selectFile(path, name, getPreviewKind(name));
    useFilesPreviewStore.getState().setText('', 0, false);
    useFilesPreviewStore.getState().startEditing();
    setNewFileOpen(false);
  };

  const handleOpen = (entry: FileEntry) => {
    const isDir = entry.type === 'directory'
      || (entry.type === 'symlink' && entry.resolvedType === 'directory');

    const proceed = () => {
      if (isDir) {
        useFilesStore.getState().setCurrentPath(buildEntryPath(currentPath, entry.name));
        return;
      }
      const kind = getPreviewKind(entry.name);
      useFilesPreviewStore.getState().selectFile(buildEntryPath(currentPath, entry.name), entry.name, kind);
    };

    const isDirty = useFilesPreviewStore.getState().isDirty;
    if (isDirty) {
      useUiStore.getState().showConfirm({
        title: t('files.unsavedChangesTitle'),
        message: t('files.unsavedChangesMessage'),
        destructive: true,
        onConfirm: () => {
          useFilesPreviewStore.getState().cancelEditing();
          proceed();
        },
      });
      return;
    }
    proceed();
  };

  return (
    <div
      aria-label="Files panel"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: tokens.colors.bgElevated }}
    >
      <FilesToolbar
        onUploadClick={() => { /* wired in Sub-phase 2c-7 */ }}
        onNewFile={() => setNewFileOpen(true)}
        onNewFolder={() => setMkdirOpen(true)}
      />
      <FilesBreadcrumbs path={currentPath} onNavigate={(p) => useFilesStore.getState().setCurrentPath(p)} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: tokens.spacing.md, color: tokens.colors.textMuted }}>{t('common.loading')}</div>
        )}
        {error && (
          <div role="alert" style={{ padding: tokens.spacing.md, color: tokens.colors.error }}>
            {t('files.loadFailed')}: {error}
          </div>
        )}
        {!loading && !error && (
          <FilesList
            onOpen={handleOpen}
            onContextMenu={handleContextMenu}
            onLongPress={() => { /* wired in Sub-phase 2c-6 */ }}
          />
        )}
      </div>
      {contextMenu && (
        <FilesContextMenu
          entry={contextMenu.entry}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRename={(e) => setRenameTarget(e)}
          onCopy={() => { /* wired in Sub-phase 2c-6 */ }}
          onCut={() => { /* wired in Sub-phase 2c-6 */ }}
          onDelete={doDelete}
          onDetails={(e) => setDetailsTarget(e)}
          onSelect={() => { /* wired in Sub-phase 2c-6 */ }}
        />
      )}
      <FilesNewNameDialog
        open={renameTarget !== null}
        title={t('files.rename')}
        placeholder={t('files.fileNamePlaceholder')}
        initialValue={renameTarget?.name ?? ''}
        onCancel={() => setRenameTarget(null)}
        onSubmit={doRename}
      />
      <FilesNewNameDialog
        open={mkdirOpen}
        title={t('files.newFolder')}
        placeholder={t('files.folderNamePlaceholder')}
        initialValue=""
        onCancel={() => setMkdirOpen(false)}
        onSubmit={doMkdir}
      />
      <FilesNewNameDialog
        open={newFileOpen}
        title={t('files.createNewFile')}
        placeholder={t('files.fileNamePlaceholder')}
        initialValue=""
        onCancel={() => setNewFileOpen(false)}
        onSubmit={doNewFile}
      />
      <FilesDetailsDialog
        open={detailsTarget !== null}
        entry={detailsTarget}
        locale={t('common.cancel') === 'キャンセル' ? 'ja-JP' : 'en-US'}
        onClose={() => setDetailsTarget(null)}
      />
    </div>
  );
}
