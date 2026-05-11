import { useAuthorizedBlobUrl } from '@/hooks/useAuthorizedBlobUrl';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';

interface Props {
  rawUrl: string | null;
  token: string | null;
  name: string;
}

export function FilesImageViewer({ rawUrl, token, name }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { url, loading, error } = useAuthorizedBlobUrl(rawUrl, token);

  if (!rawUrl) return null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: tokens.colors.bg,
        overflow: 'auto',
        padding: tokens.spacing.md,
      }}
    >
      {loading && <span style={{ color: tokens.colors.textMuted }}>{t('common.loading')}</span>}
      {error && <span role="alert" style={{ color: tokens.colors.error }}>{t('files.loadFailed')}: {error}</span>}
      {url && <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
    </div>
  );
}
