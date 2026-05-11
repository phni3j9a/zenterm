import { useEffect, useState } from 'react';

export interface AuthorizedBlobUrl {
  url: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch the resource at `sourceUrl` with `Authorization: Bearer <token>`,
 * convert the response Blob into a same-origin blob: URL, and revoke it on
 * unmount or input change. When `sourceUrl` is null, no fetch occurs.
 */
export function useAuthorizedBlobUrl(sourceUrl: string | null, token: string | null): AuthorizedBlobUrl {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(sourceUrl !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceUrl) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    setUrl(null);

    (async () => {
      try {
        const res = await fetch(sourceUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [sourceUrl, token]);

  return { url, loading, error };
}
