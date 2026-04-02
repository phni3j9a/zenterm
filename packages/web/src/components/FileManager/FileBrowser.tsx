import { useEffect, useState, useCallback } from 'react';
import { listFiles } from '../../api/client';
import type { FileEntry } from '@zenterm/shared';
import { FileEditor } from './FileEditor';
import { FileUpload } from './FileUpload';
import styles from './FileBrowser.module.css';

export function FileBrowser() {
  const [currentPath, setCurrentPath] = useState('~');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHidden, setShowHidden] = useState(true);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listFiles(currentPath, showHidden);
      setEntries(res.entries);
      setCurrentPath(res.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentPath, showHidden]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const navigate = (entry: FileEntry) => {
    const effectiveType = entry.type === 'symlink' ? (entry.resolvedType ?? 'directory') : entry.type;
    if (effectiveType === 'directory') {
      setCurrentPath(`${currentPath}/${entry.name}`);
    } else if (effectiveType === 'file') {
      setEditingFile(`${currentPath}/${entry.name}`);
    }
  };

  const goUp = () => {
    const parts = currentPath.split('/');
    if (parts.length > 1) {
      parts.pop();
      setCurrentPath(parts.join('/') || '/');
    }
  };

  const goHome = () => setCurrentPath('~');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} K`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} M`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} G`;
  };

  const getIcon = (entry: FileEntry) => {
    if (entry.type === 'directory') return '\u{1F4C1}';
    if (entry.type === 'symlink') return '\u{1F517}';
    return '\u{1F4C4}';
  };

  const pathSegments = currentPath.split('/').filter(Boolean);

  return (
    <div className={styles.browser}>
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={goHome} title="Home">
          ~
        </button>
        <button className={styles.toolBtn} onClick={goUp} title="Up" disabled={currentPath === '/' || currentPath === '~'}>
          ..
        </button>
        <button className={styles.toolBtn} onClick={() => setShowHidden(!showHidden)} title="Toggle hidden" data-active={showHidden}>
          .*
        </button>
        <button className={styles.toolBtn} onClick={() => setShowUpload(true)} title="Upload">
          +
        </button>
      </div>

      <div className={styles.breadcrumb}>
        {pathSegments.map((seg, i) => (
          <span key={i}>
            {i > 0 && <span className={styles.sep}>/</span>}
            <button
              className={styles.crumb}
              onClick={() => setCurrentPath('/' + pathSegments.slice(0, i + 1).join('/'))}
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      <div className={styles.list}>
        {loading && entries.length === 0 && (
          <div className={styles.message}>Loading...</div>
        )}
        {error && <div className={styles.messageError}>{error}</div>}
        {!loading && !error && entries.length === 0 && (
          <div className={styles.message}>Empty directory</div>
        )}
        {entries.map((entry) => (
          <button
            key={entry.name}
            className={styles.entry}
            onClick={() => navigate(entry)}
          >
            <span className={styles.entryIcon}>{getIcon(entry)}</span>
            <span className={styles.entryName} data-type={entry.type}>
              {entry.name}
              {entry.symlinkTarget && (
                <span className={styles.symTarget}> &rarr; {entry.symlinkTarget}</span>
              )}
            </span>
            {entry.type === 'file' && (
              <span className={styles.entrySize}>{formatSize(entry.size)}</span>
            )}
          </button>
        ))}
      </div>

      {editingFile && (
        <FileEditor
          path={editingFile}
          onClose={() => setEditingFile(null)}
        />
      )}

      {showUpload && (
        <FileUpload
          currentPath={currentPath}
          onClose={() => setShowUpload(false)}
          onUploaded={fetchEntries}
        />
      )}
    </div>
  );
}
