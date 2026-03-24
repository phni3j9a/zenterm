import { useState, useRef } from 'react';
import { uploadFile } from '../../api/client';
import styles from './FileUpload.module.css';

interface FileUploadProps {
  currentPath: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function FileUpload({ currentPath, onClose, onUploaded }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file, currentPath);
      }
      onUploaded();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Upload to {currentPath}</span>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>
        <div
          className={styles.dropZone}
          data-dragover={dragOver}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className={styles.fileInput}
            onChange={(e) => handleUpload(e.target.files)}
          />
          {uploading ? (
            <span className={styles.dropText}>Uploading...</span>
          ) : (
            <>
              <span className={styles.dropIcon}>+</span>
              <span className={styles.dropText}>
                Drop files here or click to select
              </span>
            </>
          )}
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
}
