import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AuthenticatedShell } from '@/components/AuthenticatedShell';
import { useFilesStore } from '@/stores/files';

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export function FilesRoute() {
  const params = useParams();
  const splat = params['*'] ?? '';

  useEffect(() => {
    if (!splat) return;
    const decoded = safeDecode(splat);
    if (decoded === null) return;
    const path = decoded.startsWith('/') ? decoded : `/${decoded}`;
    useFilesStore.getState().setCurrentPath(path);
  }, [splat]);

  return <AuthenticatedShell />;
}
