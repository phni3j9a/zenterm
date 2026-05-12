import { useTranslation } from 'react-i18next';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';

export interface TerminalContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  hasSelection: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onReconnect: () => void;
  onSearch: () => void;
  onNewPane: () => void;
  canCreateNewPane: boolean;
  onClose: () => void;
}

export function TerminalContextMenu({
  open,
  x,
  y,
  hasSelection,
  onCopy,
  onPaste,
  onClear,
  onReconnect,
  onSearch,
  onNewPane,
  canCreateNewPane,
  onClose,
}: TerminalContextMenuProps) {
  const { t } = useTranslation();

  const items: ContextMenuItem[] = [
    { id: 'copy', label: t('terminal.menu.copy'), onSelect: onCopy, disabled: !hasSelection },
    { id: 'paste', label: t('terminal.menu.paste'), onSelect: onPaste },
    { id: 'clear', label: t('terminal.menu.clear'), onSelect: onClear },
    { id: 'search', label: t('terminal.menu.search'), onSelect: onSearch },
    { id: 'reconnect', label: t('terminal.menu.reconnect'), onSelect: onReconnect },
    {
      id: 'newPane',
      label: t('terminal.menu.newPane'),
      onSelect: onNewPane,
      disabled: !canCreateNewPane,
    },
  ];

  return (
    <ContextMenu
      open={open}
      anchorPoint={{ x, y }}
      items={items}
      onClose={onClose}
    />
  );
}
