import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import { useTheme } from '@/theme';

interface Props {
  onCopy: (names: string[]) => void;
  onCut: (names: string[]) => void;
  onDelete: (names: string[]) => void;
}

export function FilesBulkActionBar({ onCopy, onCut, onDelete }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const selectionMode = useFilesStore((s) => s.selectionMode);
  const selectedNames = useFilesStore((s) => s.selectedNames);

  if (!selectionMode || selectedNames.size === 0) return null;

  const names = Array.from(selectedNames);

  const btn = {
    background: tokens.colors.bgElevated,
    border: `1px solid ${tokens.colors.borderSubtle}`,
    color: tokens.colors.textPrimary,
    borderRadius: 4,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    cursor: 'pointer' as const,
    fontSize: tokens.typography.bodyMedium.fontSize,
  };

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      style={{
        display: 'flex',
        gap: tokens.spacing.sm,
        justifyContent: 'space-around',
        padding: tokens.spacing.sm,
        borderTop: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
      }}
    >
      <button type="button" style={btn} onClick={() => onCopy(names)}>{t('files.copy')}</button>
      <button type="button" style={btn} onClick={() => onCut(names)}>{t('files.cut')}</button>
      <button type="button" style={{ ...btn, color: tokens.colors.error }} onClick={() => onDelete(names)}>
        {t('files.delete')}
      </button>
    </div>
  );
}
