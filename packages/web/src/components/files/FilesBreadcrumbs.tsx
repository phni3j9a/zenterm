import { useTheme } from '@/theme';
import { buildBreadcrumbSegments } from '@/lib/filesPath';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export function FilesBreadcrumbs({ path, onNavigate }: Props) {
  const { tokens } = useTheme();
  const segments = buildBreadcrumbSegments(path);
  const root = path.startsWith('/') ? '/' : '~';
  const rootLabel = root === '/' ? '/' : 'Home';

  const btnStyle = {
    background: 'none' as const,
    border: 'none' as const,
    color: tokens.colors.textSecondary,
    cursor: 'pointer' as const,
    padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
    fontSize: tokens.typography.bodyMedium.fontSize,
    maxWidth: 120,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  };
  const sepStyle = { color: tokens.colors.textMuted, padding: `0 ${tokens.spacing.xs}px` };

  return (
    <nav
      aria-label="Files breadcrumbs"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        background: tokens.colors.bgElevated,
      }}
    >
      <button type="button" onClick={() => onNavigate(root)} style={btnStyle} aria-label={rootLabel === 'Home' ? 'Home' : '/'}>
        {rootLabel}
      </button>
      {segments.map((seg) => (
        <span key={seg.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span style={sepStyle}>/</span>
          <button
            type="button"
            onClick={() => onNavigate(seg.path)}
            style={btnStyle}
            title={seg.path}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
