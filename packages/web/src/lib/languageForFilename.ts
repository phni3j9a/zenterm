import type { Extension } from '@codemirror/state';

function getExt(name: string): string {
  return name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : '';
}

/**
 * Lazy-load the appropriate CodeMirror language extension for a given filename.
 * Returns null when no language matches (CodeMirror falls back to plain text).
 */
export async function languageForFilename(filename: string): Promise<Extension | null> {
  const ext = getExt(filename);
  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs': {
      const m = await import('@codemirror/lang-javascript');
      return m.javascript({ jsx: ext === '.jsx' || ext === '.tsx', typescript: ext === '.ts' || ext === '.tsx' });
    }
    case '.json':
    case '.jsonc': {
      const m = await import('@codemirror/lang-json');
      return m.json();
    }
    case '.md':
    case '.markdown':
    case '.mdx': {
      const m = await import('@codemirror/lang-markdown');
      return m.markdown();
    }
    case '.py': {
      const m = await import('@codemirror/lang-python');
      return m.python();
    }
    case '.html':
    case '.htm': {
      const m = await import('@codemirror/lang-html');
      return m.html();
    }
    case '.css':
    case '.scss': {
      const m = await import('@codemirror/lang-css');
      return m.css();
    }
    default:
      return null;
  }
}
