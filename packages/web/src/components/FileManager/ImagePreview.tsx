import { useEffect, useState } from 'react';
import { getFileRawBlobUrl } from '../../api/client';
import styles from './ImagePreview.module.css';

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif',
]);

export function isImageFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

interface ImagePreviewProps {
  path: string;
  onClose: () => void;
}

export function ImagePreview({ path, onClose }: ImagePreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filename = path.split('/').pop() ?? path;

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;

    setLoading(true);
    setError('');

    getFileRawBlobUrl(path)
      .then((u) => {
        if (revoked) {
          URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setBlobUrl(u);
      })
      .catch((e) => {
        if (!revoked) setError((e as Error).message);
      })
      .finally(() => {
        if (!revoked) setLoading(false);
      });

    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.filename}>{filename}</span>
          <span className={styles.path}>{path}</span>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>
        <div className={styles.body}>
          {loading && <div className={styles.message}>Loading...</div>}
          {error && <div className={styles.messageError}>{error}</div>}
          {blobUrl && (
            <img
              src={blobUrl}
              alt={filename}
              className={styles.image}
              draggable={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
