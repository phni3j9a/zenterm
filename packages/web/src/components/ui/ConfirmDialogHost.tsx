import { useUiStore } from '@/stores/ui';
import { ConfirmDialog } from './ConfirmDialog';

export function ConfirmDialogHost() {
  const config = useUiStore((s) => s.confirmDialog);
  const hide = useUiStore((s) => s.hideConfirm);

  if (!config) {
    return (
      <ConfirmDialog
        open={false}
        title=""
        message=""
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      title={config.title}
      message={config.message}
      destructive={config.destructive}
      confirmLabel={config.confirmLabel}
      cancelLabel={config.cancelLabel}
      onConfirm={async () => {
        await config.onConfirm();
        hide();
      }}
      onCancel={hide}
    />
  );
}
