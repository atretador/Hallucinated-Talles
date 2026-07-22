import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { ChapterItem, ContentAddress } from '../../../../shared/types';

/* ── 3-dot menu for chapter ─────────────────────────── */

export function ChapterMenu({
  chapterId,
  onEdit,
}: {
  chapterId: string;
  onEdit: () => void;
}) {
  const { deleteItem } = useAppStore();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

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
              {t('center.chapterNode.editTitle', { ns: 'app' })}
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
                    await deleteItem(chapterId);
                    // Dispatch event so DocumentEditor removes the <h1> heading
                    window.dispatchEvent(new CustomEvent('delete-chapter-heading', {
                      detail: { chapterId }
                    }));
                  }}
                onBlur={() => {
                  setConfirming(false);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-300 bg-red-900/30 hover:bg-red-900/50"
              >
                {t('center.chapterNode.confirmDelete', { ns: 'app' })}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── ChapterNode ────────────────────────────────────── */

interface ChapterNodeProps {
  chapter: ChapterItem;
  activeContent: ContentAddress | null;
  bookId: string;
  onSelectChapter: (bookId: string, chapterId: string) => void;
}

export function ChapterNode({ chapter, activeContent, bookId, onSelectChapter }: ChapterNodeProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const { updateItem } = useAppStore();

  const isChapterActive =
    activeContent?.kind === 'chapter' &&
    activeContent.chapterId === chapter.id;

  const handleChapterClick = () => {
    onSelectChapter(bookId, chapter.id);
  };

  const handleEditTitle = () => {
    setEditTitleValue(chapter.title);
    setEditingTitle(true);
  };

  return (
    <div className="group flex items-center">
      <button
        onClick={handleChapterClick}
        className={`flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
          isChapterActive
            ? 'bg-blue-600/20 text-blue-300'
            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
        }`}
      >
        <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        {editingTitle ? (
          <input
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const trimmed = editTitleValue.trim();
                if (trimmed) {
                  updateItem(chapter.id, { title: trimmed });
                }
                setEditingTitle(false);
              } else if (e.key === 'Escape') {
                setEditingTitle(false);
              }
            }}
            onBlur={() => {
              const trimmed = editTitleValue.trim();
              if (trimmed && trimmed !== chapter.title) {
                updateItem(chapter.id, { title: trimmed });
              }
              setEditingTitle(false);
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded bg-gray-800 px-1.5 py-0.5 text-sm text-gray-200 border border-gray-700 focus:outline-none focus:border-blue-500"
          />
        ) : (
          <span className="truncate cursor-pointer hover:text-white transition-colors">
            {chapter.title}
          </span>
        )}
      </button>
      <ChapterMenu
        chapterId={chapter.id}
        onEdit={handleEditTitle}
      />
    </div>
  );
}
