import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';

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
  const { t } = useTranslation();
  const { entry, x, y, onClose } = props;

  const items: ContextMenuItem[] = [
    { id: 'select', label: 'Select', onSelect: () => props.onSelect(entry) },
    { id: 'rename', label: t('files.rename'), onSelect: () => props.onRename(entry) },
    { id: 'copy', label: t('files.copy'), onSelect: () => props.onCopy(entry) },
    { id: 'cut', label: t('files.cut'), onSelect: () => props.onCut(entry) },
    { id: 'delete', label: t('files.delete'), onSelect: () => props.onDelete(entry), destructive: true },
    { id: 'details', label: t('files.details'), onSelect: () => props.onDetails(entry) },
  ];

  return (
    <ContextMenu
      open
      anchorPoint={{ x, y }}
      items={items}
      onClose={onClose}
      ariaLabel="Files context menu"
    />
  );
}
