import { useEffect, useState } from 'react';
import { getFileRawBlobUrl } from '../../api/client';
import styles from './ImagePreview.module.css';

const PDF_EXTENSIONS = new Set(['.pdf']);

export function isPdfFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return PDF_EXTENSIONS.has(ext);
}

interface PdfPreviewProps {
  path: string;
  onClose: () => void;
}

export function PdfPreview({ path, onClose }: PdfPreviewProps) {
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
            <iframe
              src={blobUrl}
              title={filename}
              className={styles.image}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
