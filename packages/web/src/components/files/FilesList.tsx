import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useFilesStore } from '@/stores/files';
import { sortFiles } from '@/lib/filesSort';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { IconFolderOpen } from '@/components/ui/icons';
import { useTheme } from '@/theme';
import { FilesItem } from './FilesItem';

interface Props {
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (entry: FileEntry, e: MouseEvent) => void;
  onLongPress: (entry: FileEntry) => void;
}

export function FilesList({ onOpen, onContextMenu, onLongPress }: Props) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const entries = useFilesStore((s) => s.entries);
  const loading = useFilesStore((s) => s.loading);
  const sortMode = useFilesStore((s) => s.sortMode);
  const showHidden = useFilesStore((s) => s.showHidden);
  const selectionMode = useFilesStore((s) => s.selectionMode);
  const selectedNames = useFilesStore((s) => s.selectedNames);

  const visible = entries.filter((e) => showHidden || !e.name.startsWith('.'));
  const sorted = sortFiles(visible, sortMode);

  if (loading && entries.length === 0) {
    return (
      <div role="status" aria-label={t('common.loading')} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', gap: tokens.spacing.md, alignItems: 'center', padding: tokens.spacing.sm }}>
            <Skeleton width={18} height={18} radius={4} />
            <div style={{ flex: 1 }}>
              <Skeleton width="50%" height={14} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={<IconFolderOpen size={32} />}
        title={t('files.empty.title')}
        description={t('files.empty.description')}
        size="sm"
      />
    );
  }

  return (
    <div role="list" aria-label="Files list" style={{ display: 'flex', flexDirection: 'column' }}>
      {sorted.map((e) => (
        <FilesItem
          key={e.name}
          entry={e}
          selected={selectedNames.has(e.name)}
          selectionMode={selectionMode}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
