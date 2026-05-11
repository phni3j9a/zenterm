import type { MouseEvent } from 'react';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { getFileIconType, type FileIconType } from '@/lib/filesIcon';
import { formatFileSize } from '@/lib/filesFormat';

interface Props {
  entry: FileEntry;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (entry: FileEntry, e: MouseEvent) => void;
  onLongPress: (entry: FileEntry) => void;
}

const ICON: Record<FileIconType, string> = {
  folder: '📁',
  code: '📝',
  image: '🖼',
  text: '📄',
  symlink: '🔗',
  other: '📦',
};

export function FilesItem({ entry, selected, selectionMode, onOpen, onContextMenu, onLongPress }: Props) {
  const { tokens } = useTheme();
  const icon = ICON[getFileIconType(entry)];

  const handleClick = (e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onLongPress(entry);
      return;
    }
    onOpen(entry);
  };

  return (
    <button
      type="button"
      aria-label={entry.name}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(entry, e);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        width: '100%',
        background: selected ? tokens.colors.surfaceHover : 'transparent',
        border: 'none',
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
        cursor: 'pointer',
        color: tokens.colors.textPrimary,
        textAlign: 'left',
        fontSize: tokens.typography.bodyMedium.fontSize,
      }}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          readOnly
          aria-label={`Select ${entry.name}`}
          style={{ marginRight: tokens.spacing.xs }}
        />
      )}
      <span aria-hidden style={{ width: 20 }}>{icon}</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.name}
      </span>
      {entry.type !== 'directory' && (
        <span style={{ fontSize: tokens.typography.caption.fontSize, color: tokens.colors.textMuted }}>
          {formatFileSize(entry.size)}
        </span>
      )}
    </button>
  );
}
