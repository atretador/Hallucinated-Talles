import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';

export function BookSelector() {
  const { t } = useTranslation('app');
  const {
    bookLoading,
    books,
    book,
    activeBookId,
    fetchBooks,
    switchBook,
    createBook,
  } = useAppStore();

  const [bookSwitcherOpen, setBookSwitcherOpen] = useState(false);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [creatingBook, setCreatingBook] = useState(false);
  const bookSwitcherRef = useRef<HTMLDivElement>(null);
  const newBookInputRef = useRef<HTMLInputElement>(null);

  // Fetch books on mount
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Close book switcher on outside click
  useEffect(() => {
    if (!bookSwitcherOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (bookSwitcherRef.current && !bookSwitcherRef.current.contains(e.target as Node)) {
        setBookSwitcherOpen(false);
        setNewBookOpen(false);
        setNewBookTitle('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [bookSwitcherOpen]);

  // Auto-focus new book input when opened
  useEffect(() => {
    if (newBookOpen && newBookInputRef.current) {
      newBookInputRef.current.focus();
    }
  }, [newBookOpen]);

  const handleCreateBook = useCallback(async () => {
    const title = newBookTitle.trim();
    if (!title || creatingBook) return;
    setCreatingBook(true);
    try {
      await createBook(title);
      setNewBookOpen(false);
      setNewBookTitle('');
      setBookSwitcherOpen(false);
    } catch {
      // silently fail
      console.debug('[BookSelector] Create book failed, failing silently');
    } finally {
      setCreatingBook(false);
    }
  }, [newBookTitle, creatingBook, createBook]);

  return (
    <div ref={bookSwitcherRef} className="relative hidden sm:block">
      {bookLoading ? (
        <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
      ) : books.length === 0 ? (
        <span className="ml-1 text-xs text-gray-400">
          —{' '}
          {newBookOpen ? (
            <span className="inline-flex items-center gap-1">
              <input
                ref={newBookInputRef}
                type="text"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateBook();
                  if (e.key === 'Escape') {
                    setNewBookOpen(false);
                    setNewBookTitle('');
                  }
                }}
                placeholder={t('layout.bookSelector.bookTitle')}
                className="w-40 rounded border border-gray-600 bg-gray-900 px-2 py-0.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500"
              />
              <button
                onClick={handleCreateBook}
                disabled={creatingBook || !newBookTitle.trim()}
                className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {creatingBook ? t('layout.bookSelector.creating') : t('layout.bookSelector.create')}
              </button>
              <button
                onClick={() => {
                  setNewBookOpen(false);
                  setNewBookTitle('');
                }}
                disabled={creatingBook}
                className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
              >
                {t('buttons.cancel', { ns: 'common' })}
              </button>
            </span>
          ) : (
            <button
              onClick={() => setNewBookOpen(true)}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {t('layout.bookSelector.createBook')}
            </button>
          )}
        </span>
      ) : (
        <>
          <button
            onClick={() => setBookSwitcherOpen(!bookSwitcherOpen)}
            className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
          >
            <span>{t('layout.bookSelector.placeholder', { title: book?.title ?? t('layout.bookSelector.untitled') })}</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {bookSwitcherOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded border border-gray-700 bg-gray-800 shadow-lg">
              <div className="max-h-48 overflow-y-auto p-1">
                {books.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      switchBook(b.id);
                      setBookSwitcherOpen(false);
                    }}
                    className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors ${
                      b.id === activeBookId
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {b.title}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-700 p-2">
                {newBookOpen ? (
                  <div className="space-y-2">
                    <input
                      ref={newBookInputRef}
                      type="text"
                      value={newBookTitle}
                      onChange={(e) => setNewBookTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateBook();
                        if (e.key === 'Escape') {
                          setNewBookOpen(false);
                          setNewBookTitle('');
                        }
                      }}
                      placeholder={t('layout.bookSelector.newBookTitle')}
                      className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateBook}
                        disabled={creatingBook || !newBookTitle.trim()}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {creatingBook ? t('layout.bookSelector.creating') : t('layout.bookSelector.create')}
                      </button>
                      <button
                        onClick={() => {
                          setNewBookOpen(false);
                          setNewBookTitle('');
                        }}
                        disabled={creatingBook}
                        className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                      >
                        {t('buttons.cancel', { ns: 'common' })}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewBookOpen(true)}
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-blue-400 hover:bg-gray-700"
                  >
                    {t('layout.bookSelector.newBook')}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
