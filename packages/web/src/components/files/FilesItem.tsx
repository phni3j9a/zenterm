import type { MouseEvent } from 'react';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { formatFileSize } from '@/lib/filesFormat';
import { IconFolder, IconFile, IconChevronRight } from '@/components/ui/icons';

interface Props {
  entry: FileEntry;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (entry: FileEntry) => void;
  onContextMenu: (entry: FileEntry, e: MouseEvent) => void;
  onLongPress: (entry: FileEntry) => void;
}

export function FilesItem({ entry, selected, selectionMode, onOpen, onContextMenu, onLongPress }: Props) {
  const { tokens } = useTheme();
  const isDir = entry.type === 'directory';

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
      <span
        aria-hidden
        style={{
          width: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: isDir ? tokens.colors.primaryMuted : tokens.colors.textSecondary,
        }}
      >
        {isDir ? <IconFolder size={18} /> : <IconFile size={18} />}
      </span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: tokens.typography.bodyMedium.fontSize,
        }}
      >
        {entry.name}
      </span>
      {!isDir && (
        <span style={{ fontSize: tokens.typography.caption.fontSize, color: tokens.colors.textMuted }}>
          {formatFileSize(entry.size)}
        </span>
      )}
      {isDir && (
        <span aria-hidden style={{ color: tokens.colors.textMuted, display: 'inline-flex', alignItems: 'center' }}>
          <IconChevronRight size={14} />
        </span>
      )}
    </button>
  );
}
