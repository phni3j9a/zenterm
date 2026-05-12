import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import { useTheme } from '@/theme';
import { IconButton } from '@/components/ui/IconButton';
import { IconSort, IconEye, IconEyeOff, IconUpload, IconPlus } from '@/components/ui/icons';
import { FilesSortMenu } from './FilesSortMenu';

interface Props {
  onUploadClick: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
}

export function FilesToolbar({ onUploadClick, onNewFile, onNewFolder }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const showHidden = useFilesStore((s) => s.showHidden);
  const toggleShowHidden = useFilesStore((s) => s.toggleShowHidden);
  const [sortOpen, setSortOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const btn = {
    background: 'none' as const,
    border: 'none' as const,
    color: tokens.colors.textSecondary,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    cursor: 'pointer' as const,
    fontSize: tokens.typography.bodyMedium.fontSize,
    borderRadius: 4,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.xs,
        padding: tokens.spacing.sm,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative' }}>
        <IconButton
          icon={<IconSort size={16} />}
          label={t('files.sort')}
          variant="ghost"
          size="sm"
          onClick={() => setSortOpen((b) => !b)}
        />
        {sortOpen && <FilesSortMenu onClose={() => setSortOpen(false)} />}
      </div>
      <IconButton
        icon={showHidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        label={t('files.toggleHidden')}
        variant="ghost"
        size="sm"
        aria-pressed={showHidden}
        onClick={toggleShowHidden}
        style={{ color: showHidden ? tokens.colors.primary : undefined }}
      />
      <div style={{ flex: 1 }} />
      <IconButton
        icon={<IconUpload size={16} />}
        label={t('files.upload')}
        variant="outline"
        size="sm"
        onClick={onUploadClick}
      />
      <div style={{ position: 'relative' }}>
        <IconButton
          icon={<IconPlus size={16} />}
          label={t('files.new')}
          variant="primary"
          size="sm"
          onClick={() => setNewOpen((b) => !b)}
        />
        {newOpen && (
          <div
            role="menu"
            aria-label="New menu"
            style={{
              position: 'absolute',
              top: 36,
              right: 0,
              background: tokens.colors.bgElevated,
              border: `1px solid ${tokens.colors.borderSubtle}`,
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              minWidth: 160,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              role="menuitem"
              aria-label={t('files.createNewFile')}
              onClick={() => { setNewOpen(false); onNewFile(); }}
              style={{ ...btn, display: 'block', width: '100%', textAlign: 'left' as const }}
            >
              📄 {t('files.createNewFile')}
            </button>
            <button
              type="button"
              role="menuitem"
              aria-label={t('files.newFolder')}
              onClick={() => { setNewOpen(false); onNewFolder(); }}
              style={{ ...btn, display: 'block', width: '100%', textAlign: 'left' as const }}
            >
              📁 {t('files.newFolder')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
