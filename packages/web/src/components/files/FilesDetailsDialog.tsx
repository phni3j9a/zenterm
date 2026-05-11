import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileEntry } from '@zenterm/shared';
import { useTheme } from '@/theme';
import { formatFileDate, formatFileSize } from '@/lib/filesFormat';

interface Props {
  open: boolean;
  entry: FileEntry | null;
  locale: string;
  onClose: () => void;
}

export function FilesDetailsDialog({ open, entry, locale, onClose }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const shouldOpen = open && entry !== null;
    if (shouldOpen && !ref.current.open) ref.current.showModal();
    if (!shouldOpen && ref.current.open) ref.current.close();
  }, [open, entry]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      style={{
        background: tokens.colors.bgElevated,
        color: tokens.colors.textPrimary,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        borderRadius: 8,
        padding: tokens.spacing.lg,
        minWidth: 320,
      }}
    >
      {entry && (
        <>
          <h3 style={{ margin: 0, marginBottom: tokens.spacing.md }}>{entry.name}</h3>
          <div>{t('files.detailsSize', { size: formatFileSize(entry.size) })}</div>
          <div>{t('files.detailsModified', { date: formatFileDate(entry.modified, locale) })}</div>
          <div>{t('files.detailsPermissions', { permissions: entry.permissions })}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: tokens.spacing.md }}>
            <button type="button" onClick={onClose}>{t('common.close')}</button>
          </div>
        </>
      )}
    </dialog>
  );
}
