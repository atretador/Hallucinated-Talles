import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { projectApi } from '../../api/client';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { toggleTheme, useTheme } from '../../theme';

/* ── Types ── */

interface ProjectSummary {
  id: string;
  title: string;
  description?: string;
  bookCount?: number;
  coverUrl?: string;
}

interface ProjectsViewProps {
  onSelectProject: (projectId: string, projectTitle: string) => void;
  onOpenSettings?: () => void;
  onOpenUsage?: () => void;
}

/* ── Motion variants ── */

function useCardVariants(shouldReduce: boolean) {
  return {
    container: shouldReduce
      ? { hidden: {}, visible: {} }
      : {
          hidden: {},
          visible: { transition: { staggerChildren: 0.06 } },
        },

    card: shouldReduce
      ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
      : {
          hidden: { opacity: 0, y: 24 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] as const },
          },
        },
  };
}

/* ── Sub-components ── */

function BooksIllustration() {
  return (
    <svg
      className="h-24 w-24 text-gray-600"
      fill="none"
      viewBox="0 0 64 64"
      stroke="currentColor"
      strokeWidth={1}
    >
      {/* Stack of books */}
      <rect x="16" y="32" width="14" height="20" rx="1.5" stroke="currentColor" fill="none" />
      <rect x="18" y="34" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.2" />
      <rect x="18" y="38" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.2" />
      <rect x="18" y="42" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.2" />

      <rect x="34" y="30" width="14" height="22" rx="1.5" stroke="currentColor" fill="none" />
      <rect x="36" y="32" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.2" />
      <rect x="36" y="36" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.2" />
      <rect x="36" y="40" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.2" />

      {/* Open book on top */}
      <path
        d="M24 28c-2-2-5-3-8-3v18c3 0 6 1 8 3V28z"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 28c2-2 5-3 8-3v18c-3 0-6 1-8 3V28z"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Pen */}
      <line x1="32" y1="20" x2="44" y2="8" stroke="currentColor" strokeLinecap="round" />
      <line x1="44" y1="8" x2="48" y2="12" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

/* ── Main Component ── */

export function ProjectsView({ onSelectProject, onOpenSettings, onOpenUsage }: ProjectsViewProps) {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();
  const shouldReduceMotion = prefersReduced === null ? true : prefersReduced;
  const variants = useCardVariants(shouldReduceMotion);
  const theme = useTheme();

  /* State */
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  /* Modal state (shared for new + edit) */
  const [modalMode, setModalMode] = useState<'new' | 'edit' | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const modalTitleRef = useRef<HTMLInputElement>(null);

  /* Menu / delete state */
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Fetch projects on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await projectApi.listBooks();
        if (cancelled) return;
        if (res.success && res.data) {
          setProjects(res.data);
        } else {
          setError(res.error ?? t('projects.failedToLoad'));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('projects.failedToLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Auto-focus modal title input */
  useEffect(() => {
    if (modalMode && modalTitleRef.current) {
      modalTitleRef.current.focus();
    }
  }, [modalMode]);

  /* ── Derived ── */
  const filtered = searchQuery.trim()
    ? projects.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;

  /* ── Handlers ── */

  const openNewModal = useCallback(() => {
    setModalMode('new');
    setModalTitle('');
    setModalDescription('');
  }, []);

  const openEditModal = useCallback((project: ProjectSummary) => {
    setModalMode('edit');
    setEditingProjectId(project.id);
    setModalTitle(project.title);
    setModalDescription(project.description ?? '');
    setOpenMenuId(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingProjectId(null);
    setModalTitle('');
    setModalDescription('');
  }, []);

  const handleModalSave = useCallback(async () => {
    const title = modalTitle.trim();
    if (!title || modalSaving) return;
    setModalSaving(true);
    try {
      if (modalMode === 'new') {
        const res = await projectApi.createBook(title, modalDescription.trim());
        if (res.success && res.data) {
          onSelectProject(res.data.id, res.data.title);
        } else {
          setError(res.error ?? t('projects.failedToCreate'));
        }
      } else if (modalMode === 'edit' && editingProjectId) {
        const res = await projectApi.renameBook(editingProjectId, title, modalDescription.trim());
        if (res.success && res.data) {
          setProjects((prev) => prev.map((p) => (p.id === editingProjectId ? { ...p, title: res.data!.title, description: res.data!.description } : p)));
        } else {
          setError(res.error ?? t('projects.failedToUpdate'));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.failedToUpdate'));
    } finally {
      setModalSaving(false);
      if (modalMode === 'new') {
        setModalMode(null);
      } else {
        closeModal();
      }
    }
  }, [modalTitle, modalDescription, modalSaving, modalMode, editingProjectId, onSelectProject, closeModal]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchQuery('');
        (e.target as HTMLInputElement).blur();
      }
    },
    [],
  );

  /* ── Click-outside handler for menu ── */
  useEffect(() => {
    if (!openMenuId) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingId) return;
    try {
      const res = await projectApi.deleteBook(deletingId);
      if (res.success) {
        setProjects((prev) => prev.filter((p) => p.id !== deletingId));
      } else {
        setError(res.error ?? t('projects.failedToDelete'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.failedToDelete'));
    } finally {
      setDeletingId(null);
    }
  }, [deletingId]);

  const handleModalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) handleModalSave();
      if (e.key === 'Escape') closeModal();
    },
    [handleModalSave, closeModal],
  );

  /* ── New Project Card (always rendered in the grid) ── */

  const newProjectCard = (
    <motion.div variants={variants.card} layout>
      <button
        type="button"
        onClick={openNewModal}
        className="group w-full cursor-pointer rounded-xl border-2 border-dashed border-blue-500/20 p-5 text-left transition-all duration-300 hover:border-blue-400/40 hover:bg-blue-500/[0.03]"
      >
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 transition-all duration-300 group-hover:bg-blue-500/20 group-hover:scale-105">
            <svg
              className="h-6 w-6 text-blue-400/60 transition-colors duration-300 group-hover:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-center">
            <span className="text-sm font-medium text-gray-300 transition-colors duration-300 group-hover:text-gray-200">
              {t('projects.newProject')}
            </span>
            <p className="mt-1 text-xs text-gray-500">
              {t('projects.newProjectHint')}
            </p>
          </div>
        </div>
      </button>
    </motion.div>
  );

  /* ── Render ── */

  return (
    <div className="flex h-screen flex-col bg-[var(--theme-bg)]">
      {/* ════════ Header ════════ */}
      <header className="glass flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
            <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
            </svg>
          </div>
          <h1 className="text-sm font-bold tracking-wide text-gray-100">
            {t('app.title')}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <motion.button
            onClick={onOpenUsage}
            className="focus-ring rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-900/40 hover:text-amber-300"
            title={t('layout.header.tokenUsageDashboard')}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </motion.button>
          <motion.button
            onClick={toggleTheme}
            className="focus-ring rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            title={theme === 'dark' ? t('navigation.switchToLightTheme', { ns: 'common' }) : t('navigation.switchToDarkTheme', { ns: 'common' })}
            aria-label={t('navigation.toggleColorTheme', { ns: 'common' })}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            {theme === 'dark' ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                />
              </svg>
            )}
          </motion.button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="focus-ring rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
            title={t('navigation.settings', { ns: 'common' })}
            aria-label={t('navigation.settings', { ns: 'common' })}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* ════════ Welcome area ════════ */}
      <div className="px-6 pt-6 pb-1">
        <motion.h2
          className="text-2xl font-light tracking-wide text-gray-100"
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {t('projects.welcome')}
        </motion.h2>
        <motion.p
          className="mt-1 text-sm text-gray-500"
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {t('projects.tagline')}
        </motion.p>
      </div>

      {/* ════════ Search ════════ */}
      <div className="px-6 pb-2 pt-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('projects.searchPlaceholder')}
            className="focus-ring w-full rounded-lg border border-gray-600/50 bg-gray-800/50 py-2.5 pl-10 pr-4 text-sm text-gray-100 placeholder-gray-500 transition-colors duration-200 focus:border-gray-400/50 focus:bg-gray-800"
          />
        </div>
      </div>

      {/* ════════ Content ════════ */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          /* ── Loading ── */
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner message={t('projects.loading')} size="lg" />
          </div>
        ) : error ? (
          /* ── Error ── */
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
              <svg
                className="h-8 w-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-300">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-gray-600/50 bg-gray-800/50 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-gray-200"
            >
              {t('buttons.retry', { ns: 'common' })}
            </button>
          </div>
        ) : projects.length === 0 ? (
          /* ── Empty state (no projects at all) ── */
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <div className="relative">
              <BooksIllustration />
              <motion.div
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 ring-1 ring-blue-500/20"
                initial={shouldReduceMotion ? {} : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 15 }}
              >
                <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
                </svg>
              </motion.div>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-300">{t('projects.emptyTitle')}</p>
              <p className="mt-1.5 text-sm text-gray-500 max-w-xs">
                {t('projects.emptyDescription')}
              </p>
            </div>
            <button
              type="button"
              onClick={openNewModal}
              className="mt-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-500/30"
            >
              {t('projects.newProject')}
            </button>
          </div>
        ) : (
          /* ── Grid ── */
          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            variants={variants.container}
            initial="hidden"
            animate="visible"
          >
            {/* Always show the "New Project" entry */}
            {newProjectCard}

            {/* Projects */}
            {filtered.map((project) => (
              <motion.div
                key={project.id}
                variants={variants.card}
                layout
                className="card-elevated group relative w-full cursor-pointer rounded-xl text-left overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-3)] hover:border-[var(--card-glow)]"
                onClick={() => onSelectProject(project.id, project.title)}
              >
                {/* Cover image or placeholder */}
                <div className="relative h-40 bg-gray-800 overflow-hidden">
                  {project.coverUrl ? (
                    <img
                      src={`http://localhost:${window.electron?.getApiPort() ?? '3000'}${project.coverUrl}`}
                      alt={`${project.title} cover`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-800/80">
                      <svg className="h-12 w-12 text-gray-600/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}

                  {/* Bottom gradient overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />

                  {/* Stack effect for multi-book projects */}
                  {(project.bookCount ?? 0) > 1 && (
                    <>
                      <div className="absolute -right-1 -bottom-1 h-32 w-24 rotate-3 rounded-lg bg-gray-700/80 shadow-md" />
                      <div className="absolute -right-2 -bottom-2 h-32 w-24 rotate-6 rounded-lg bg-gray-600/60 shadow-md" />
                    </>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="truncate text-base font-semibold text-gray-100">
                    {project.title}
                  </h3>
                  {project.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-400">{project.description}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">{t('projects.writingProject')}</p>
                  )}
                  {(project.bookCount ?? 0) > 1 && (
                    <p className="mt-1 text-xs text-gray-500">{t('projects.booksCount', { count: project.bookCount })}</p>
                  )}
                </div>

                {/* 3-dot kebab menu */}
                <div className="absolute right-3 top-3" ref={openMenuId === project.id ? menuRef : undefined}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === project.id ? null : project.id);
                    }}
                    className="focus-ring rounded-lg p-1 text-gray-500 opacity-0 transition-all duration-200 hover:bg-gray-700/80 hover:text-gray-300 group-hover:opacity-100"
                    title={t('projects.menu.options')}
                    aria-label={t('projects.menu.options')}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {openMenuId === project.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 z-50 mt-1 w-36 overflow-hidden rounded-lg border border-gray-600/60 bg-gray-800 shadow-xl"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(project);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-700"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                          {t('projects.menu.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            setDeletingId(project.id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-gray-700"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          {t('projects.menu.delete')}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}

            {/* If search yields no results among existing projects, show a hint */}
            {projects.length > 0 && filtered.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-700/30">
                  <svg className="h-6 w-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">
                  {t('projects.noMatch')}{' '}
                  <span className="text-gray-400">&ldquo;{searchQuery}&rdquo;</span>
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs text-blue-400 transition-colors hover:text-blue-300"
                >
                  {t('projects.clearSearch')}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ════════ Project Form Modal (New / Edit) ════════ */}
      <AnimatePresence>
        {modalMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-gray-600/50 bg-gray-800 p-6 shadow-2xl"
            >
              <h3 className="text-base font-semibold text-gray-100">
                {modalMode === 'new' ? t('projects.modal.newProject') : t('projects.modal.editProject')}
              </h3>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">{t('projects.modal.title')}</label>
                  <input
                    ref={modalTitleRef}
                    type="text"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    onKeyDown={handleModalKeyDown}
                    placeholder={t('projects.modal.titlePlaceholder')}
                    disabled={modalSaving}
                    className="focus-ring w-full rounded-lg border border-gray-600/50 bg-gray-900 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    {t('projects.modal.description')} <span className="text-gray-600 font-normal">{t('projects.modal.optional')}</span>
                  </label>
                  <textarea
                    value={modalDescription}
                    onChange={(e) => setModalDescription(e.target.value)}
                    onKeyDown={handleModalKeyDown}
                    placeholder={t('projects.modal.descriptionPlaceholder')}
                    disabled={modalSaving}
                    rows={2}
                    className="focus-ring w-full resize-none rounded-lg border border-gray-600/50 bg-gray-900 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={modalSaving}
                  className="rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                  {t('buttons.cancel', { ns: 'common' })}
                </button>
                <button
                  type="button"
                  onClick={handleModalSave}
                  disabled={modalSaving || !modalTitle.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {modalSaving ? t('buttons.saving', { ns: 'common' }) : modalMode === 'new' ? t('buttons.create', { ns: 'common' }) : t('buttons.save', { ns: 'common' })}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ Delete Confirmation Dialog ════════ */}
      <AnimatePresence>
        {deletingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeletingId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-gray-600/50 bg-gray-800 p-6 shadow-2xl"
            >
              <h3 className="text-base font-semibold text-gray-100">{t('projects.deleteConfirm.title')}</h3>
              <p className="mt-2 text-sm text-gray-400">
                {t('projects.deleteConfirm.message', { project: projects.find((p) => p.id === deletingId)?.title })}
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
                >
                  {t('buttons.cancel', { ns: 'common' })}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
                >
                  {t('projects.deleteConfirm.delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
