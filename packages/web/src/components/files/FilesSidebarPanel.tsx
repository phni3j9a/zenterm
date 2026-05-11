import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { useFilesStore } from '@/stores/files';
import type { FilesClipboard } from '@/stores/files';
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
import { FilesSelectionHeader } from './FilesSelectionHeader';
import { FilesBulkActionBar } from './FilesBulkActionBar';
import { FilesPasteBar } from './FilesPasteBar';
import { FilesUploadDropZone } from './FilesUploadDropZone';
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
  const selectionMode = useFilesStore((s) => s.selectionMode);
  const clipboard = useFilesStore((s) => s.clipboard);

  useEffect(() => {
    void loadDirectory(client, currentPath, showHidden);
    // Re-fetch when path or hidden flag changes
  }, [client, currentPath, showHidden]);

  const [contextMenu, setContextMenu] = useState<{ entry: FileEntry; x: number; y: number } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<FileEntry | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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

  const handleLongPress = (entry: FileEntry) => {
    useFilesStore.getState().enterSelectionMode(entry.name);
  };

  const doCopy = (names: string[]) => {
    const items = names.map((n) => buildEntryPath(useFilesStore.getState().currentPath, n));
    useFilesStore.getState().setClipboard({ items, mode: 'copy' });
    useFilesStore.getState().exitSelectionMode();
    pushToast({ type: 'success', message: t('files.copySuccess') });
  };

  const doCut = (names: string[]) => {
    const items = names.map((n) => buildEntryPath(useFilesStore.getState().currentPath, n));
    useFilesStore.getState().setClipboard({ items, mode: 'cut' });
    useFilesStore.getState().exitSelectionMode();
    pushToast({ type: 'success', message: t('files.cutSuccess') });
  };

  const doBulkDelete = (names: string[]) => {
    showConfirm({
      title: t('files.deleteConfirmTitle'),
      message: t('files.deleteConfirmMultiple', { count: names.length }),
      destructive: true,
      onConfirm: async () => {
        try {
          for (const n of names) {
            await client.deleteFile(buildEntryPath(useFilesStore.getState().currentPath, n));
          }
          pushToast({ type: 'success', message: t('files.deleteSuccess') });
          useFilesStore.getState().exitSelectionMode();
          await refresh();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          pushToast({ type: 'error', message: `${t('files.deleteFailed')}: ${msg}` });
        }
      },
    });
  };

  const doUploadFiles = async (files: File[]) => {
    const dest = useFilesStore.getState().currentPath;
    for (const f of files) {
      try {
        await client.uploadFile(f, dest);
        pushToast({ type: 'success', message: t('files.uploadComplete') });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pushToast({ type: 'error', message: `${t('files.uploadFailed')}: ${msg}` });
      }
    }
    await refresh();
  };

  const doPaste = async (cb: FilesClipboard) => {
    const dest = useFilesStore.getState().currentPath;
    try {
      if (cb.mode === 'copy') {
        await client.copyFiles(cb.items, dest);
      } else {
        await client.moveFiles(cb.items, dest);
      }
      pushToast({ type: 'success', message: t('files.pasteSuccess') });
      useFilesStore.getState().clearClipboard();
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast({ type: 'error', message: `${t('files.pasteFailed')}: ${msg}` });
    }
  };

  const handleOpen = (entry: FileEntry) => {
    // In selection mode, clicking a row toggles selection instead of opening
    if (useFilesStore.getState().selectionMode) {
      useFilesStore.getState().toggleSelection(entry.name);
      return;
    }

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
        onUploadClick={() => uploadInputRef.current?.click()}
        onNewFile={() => setNewFileOpen(true)}
        onNewFolder={() => setMkdirOpen(true)}
      />
      <FilesBreadcrumbs path={currentPath} onNavigate={(p) => useFilesStore.getState().setCurrentPath(p)} />
      {selectionMode && <FilesSelectionHeader />}
      {clipboard && <FilesPasteBar onPaste={doPaste} />}
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
            onLongPress={handleLongPress}
          />
        )}
      </div>
      {selectionMode && (
        <FilesBulkActionBar onCopy={doCopy} onCut={doCut} onDelete={doBulkDelete} />
      )}
      {contextMenu && (
        <FilesContextMenu
          entry={contextMenu.entry}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRename={(e) => setRenameTarget(e)}
          onCopy={(e) => doCopy([e.name])}
          onCut={(e) => doCut([e.name])}
          onDelete={doDelete}
          onDetails={(e) => setDetailsTarget(e)}
          onSelect={(e) => useFilesStore.getState().enterSelectionMode(e.name)}
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
      <input
        ref={uploadInputRef}
        data-testid="files-upload-input"
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void doUploadFiles(files);
          e.target.value = '';
        }}
      />
      <FilesUploadDropZone onFiles={(files) => void doUploadFiles(files)} />
    </div>
  );
}
