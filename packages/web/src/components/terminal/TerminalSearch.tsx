import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

export interface TerminalSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface TerminalSearchApi {
  findNext: (query: string, opts: TerminalSearchOptions) => boolean;
  findPrevious: (query: string, opts: TerminalSearchOptions) => boolean;
  clearDecorations: () => void;
}

export interface TerminalSearchProps {
  open: boolean;
  api: TerminalSearchApi;
  onClose: () => void;
}

export function TerminalSearch({ open, api, onClose }: TerminalSearchProps) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const opts: TerminalSearchOptions = { caseSensitive, wholeWord, regex };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (!query) return;
      if (ev.shiftKey) api.findPrevious(query, opts);
      else api.findNext(query, opts);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      api.clearDecorations();
      onClose();
    }
  };

  const toggleBtn = (active: boolean, onClick: () => void, label: string, glyph: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        background: active ? tokens.colors.primarySubtle : 'transparent',
        border: `1px solid ${active ? tokens.colors.primary : tokens.colors.borderSubtle}`,
        color: active ? tokens.colors.primary : tokens.colors.textSecondary,
        padding: '2px 6px',
        borderRadius: tokens.radii.sm,
        cursor: 'pointer',
        fontSize: tokens.typography.caption.fontSize,
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        gap: tokens.spacing.xs,
        alignItems: 'center',
        padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        background: tokens.colors.bgElevated,
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
      }}
    >
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('terminal.search.placeholder')}
        style={{
          flex: 1,
          background: tokens.colors.surface,
          border: `1px solid ${tokens.colors.borderSubtle}`,
          color: tokens.colors.textPrimary,
          padding: '2px 6px',
          borderRadius: tokens.radii.sm,
          fontSize: tokens.typography.caption.fontSize,
        }}
      />
      {toggleBtn(caseSensitive, () => setCaseSensitive((v) => !v), t('terminal.search.caseSensitive'), 'Aa')}
      {toggleBtn(wholeWord, () => setWholeWord((v) => !v), t('terminal.search.wholeWord'), 'W')}
      {toggleBtn(regex, () => setRegex((v) => !v), t('terminal.search.regex'), '.*')}
      <button
        type="button"
        aria-label={t('terminal.search.findPrev')}
        onClick={() => query && api.findPrevious(query, opts)}
        style={{ background: 'transparent', border: 'none', color: tokens.colors.textSecondary, cursor: 'pointer' }}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={t('terminal.search.findNext')}
        onClick={() => query && api.findNext(query, opts)}
        style={{ background: 'transparent', border: 'none', color: tokens.colors.textSecondary, cursor: 'pointer' }}
      >
        ↓
      </button>
      <button
        type="button"
        aria-label={t('terminal.search.close')}
        onClick={() => {
          api.clearDecorations();
          onClose();
        }}
        style={{ background: 'transparent', border: 'none', color: tokens.colors.textSecondary, cursor: 'pointer' }}
      >
        ✕
      </button>
    </div>
  );
}
