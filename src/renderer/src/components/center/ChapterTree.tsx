import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAppStore } from '../../stores';
import { ChapterMenu } from './ChapterNode';
import { bookSettingsApi, type BookListItem } from '../../api/client';
import type { BookSettings } from '../../../../shared/types';
import { DEFAULT_BOOK_SETTINGS } from '../../../../shared/constants';
import { useTranslation } from 'react-i18next';

const fadeUpVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

/* ── Book Modal (create / edit) ───────────────────────────── */

interface BookModalProps {
  mode: 'create' | 'edit';
  initial?: BookListItem;
  onClose: () => void;
  onSaved: () => void;
}

function BookModal({ mode, initial, onClose, onSaved }: BookModalProps) {
  const { createBook, updateBookMeta } = useAppStore();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '');
  const [bookSettings, setBookSettings] = useState<BookSettings>(DEFAULT_BOOK_SETTINGS);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Load book settings in edit mode
  useEffect(() => {
    if (mode !== 'edit') return;
    bookSettingsApi.get().then((res) => {
      if (res.data) setBookSettings(res.data);
    }).catch(() => {/* use defaults */});
  }, [mode]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        await createBook(trimmedTitle, description.trim(), systemPrompt.trim());
      } else if (initial) {
        await updateBookMeta(initial.id, { title: trimmedTitle, description: description.trim(), systemPrompt: systemPrompt.trim() });
        // Save book settings (header mode, etc.)
        await bookSettingsApi.save(bookSettings).catch(() => {/* non-critical */});
      }
      onSaved();
    } catch {
      // Error handled by store
      console.debug('[ChapterTree] Book save failed, error handled by store');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-200">
            {mode === 'create' ? t('center.bookModal.newBook', { ns: 'app' }) : t('center.bookModal.editBook', { ns: 'app' })}
          </h3>

          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('center.bookModal.title', { ns: 'app' })}</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('center.bookModal.titlePlaceholder', { ns: 'app' })}
              className="w-full rounded bg-gray-900 px-2.5 py-1.5 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('center.bookModal.description', { ns: 'app' })}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('center.bookModal.descriptionPlaceholder', { ns: 'app' })}
              className="w-full rounded bg-gray-900 px-2.5 py-1.5 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t('center.bookModal.systemPrompt', { ns: 'app' })}
              <span className="ml-1 text-gray-500">{t('center.bookModal.systemPromptHint', { ns: 'app' })}</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t('center.bookModal.systemPromptPlaceholder', { ns: 'app' })}
              rows={4}
              className="w-full rounded bg-gray-900 px-2.5 py-1.5 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Export Header Mode removed */}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {t('buttons.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? t('buttons.saving', { ns: 'common' }) : mode === 'create' ? t('buttons.create', { ns: 'common' }) : t('buttons.save', { ns: 'common' })}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── 3-dot menu ──────────────────────────────────────────── */

