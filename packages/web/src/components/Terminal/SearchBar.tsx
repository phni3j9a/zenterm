import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import type { SearchAddon as SearchAddonType } from '@xterm/addon-search';
import { useTranslation } from 'react-i18next';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  searchRef: MutableRefObject<SearchAddonType | null>;
  visible: boolean;
  onClose: () => void;
}

export function SearchBar({ searchRef, visible, onClose }: SearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      searchRef.current?.clearDecorations();
    }
  }, [visible, searchRef]);

  const findNext = useCallback(() => {
    if (query) searchRef.current?.findNext(query);
  }, [query, searchRef]);

  const findPrevious = useCallback(() => {
    if (query) searchRef.current?.findPrevious(query);
  }, [query, searchRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) findPrevious();
      else findNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [findNext, findPrevious, onClose]);

  if (!visible) return null;

  return (
    <div className={styles.bar}>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('terminal.searchPlaceholder')}
      />
      <button className={styles.btn} onClick={findPrevious} title={t('terminal.searchPrev')}>▲</button>
      <button className={styles.btn} onClick={findNext} title={t('terminal.searchNext')}>▼</button>
      <button className={styles.btn} onClick={onClose} title={t('common.close')}>✕</button>
    </div>
  );
}
