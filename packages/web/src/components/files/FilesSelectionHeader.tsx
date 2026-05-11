import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import { useTheme } from '@/theme';

export function FilesSelectionHeader() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const selectedNames = useFilesStore((s) => s.selectedNames);
  const exitSelectionMode = useFilesStore((s) => s.exitSelectionMode);
  const selectAll = useFilesStore((s) => s.selectAll);

  return (
    <div
      role="region"
      aria-label="Selection header"
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
        {t('files.selectedCount', { count: selectedNames.size })}
      </span>
      <button type="button" onClick={selectAll}>{t('files.selectAll')}</button>
      <button type="button" onClick={exitSelectionMode} aria-label={t('common.close')}>{t('common.close')}</button>
    </div>
  );
}
