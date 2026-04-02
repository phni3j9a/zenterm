import { useEffect, useState } from 'react';
import { getFileContent, writeFileContent } from '../../api/client';
import styles from './FileEditor.module.css';

interface FileEditorProps {
  path: string;
  onClose: () => void;
}

export function FileEditor({ path, onClose }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const filename = path.split('/').pop() ?? path;
  const isDirty = content !== originalContent;
  const canSave = isDirty && !truncated;

  const handleClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard?')) return;
    onClose();
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    setTruncated(false);
    getFileContent(path)
      .then((res) => {
        setContent(res.content);
        setOriginalContent(res.content);
        setTruncated(res.truncated);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [path]);

  const handleSave = async () => {
    if (truncated) return;

    setSaving(true);
    setError('');
    try {
      await writeFileContent(path, content);
      setOriginalContent(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleClose();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (canSave) void handleSave();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.filename}>{filename}</span>
          <span className={styles.path}>{path}</span>
          {truncated && (
            <span className={styles.truncatedWarning}>
              File too large to edit (first 1000 lines shown)
            </span>
          )}
          <div className={styles.headerActions}>
            {saved && <span className={styles.savedBadge}>Saved</span>}
            {canSave && (
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button className={styles.closeBtn} onClick={handleClose}>
              &times;
            </button>
          </div>
        </div>
        <div className={styles.body}>
          {loading && <div className={styles.message}>Loading...</div>}
          {error && <div className={styles.messageError}>{error}</div>}
          {!loading && !error && (
            <textarea
              className={styles.editor}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              readOnly={truncated}
              spellCheck={false}
              autoFocus
            />
          )}
        </div>
      </div>
    </div>
  );
}
