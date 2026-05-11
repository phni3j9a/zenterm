import { useTranslation } from 'react-i18next';
import { useFilesStore, type FilesClipboard } from '@/stores/files';
import { useTheme } from '@/theme';

interface Props {
  onPaste: (clipboard: FilesClipboard) => void;
}

export function FilesPasteBar({ onPaste }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const clipboard = useFilesStore((s) => s.clipboard);
  const clearClipboard = useFilesStore((s) => s.clearClipboard);

  if (!clipboard) return null;

  return (
    <div
      role="region"
      aria-label="Paste bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        background: tokens.colors.surfaceHover,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <span style={{ flex: 1, color: tokens.colors.textPrimary }}>
        {t('files.clipboardItems', { count: clipboard.items.length })} ({clipboard.mode})
      </span>
      <button type="button" onClick={() => onPaste(clipboard)}>{t('files.paste')}</button>
      <button type="button" onClick={clearClipboard} aria-label={t('common.close')}>{t('common.close')}</button>
    </div>
  );
}
