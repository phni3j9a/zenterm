import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import type { PreviewKind } from '@/lib/filesIcon';

interface Props {
  name: string;
  kind: PreviewKind;
  isEditing: boolean;
  isDirty: boolean;
  saving: boolean;
  showMarkdownRendered: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onToggleMarkdown: () => void;
  onClose: () => void;
}

export function FilesViewerHeader({
  name,
  kind,
  isEditing,
  isDirty,
  saving,
  showMarkdownRendered,
  onEdit,
  onSave,
  onCancel,
  onDownload,
  onToggleMarkdown,
  onClose,
}: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

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
        title={name}
      >
        {name}
      </span>
      {kind === 'markdown' && (
        <button type="button" onClick={onToggleMarkdown} style={btn}>
          {showMarkdownRendered ? t('files.source') : t('files.rendered')}
        </button>
      )}
      {(kind === 'text' || kind === 'markdown') && !isEditing && (
        <button type="button" onClick={onEdit} style={btn}>{t('files.edit')}</button>
      )}
      {isEditing && (
        <>
          <button type="button" onClick={onSave} style={btn} disabled={saving || !isDirty}>{t('files.save')}</button>
          <button type="button" onClick={onCancel} style={btn}>{t('files.cancel')}</button>
        </>
      )}
      <button type="button" onClick={onDownload} style={btn}>{t('files.download')}</button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('files.closePane')}
        style={btn}
      >
        ×
      </button>
    </header>
  );
}
