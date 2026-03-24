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

  const filename = path.split('/').pop() ?? path;
  const isDirty = content !== originalContent;

  useEffect(() => {
    setLoading(true);
    setError('');
    getFileContent(path)
      .then((res) => {
        setContent(res.content);
        setOriginalContent(res.content);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [path]);

  const handleSave = async () => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (isDirty) handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.filename}>{filename}</span>
          <span className={styles.path}>{path}</span>
          <div className={styles.headerActions}>
            {saved && <span className={styles.savedBadge}>Saved</span>}
            {isDirty && (
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>
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
              spellCheck={false}
              autoFocus
            />
          )}
        </div>
      </div>
    </div>
  );
}
