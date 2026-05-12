import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';

export interface RowActionsMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export interface RowActionsMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  items: RowActionsMenuItem[];
  onClose: () => void;
}

export function RowActionsMenu({ open, anchorEl, items, onClose }: RowActionsMenuProps) {
  const contextItems: ContextMenuItem[] = items.map((item) => ({
    id: item.label,
    label: item.label,
    onSelect: item.onClick,
    destructive: item.destructive,
  }));

  return (
    <ContextMenu
      open={open}
      anchorEl={anchorEl}
      items={contextItems}
      onClose={onClose}
    />
  );
}
