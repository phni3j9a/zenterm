export interface BreadcrumbSegment {
  key: string;
  label: string;
  path: string;
}

export function buildEntryPath(parentPath: string, name: string): string {
  if (parentPath === '/') return `/${name}`;
  if (parentPath === '~') return `~/${name}`;
  return `${parentPath.replace(/\/+$/, '')}/${name}`;
}

export function getParentPath(path: string): string {
  if (!path || path === '~' || path === '/') {
    return path || '~';
  }
  if (path.startsWith('~/')) {
    const parts = path.slice(2).split('/').filter(Boolean);
    return parts.length <= 1 ? '~' : `~/${parts.slice(0, -1).join('/')}`;
  }
  if (path.startsWith('/')) {
    const parts = path.split('/').filter(Boolean);
    return parts.length <= 1 ? '/' : `/${parts.slice(0, -1).join('/')}`;
  }
  const parts = path.split('/').filter(Boolean);
  return parts.length <= 1 ? '~' : parts.slice(0, -1).join('/');
}

export function buildBreadcrumbSegments(path: string): BreadcrumbSegment[] {
  if (!path || path === '~' || path === '/') return [];
  if (path.startsWith('~/')) {
    const parts = path.slice(2).split('/').filter(Boolean);
    return parts.map((label, index) => ({
      key: `home:${parts.slice(0, index + 1).join('/')}`,
      label,
      path: `~/${parts.slice(0, index + 1).join('/')}`,
    }));
  }
  if (path.startsWith('/')) {
    const parts = path.split('/').filter(Boolean);
    return parts.map((label, index) => ({
      key: `abs:${parts.slice(0, index + 1).join('/')}`,
      label,
      path: `/${parts.slice(0, index + 1).join('/')}`,
    }));
  }
  const parts = path.split('/').filter(Boolean);
  return parts.map((label, index) => ({
    key: `rel:${parts.slice(0, index + 1).join('/')}`,
    label,
    path: parts.slice(0, index + 1).join('/'),
  }));
}
