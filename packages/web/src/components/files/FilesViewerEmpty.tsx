import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconFileText } from '@/components/ui/icons';

interface Props {
  mode?: 'empty' | 'unsupported';
  name?: string;
}

export function FilesViewerEmpty({ mode = 'empty', name }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

  if (mode === 'unsupported') {
    const title = t('files.cannotOpen');
    const desc = t('files.cannotOpenDesc', { name: name ?? '' });
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

  return (
    <EmptyState
      icon={<IconFileText size={32} />}
      title={t('files.viewerEmpty.title')}
      description={t('files.viewerEmpty.description')}
    />
  );
}
