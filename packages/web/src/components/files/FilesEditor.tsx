import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Extension } from '@codemirror/state';
import { useTheme } from '@/theme';
import { languageForFilename } from '@/lib/languageForFilename';

const CodeMirror = lazy(() => import('@uiw/react-codemirror').then((m) => ({ default: m.default })));

interface Props {
  filename: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function FilesEditor({ filename, value, onChange, onSave }: Props) {
  const { tokens } = useTheme();
  const dark = tokens.colors.bg && tokens.colors.bg.toLowerCase() !== '#ffffff';
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lang = await languageForFilename(filename);
      if (cancelled) return;
      setExtensions(lang ? [lang] : []);
    })();
    return () => { cancelled = true; };
  }, [filename]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSaveRef.current();
    }
  };

  // theme is loaded on demand so we don't tie a synchronous import to module load.
  const [themeExt, setThemeExt] = useState<Extension | null>(null);
  useEffect(() => {
    if (!dark) { setThemeExt(null); return; }
    let cancelled = false;
    (async () => {
      const m = await import('@codemirror/theme-one-dark');
      if (cancelled) return;
      setThemeExt(m.oneDark);
    })();
    return () => { cancelled = true; };
  }, [dark]);

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Suspense fallback={<div style={{ padding: tokens.spacing.md, color: tokens.colors.textMuted }}>Loading editor…</div>}>
        <CodeMirror
          value={value}
          theme={themeExt ?? undefined}
          extensions={extensions}
          onChange={(v) => onChange(v)}
          height="100%"
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
        />
      </Suspense>
    </div>
  );
}
