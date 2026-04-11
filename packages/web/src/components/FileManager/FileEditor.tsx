import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFileContent, writeFileContent } from '../../api/client';
import styles from './FileEditor.module.css';

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mkd', '.mdx']);

export function isMarkdownFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return MD_EXTENSIONS.has(ext);
}

interface FileEditorProps {
  path: string;
  onClose: () => void;
}

export function FileEditor({ path, onClose }: FileEditorProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const filename = path.split('/').pop() ?? path;
  const isDirty = content !== originalContent;
  const canSave = isDirty && !truncated;
  const isMd = isMarkdownFile(filename);

  const handleClose = () => {
    if (isDirty && !window.confirm(t('fileEditor.discardConfirm'))) return;
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

  const renderedMarkdown = useMemo(() => {
    if (!previewMode || !isMd) return '';
    try {
      // Lazy import — marked and DOMPurify loaded via dynamic import in effect
      // Use simple regex-based rendering for SSR safety; real rendering done via dangerouslySetInnerHTML
      return content;
    } catch {
      return content;
    }
  }, [content, previewMode, isMd]);

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.filename}>{filename}</span>
          <span className={styles.path}>{path}</span>
          {truncated && (
            <span className={styles.truncatedWarning}>
              {t('fileEditor.truncatedWarning')}
            </span>
          )}
          <div className={styles.headerActions}>
            {isMd && (
              <button
                className={styles.saveBtn}
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? t('fileEditor.edit') : t('fileEditor.preview')}
              </button>
            )}
            {saved && <span className={styles.savedBadge}>{t('fileEditor.saved')}</span>}
            {canSave && (
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t('fileEditor.saving') : t('fileEditor.save')}
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
          {!loading && !error && previewMode && isMd && (
            <MarkdownRenderer content={renderedMarkdown} />
          )}
          {!loading && !error && !previewMode && (
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

function MarkdownRenderer({ content }: { content: string }) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([import('marked'), import('dompurify')]).then(
      ([{ marked }, DOMPurify]) => {
        if (cancelled) return;
        const raw = marked.parse(content);
        if (typeof raw === 'string') {
          setHtml(DOMPurify.default.sanitize(raw));
        } else {
          raw.then((r) => {
            if (!cancelled) setHtml(DOMPurify.default.sanitize(r));
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [content]);

  return (
    <div
      className={styles.markdownPreview}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
