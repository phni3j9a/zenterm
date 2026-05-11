import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';

interface Props {
  entry: FileEntry;
  x: number;
  y: number;
  onClose: () => void;
  onRename: (e: FileEntry) => void;
  onCopy: (e: FileEntry) => void;
  onCut: (e: FileEntry) => void;
  onDelete: (e: FileEntry) => void;
  onDetails: (e: FileEntry) => void;
  onSelect: (e: FileEntry) => void;
}

export function FilesContextMenu(props: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { entry, x, y, onClose } = props;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const item = {
    background: 'none' as const,
    border: 'none' as const,
    width: '100%',
    padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
    textAlign: 'left' as const,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.bodyMedium.fontSize,
    cursor: 'pointer' as const,
  };

  const click = (action: 'rename' | 'copy' | 'cut' | 'delete' | 'details' | 'select') => {
    const map = {
      rename: props.onRename,
      copy: props.onCopy,
      cut: props.onCut,
      delete: props.onDelete,
      details: props.onDetails,
      select: props.onSelect,
    } as const;
    map[action](entry);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Files context menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        minWidth: 160,
        zIndex: 1000,
        padding: tokens.spacing.xs,
      }}
    >
      <button type="button" role="menuitem" style={item} onClick={() => click('select')}>Select</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('rename')}>{t('files.rename')}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('copy')}>{t('files.copy')}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('cut')}>{t('files.cut')}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('delete')}>{t('files.delete')}</button>
      <button type="button" role="menuitem" style={item} onClick={() => click('details')}>{t('files.details')}</button>
    </div>
  );
}
