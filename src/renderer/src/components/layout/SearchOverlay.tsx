import { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { projectApi } from '../../api/client';
import { useAppStore } from '../../stores';

export function SearchOverlay() {
  const { t } = useTranslation('app');
  const shouldReduceMotion = useReducedMotion();
  const { setActiveContent, activeBookId } = useAppStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ pageId: string; title: string; preview: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await projectApi.search(searchQuery.trim());
        setSearchResults(result.data ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close on outside click
  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen]);

  // Auto-focus input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  return (
    <div ref={searchRef} className="relative flex items-center">
      {searchOpen ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('layout.search.placeholder')}
            className="w-64 rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-100 outline-none placeholder-gray-500 focus:border-gray-500"
          />
          {searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded border border-gray-700 bg-gray-800 shadow-lg">
              {searching ? (
                <div className="px-3 py-2 text-xs text-gray-400">{t('layout.search.searching')}</div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-400">{t('layout.search.noResults')}</div>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.pageId}
                    onClick={() => {
                      setActiveContent({
                        kind: 'page',
                        bookId: activeBookId,
                        pageId: result.pageId,
                      });
                      setSearchOpen(false);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-gray-700"
                  >
                    <div className="text-sm text-gray-100">{result.title}</div>
                    <div className="truncate text-xs text-gray-400">{result.preview}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <motion.button
          onClick={() => setSearchOpen(true)}
          className="focus-ring rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          title={t('layout.header.searchSections')}
          aria-label={t('layout.header.toggleSearch')}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </motion.button>
      )}
    </div>
  );
}
