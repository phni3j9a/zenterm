import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface Props {
  onFiles: (files: File[]) => void;
}

export function FilesUploadDropZone({ onFiles }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    let counter = 0;
    const enter = (e: DragEvent) => {
      if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
      counter++;
      setActive(true);
    };
    const leave = () => {
      counter = Math.max(0, counter - 1);
      if (counter === 0) setActive(false);
    };
    const over = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      role="region"
      aria-label="Upload drop zone"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        setActive(false);
        if (files.length > 0) onFiles(files);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        color: tokens.colors.textPrimary,
        fontSize: tokens.typography.heading.fontSize,
        pointerEvents: 'auto',
      }}
    >
      {t('files.uploadDropHint')}
    </div>
  );
}
