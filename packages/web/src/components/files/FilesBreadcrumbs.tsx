import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { buildBreadcrumbSegments } from '@/lib/filesPath';
import { IconHome, IconChevronRight } from '@/components/ui/icons';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export function FilesBreadcrumbs({ path, onNavigate }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const segments = buildBreadcrumbSegments(path);
  const root = path.startsWith('/') ? '/' : '~';

  const baseBtnStyle = {
    background: 'none' as const,
    border: 'none' as const,
    cursor: 'pointer' as const,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    fontSize: tokens.typography.bodyMedium.fontSize,
    maxWidth: 120,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    borderRadius: 4,
  };

  return (
    <nav
      role="navigation"
      aria-label={t('files.breadcrumb')}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
      }}
    >
      <button
        type="button"
        onClick={() => onNavigate(root)}
        style={{ ...baseBtnStyle, color: segments.length === 0 ? tokens.colors.textPrimary : tokens.colors.textSecondary }}
        aria-label={t('files.home')}
        aria-current={segments.length === 0 ? 'page' : undefined}
      >
        <IconHome size={14} />
      </button>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={seg.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <IconChevronRight size={12} style={{ color: tokens.colors.textMuted, flexShrink: 0 }} />
            <button
              type="button"
              onClick={() => onNavigate(seg.path)}
              style={{
                ...baseBtnStyle,
                color: isLast ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                fontWeight: isLast ? 600 : undefined,
                cursor: isLast ? 'default' : 'pointer',
              }}
              aria-current={isLast ? 'page' : undefined}
              aria-label={seg.label}
              title={seg.path}
            >
              {seg.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
