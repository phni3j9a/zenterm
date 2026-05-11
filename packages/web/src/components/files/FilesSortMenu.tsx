import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import type { SortMode } from '@/lib/filesSort';
import { useTheme } from '@/theme';

interface Props { onClose: () => void; }

const OPTIONS: Array<{ value: SortMode; labelKey: string }> = [
  { value: 'name-asc', labelKey: 'files.sortNameAsc' },
  { value: 'name-desc', labelKey: 'files.sortNameDesc' },
  { value: 'size-desc', labelKey: 'files.sortSizeDesc' },
  { value: 'modified-desc', labelKey: 'files.sortModifiedDesc' },
];

export function FilesSortMenu({ onClose }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const sortMode = useFilesStore((s) => s.sortMode);
  const setSortMode = useFilesStore((s) => s.setSortMode);

  return (
    <div
      role="menu"
      aria-label={t('files.sort')}
      style={{
        position: 'absolute',
        top: 36,
        right: 0,
        background: tokens.colors.bgElevated,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        padding: tokens.spacing.sm,
        zIndex: 10,
        minWidth: 200,
      }}
    >
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing.sm,
            padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
            cursor: 'pointer',
            color: tokens.colors.textPrimary,
            fontSize: tokens.typography.bodyMedium.fontSize,
          }}
        >
          <input
            type="radio"
            name="files-sort-mode"
            value={o.value}
            checked={sortMode === o.value}
            onChange={() => {
              setSortMode(o.value);
              onClose();
            }}
            aria-label={t(o.labelKey)}
          />
          {t(o.labelKey)}
        </label>
      ))}
    </div>
  );
}
