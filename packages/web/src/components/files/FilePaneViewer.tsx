import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui';
import { useTheme } from '@/theme';
import { getPreviewKind, type PreviewKind } from '@/lib/filesIcon';
import { FilesViewerHeader } from './FilesViewerHeader';
import { FilesTextViewer } from './FilesTextViewer';
import { FilesImageViewer } from './FilesImageViewer';
import { FilesMarkdownViewer } from './FilesMarkdownViewer';
import { FilesEditor } from './FilesEditor';
import type { FilesApiClient } from './filesApi';

interface Props {
  path: string;
  client: FilesApiClient;
  token: string | null;
  onClose: () => void;
}

export function FilePaneViewer({ path, client, token, onClose }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const name = path.split('/').filter(Boolean).slice(-1)[0] ?? path;
  const kind: PreviewKind = getPreviewKind(name);

  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLines, setTextLines] = useState(0);
  const [textTruncated, setTextTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMarkdownRendered, setShowMarkdownRendered] = useState(true);

  const isDirty = isEditing && editContent !== (textContent ?? '');
  const fetchSeq = useRef(0);

  useEffect(() => {
    if (kind !== 'text' && kind !== 'markdown') return;
    const myId = ++fetchSeq.current;
    setError(null);
    (async () => {
      try {
        const res = await client.getFileContent(path);
        if (myId !== fetchSeq.current) return;
        setTextContent(res.content);
        setTextLines(res.lines);
        setTextTruncated(res.truncated);
      } catch (err) {
        if (myId !== fetchSeq.current) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [path, kind, client]);

  useEffect(() => {
    setIsEditing(false);
    setEditContent('');
  }, [path]);

  const startEditing = () => {
    setEditContent(textContent ?? '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.writeFileContent(path, editContent);
      setTextContent(editContent);
      setIsEditing(false);
      useUiStore.getState().pushToast({ type: 'success', message: t('files.saved') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useUiStore.getState().pushToast({ type: 'error', message: `${t('files.saveFailed')}: ${msg}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(client.buildRawFileUrl(path), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useUiStore.getState().pushToast({ type: 'error', message: `${t('files.downloadFailed')}: ${msg}` });
    }
  };

  const containerStyle = {
    flex: 1,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    background: tokens.colors.bg,
    minWidth: 0,
    height: '100%',
  };

  if (error) {
    return (
      <div style={containerStyle}>
        <FilesViewerHeader
          name={name}
          kind={kind}
          isEditing={false}
          isDirty={false}
          saving={false}
          showMarkdownRendered={false}
          onEdit={() => {}}
          onSave={() => {}}
          onCancel={() => {}}
          onDownload={handleDownload}
          onToggleMarkdown={() => {}}
          onClose={onClose}
        />
        <div role="alert" style={{ padding: tokens.spacing.md, color: tokens.colors.error }}>
          {t('files.loadFailed')}: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <FilesViewerHeader
        name={name}
        kind={kind}
        isEditing={isEditing}
        isDirty={isDirty}
        saving={saving}
        showMarkdownRendered={showMarkdownRendered}
        onEdit={startEditing}
        onSave={handleSave}
        onCancel={cancelEditing}
        onDownload={handleDownload}
        onToggleMarkdown={() => setShowMarkdownRendered((v) => !v)}
        onClose={onClose}
      />
      {kind === 'unsupported' && (
        <div
          role="status"
          aria-label={t('files.cannotOpen')}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: tokens.spacing.sm,
            color: tokens.colors.textMuted,
            padding: tokens.spacing.lg,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: tokens.typography.heading.fontSize }}>{t('files.cannotOpen')}</div>
          <div style={{ fontSize: tokens.typography.bodyMedium.fontSize }}>
            {t('files.cannotOpenDesc', { name })}
          </div>
        </div>
      )}
      {kind === 'image' && (
        <FilesImageViewer rawUrl={client.buildRawFileUrl(path)} token={token} name={name} />
      )}
      {(kind === 'text' || kind === 'markdown') && isEditing && (
        <FilesEditor
          filename={name}
          value={editContent}
          onChange={setEditContent}
          onSave={handleSave}
        />
      )}
      {kind === 'text' && !isEditing && (
        <FilesTextViewer textContent={textContent} textLines={textLines} textTruncated={textTruncated} />
      )}
      {kind === 'markdown' && !isEditing && (
        showMarkdownRendered
          ? <FilesMarkdownViewer source={textContent ?? ''} />
          : <FilesTextViewer textContent={textContent} textLines={textLines} textTruncated={textTruncated} />
      )}
    </div>
  );
}
