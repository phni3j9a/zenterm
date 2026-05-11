import { useTranslation } from 'react-i18next';
import { useFilesPreviewStore } from '@/stores/filesPreview';
import { useTheme } from '@/theme';

interface Props {
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onToggleMarkdown: () => void;
}

export function FilesViewerHeader({ onEdit, onSave, onCancel, onDownload, onToggleMarkdown }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const selectedName = useFilesPreviewStore((s) => s.selectedName);
  const selectedKind = useFilesPreviewStore((s) => s.selectedKind);
  const isEditing = useFilesPreviewStore((s) => s.isEditing);
  const showMarkdownRendered = useFilesPreviewStore((s) => s.showMarkdownRendered);
  const isDirty = useFilesPreviewStore((s) => s.isDirty);
  const saving = useFilesPreviewStore((s) => s.saving);

  if (!selectedName) return null;

  const btn = {
    background: 'none' as const,
    border: `1px solid ${tokens.colors.borderSubtle}`,
    color: tokens.colors.textPrimary,
    borderRadius: 4,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    cursor: 'pointer' as const,
    fontSize: tokens.typography.bodyMedium.fontSize,
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
      }}
    >
      <span
        style={{
          flex: 1,
          fontWeight: 600,
          color: tokens.colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={selectedName}
      >
        {selectedName}
      </span>
      {selectedKind === 'markdown' && (
        <button type="button" onClick={onToggleMarkdown} style={btn}>
          {showMarkdownRendered ? t('files.source') : t('files.rendered')}
        </button>
      )}
      {(selectedKind === 'text' || selectedKind === 'markdown') && !isEditing && (
        <button type="button" onClick={onEdit} style={btn}>{t('files.edit')}</button>
      )}
      {isEditing && (
        <>
          <button type="button" onClick={onSave} style={btn} disabled={saving || !isDirty}>{t('files.save')}</button>
          <button type="button" onClick={onCancel} style={btn}>{t('files.cancel')}</button>
        </>
      )}
      <button type="button" onClick={onDownload} style={btn}>{t('files.download')}</button>
    </header>
  );
}
