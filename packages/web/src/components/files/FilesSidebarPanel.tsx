import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { useFilesStore } from '@/stores/files';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { buildEntryPath } from '@/lib/filesPath';
import { getPreviewKind } from '@/lib/filesIcon';
import { FilesToolbar } from './FilesToolbar';
import { FilesBreadcrumbs } from './FilesBreadcrumbs';
import { FilesList } from './FilesList';
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

  const handleOpen = (entry: FileEntry) => {
    if (entry.type === 'directory' || (entry.type === 'symlink' && entry.resolvedType === 'directory')) {
      useFilesStore.getState().setCurrentPath(buildEntryPath(currentPath, entry.name));
      return;
    }
    const kind = getPreviewKind(entry.name);
    useFilesPreviewStore.getState().selectFile(buildEntryPath(currentPath, entry.name), entry.name, kind);
  };

  return (
    <div
      aria-label="Files panel"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: tokens.colors.bgElevated }}
    >
      <FilesToolbar
        onUploadClick={() => { /* wired in Sub-phase 2c-7 */ }}
        onNewFile={() => { /* wired in Sub-phase 2c-5 */ }}
        onNewFolder={() => { /* wired in Sub-phase 2c-5 */ }}
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
            onContextMenu={() => { /* wired in Sub-phase 2c-5 */ }}
            onLongPress={() => { /* wired in Sub-phase 2c-6 */ }}
          />
        )}
      </div>
    </div>
  );
}
