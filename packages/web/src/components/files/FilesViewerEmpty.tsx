import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface Props {
  mode?: 'empty' | 'unsupported';
  name?: string;
}

export function FilesViewerEmpty({ mode = 'empty', name }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

  const title = mode === 'unsupported' ? t('files.cannotOpen') : t('files.previewTitle');
  const desc = mode === 'unsupported'
    ? t('files.cannotOpenDesc', { name: name ?? '' })
    : t('files.previewDescription');

  return (
    <div
      role="status"
      aria-label={title}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacing.sm,
        color: tokens.colors.textMuted,
        padding: tokens.spacing.lg,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: tokens.typography.heading.fontSize }}>{title}</div>
      <div style={{ fontSize: tokens.typography.bodyMedium.fontSize }}>{desc}</div>
    </div>
  );
}
