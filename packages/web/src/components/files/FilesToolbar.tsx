import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFilesStore } from '@/stores/files';
import { useTheme } from '@/theme';
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
        <button type="button" aria-label={t('files.sort')} title={t('files.toggleSort')} onClick={() => setSortOpen((b) => !b)} style={btn}>
          ⇅ {t('files.sort')}
        </button>
        {sortOpen && <FilesSortMenu onClose={() => setSortOpen(false)} />}
      </div>
      <button
        type="button"
        aria-label={t('files.toggleHiddenFiles')}
        aria-pressed={showHidden}
        onClick={toggleShowHidden}
        style={{ ...btn, color: showHidden ? tokens.colors.primary : tokens.colors.textSecondary }}
      >
        {showHidden ? '🙈' : '👁'} {t('files.toggleHiddenFiles')}
      </button>
      <button type="button" aria-label={t('files.uploadFile')} onClick={onUploadClick} style={btn}>
        ⬆ {t('files.uploadFile')}
      </button>
      <div style={{ marginLeft: 'auto', position: 'relative' }}>
        <button type="button" aria-label={t('files.createNewFile')} onClick={() => setNewOpen((b) => !b)} style={btn}>
          ＋ New
        </button>
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