function BookMenu({
  bookId,
  onEdit,
}: {
  bookId: string;
  onEdit: () => void;
}) {
  const { deleteBook } = useAppStore();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
          setConfirming(false);
        }}
        className="shrink-0 rounded p-0.5 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-300 hover:bg-gray-700/50"
      >
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full z-40 mt-1 w-36 rounded-md bg-gray-800 border border-gray-700 py-1 shadow-lg"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t('buttons.edit', { ns: 'common' })}
            </button>
            {!confirming ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('buttons.delete', { ns: 'common' })}
              </button>
            ) : (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setOpen(false);
                  setConfirming(false);
                  await deleteBook(bookId);
                }}
                onBlur={() => {
                  setConfirming(false);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-300 bg-red-900/30 hover:bg-red-900/50"
              >
                {t('center.chapterTree.bookMenu.confirmDelete', { ns: 'app' })}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Book Node ───────────────────────────────────────────── */

function BookNode({
  bookId,
  book,
  isActive,
  onSelect,
  onEdit,
}: {
  bookId: string;
  book: BookListItem;
  isActive: boolean;
  onSelect: () => void;
  onEdit: (book: BookListItem) => void;
}) {
  const { activeContent, setActiveContent, book: activeBook, addItem, updateItem, editorPageData } = useAppStore();
  const shouldReduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(isActive);
  const [newChapterOpen, setNewChapterOpen] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const { t } = useTranslation();

  // Auto-expand when becoming active
  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: 'easeOut' as const };

  const handleSelect = () => {
    if (!isActive) {
      onSelect();
    }
    setExpanded(true);
    setActiveContent({ kind: 'full_book', bookId });
  };

  // Construct full cover image URL from relative path
  const coverImgSrc = book.coverUrl
    ? `http://localhost:${window.electron?.getApiPort() ?? '3000'}${book.coverUrl}`
    : null;

  const chapters = activeBook?.items.filter(i => i.type === 'chapter') ?? [];

  return (
    <div className="mb-1">
      {/* Book header */}
      <div className="group flex items-center rounded px-2 py-1.5 text-sm hover:bg-gray-700/50">
        <button
          onClick={() => {
            setExpanded(!expanded);
            handleSelect();
          }}
          className="flex flex-1 items-center gap-1.5 text-left min-w-0"
        >
          <svg
            className={`h-3 w-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {/* Book cover thumbnail or fallback icon */}
          {coverImgSrc ? (
            <img
              src={coverImgSrc}
              alt={`${book.title} cover`}
              className="h-7 w-5 shrink-0 rounded-sm object-cover ring-1 ring-gray-600"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          )}
          <span
            className={`truncate font-medium transition-colors ${
              isActive ? 'text-blue-300' : 'text-gray-200 hover:text-white'
            }`}
          >
            {book.title}
          </span>
        </button>
        <BookMenu bookId={bookId} onEdit={() => onEdit(book)} />
      </div>

      {/* Chapters (only for active book) */}
      <AnimatePresence initial={false}>
        {expanded && isActive && (
          <motion.div
            layout={!shouldReduceMotion}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="ml-2 border-l border-gray-700 pl-2"
          >
            {chapters.map((chapter) => (
              <div key={chapter.id} className="group">
                <div className="flex items-center">
                  {editingChapterId === chapter.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editChapterTitle}
                      onChange={(e) => setEditChapterTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const trimmed = editChapterTitle.trim();
                          if (trimmed) updateItem(chapter.id, { title: trimmed });
                          setEditingChapterId(null);
                        } else if (e.key === 'Escape') {
                          setEditingChapterId(null);
                        }
                      }}
                      onBlur={() => {
                        const trimmed = editChapterTitle.trim();
                        if (trimmed && trimmed !== chapter.title) {
                          updateItem(chapter.id, { title: trimmed });
                        }
                        setEditingChapterId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-200 border border-gray-700 focus:outline-none focus:border-blue-500 ml-2"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setActiveContent({ kind: 'chapter', bookId, chapterId: chapter.id });
                      }}
                      className={`flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                        activeContent?.kind === 'chapter' && activeContent.chapterId === chapter.id
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                      }`}
                    >
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span className="truncate">{chapter.title}</span>
                    </button>
                  )}
                  {editingChapterId !== chapter.id && (
                    <ChapterMenu
                      chapterId={chapter.id}
                      onEdit={() => {
                        setEditChapterTitle(chapter.title);
                        setEditingChapterId(chapter.id);
                      }}
                    />
                  )}
                </div>
                {/* Page nodes under this chapter */}
                {editorPageData && (() => {
                  const chapterPages = editorPageData.chapters.find(c => c.chapterId === chapter.id);
                  if (!chapterPages || chapterPages.startPage >= chapterPages.endPage) return null;
                  const pages = [];
                  for (let p = chapterPages.startPage; p < chapterPages.endPage; p++) {
                    pages.push(p);
                  }
                  return (
                    <div className="ml-5 border-l border-gray-700/50 pl-1">
                      {pages.map(pageIdx => (
                        <button
                          key={pageIdx}
                          onClick={() => {
                            setActiveContent({ kind: 'page', bookId, pageId: String(pageIdx) });
                          }}
                          className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-left text-[11px] transition-colors w-full ${
                            activeContent?.kind === 'page' && activeContent.pageId === String(pageIdx)
                              ? 'bg-blue-600/15 text-blue-400'
                              : 'text-gray-500 hover:bg-gray-700/30 hover:text-gray-300'
                          }`}
                        >
                          <svg className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate">Page {pageIdx + 1}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))}
            {chapters.length === 0 && (
              <div className="px-2 py-1 text-xs text-gray-500 italic">{t('center.chapterTree.noContent', { ns: 'app' })}</div>
            )}
            {/* New Chapter button / inline form */}
            <div className="px-2 py-1">
              {newChapterOpen ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    autoFocus
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder={t('center.chapterTree.chapterTitlePlaceholder', { ns: 'app' })}
                    className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 outline-none focus:border-blue-600"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        const trimmed = newChapterTitle.trim();
                        if (!trimmed) return;
                        const chapterId = 'ch-' + Date.now();
                        addItem({
                          type: 'chapter',
                          id: chapterId,
                          title: trimmed,
                        });
                        // Dispatch event so DocumentEditor inserts the <h1> heading
                        window.dispatchEvent(new CustomEvent('insert-chapter-heading', {
                          detail: { chapterId, title: trimmed }
                        }));
                        setNewChapterTitle('');
                        setNewChapterOpen(false);
                      }}
                      className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
                    >
                      {t('buttons.add', { ns: 'common' })}
                    </button>
                    <button
                      onClick={() => {
                        setNewChapterTitle('');
                        setNewChapterOpen(false);
                      }}
                      className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-600"
                    >
                      {t('buttons.cancel', { ns: 'common' })}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewChapterOpen(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('center.chapterTree.newChapter', { ns: 'app' })}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Chapter Tree (main export) ──────────────────────────── */

export function ChapterTree() {
  const { books, activeBookId, fetchBooks, fetchBook, switchBook } = useAppStore();
  const shouldReduceMotion = useReducedMotion();
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingBook, setEditingBook] = useState<BookListItem | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    fetchBooks();
  }, []);

  useEffect(() => {
    if (activeBookId) {
      fetchBook();
    }
  }, [activeBookId]);

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: 'easeOut' as const };

  const openCreate = () => {
    setEditingBook(null);
    setModalMode('create');
  };

  const openEdit = (book: BookListItem) => {
    setEditingBook(book);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingBook(null);
  };

  const handleSaved = () => {
    closeModal();
  };

  return (
    <motion.div
      className="space-y-1"
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
    >
      {/* New Book button */}
      <button
        type="button"
        onClick={openCreate}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-700/50 hover:text-gray-200 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {t('center.chapterTree.newBook', { ns: 'app' })}
      </button>

      {/* Book list */}
      {books.map((b) => (
        <BookNode
          key={b.id}
          bookId={b.id}
          book={b}
          isActive={b.id === activeBookId}
          onSelect={() => switchBook(b.id)}
          onEdit={openEdit}
        />
      ))}

      {books.length === 0 && (
        <div className="px-2 py-4 text-center text-xs text-gray-500 italic">
          {t('center.chapterTree.noBooks', { ns: 'app' })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalMode && (
          <BookModal
            mode={modalMode}
            initial={editingBook ?? undefined}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
