import { useEffect, useState, useCallback } from 'react';
import { listFiles, deleteFile, renameFile, mkdir, writeFileContent } from '../../api/client';
import type { FileEntry } from '@zenterm/shared';
import { FileEditor } from './FileEditor';
import { FileUpload } from './FileUpload';
import { ImagePreview, isImageFile } from './ImagePreview';
import { PdfPreview, isPdfFile } from './PdfPreview';
import { ContextMenu, type MenuItem } from '../ui/ContextMenu';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import styles from './FileBrowser.module.css';

interface ContextMenuState {
  x: number;
  y: number;
  entry: FileEntry;
}

export function FileBrowser() {
  const [currentPath, setCurrentPath] = useState('~');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHidden, setShowHidden] = useState(true);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingType, setCreatingType] = useState<'file' | 'directory' | null>(null);
  const [createName, setCreateName] = useState('');

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

  // Reset search and creation when navigating
  useEffect(() => {
    setSearchQuery('');
    setCreatingType(null);
    setRenamingEntry(null);
  }, [currentPath]);

  const navigate = (entry: FileEntry) => {
    const effectiveType = entry.type === 'symlink' ? (entry.resolvedType ?? 'directory') : entry.type;
    const fullPath = `${currentPath}/${entry.name}`;
    if (effectiveType === 'directory') {
      setCurrentPath(fullPath);
    } else if (effectiveType === 'file') {
      if (isImageFile(entry.name)) {
        setPreviewImage(fullPath);
      } else if (isPdfFile(entry.name)) {
        setPreviewPdf(fullPath);
      } else {
        setEditingFile(fullPath);
      }
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
    if (isImageFile(entry.name)) return '\u{1F5BC}';
    if (isPdfFile(entry.name)) return '\u{1F4D1}';
    return '\u{1F4C4}';
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const buildContextMenuItems = (entry: FileEntry): MenuItem[] => {
    const fullPath = `${currentPath}/${entry.name}`;
    const items: MenuItem[] = [
      {
        label: 'Open',
        icon: '↗',
        action: () => navigate(entry),
      },
    ];

    if (entry.type === 'file' && isImageFile(entry.name)) {
      items.push({
        label: 'Preview',
        icon: '🖼',
        action: () => setPreviewImage(fullPath),
      });
    }

    items.push({
      label: 'Copy Path',
      icon: '📋',
      action: () => {
        const text = fullPath;
        navigator.clipboard?.writeText(text).catch(() => {
          // Fallback: no-op on insecure origins
        });
      },
    });

    items.push({
      label: 'Rename',
      icon: '✏️',
      action: () => {
        setRenamingEntry(entry.name);
        setRenameValue(entry.name);
      },
      divider: true,
    });

    items.push({
      label: 'Delete',
      icon: '🗑',
      action: () => setDeletingPath(fullPath),
      variant: 'danger',
    });

    return items;
  };

  const handleDelete = async () => {
    if (!deletingPath) return;
    try {
      await deleteFile(deletingPath);
      setDeletingPath(null);
      fetchEntries();
    } catch (e) {
      setError((e as Error).message);
      setDeletingPath(null);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renamingEntry || !renameValue.trim()) {
      setRenamingEntry(null);
      return;
    }
    const trimmed = renameValue.trim();
    if (trimmed === renamingEntry || trimmed.includes('/')) {
      setRenamingEntry(null);
      return;
    }
    try {
      await renameFile(`${currentPath}/${renamingEntry}`, trimmed);
      setRenamingEntry(null);
      fetchEntries();
    } catch (e) {
      setError((e as Error).message);
      setRenamingEntry(null);
    }
  };

  const handleCreateSubmit = async () => {
    if (!creatingType || !createName.trim()) {
      setCreatingType(null);
      setCreateName('');
      return;
    }
    const name = createName.trim();
    if (name.includes('/') || name === '.' || name === '..') {
      setCreatingType(null);
      setCreateName('');
      return;
    }
    const fullPath = `${currentPath}/${name}`;
    try {
      if (creatingType === 'directory') {
        await mkdir(fullPath);
      } else {
        await writeFileContent(fullPath, '');
      }
      setCreatingType(null);
      setCreateName('');
      fetchEntries();
    } catch (e) {
      setError((e as Error).message);
      setCreatingType(null);
      setCreateName('');
    }
  };

  const filteredEntries = searchQuery
    ? entries.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries;

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
          ⬆
        </button>
        <button className={styles.toolBtn} onClick={() => { setCreatingType('file'); setCreateName(''); }} title="New file">
          +F
        </button>
        <button className={styles.toolBtn} onClick={() => { setCreatingType('directory'); setCreateName(''); }} title="New directory">
          +D
        </button>
      </div>

      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Filter..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className={styles.searchClear} onClick={() => setSearchQuery('')}>
            &times;
          </button>
        )}
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
        {!loading && !error && filteredEntries.length === 0 && (
          <div className={styles.message}>
            {searchQuery ? 'No matches' : 'Empty directory'}
          </div>
        )}

        {creatingType && (
          <div className={styles.createRow}>
            <span className={styles.entryIcon}>
              {creatingType === 'directory' ? '\u{1F4C1}' : '\u{1F4C4}'}
            </span>
            <input
              className={styles.inlineInput}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onBlur={handleCreateSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubmit();
                if (e.key === 'Escape') { setCreatingType(null); setCreateName(''); }
              }}
              placeholder={creatingType === 'directory' ? 'New directory name' : 'New file name'}
              autoFocus
            />
          </div>
        )}

        {filteredEntries.map((entry) => (
          <button
            key={entry.name}
            className={styles.entry}
            draggable
            onDragStart={(e) => {
              const fullPath = `${currentPath}/${entry.name}`;
              e.dataTransfer.setData('application/x-zenterm-path', fullPath);
              e.dataTransfer.setData('text/plain', fullPath);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => {
              if (renamingEntry === entry.name) return;
              navigate(entry);
            }}
            onContextMenu={(e) => handleContextMenu(e, entry)}
          >
            <span className={styles.entryIcon}>{getIcon(entry)}</span>
            {renamingEntry === entry.name ? (
              <input
                className={styles.inlineInput}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenamingEntry(null);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <>
                <span className={styles.entryName} data-type={entry.type}>
                  {entry.name}
                  {entry.symlinkTarget && (
                    <span className={styles.symTarget}> &rarr; {entry.symlinkTarget}</span>
                  )}
                </span>
                {entry.type === 'file' && (
                  <span className={styles.entrySize}>{formatSize(entry.size)}</span>
                )}
              </>
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

      {previewImage && (
        <ImagePreview
          path={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {previewPdf && (
        <PdfPreview
          path={previewPdf}
          onClose={() => setPreviewPdf(null)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems(contextMenu.entry)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {deletingPath && (
        <ConfirmDialog
          title="Delete"
          message={`Are you sure you want to delete "${deletingPath.split('/').pop()}"?`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeletingPath(null)}
        />
      )}
    </div>
  );
}
