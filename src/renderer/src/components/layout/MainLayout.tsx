import { useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { SidebarLeft } from '../sidebar-left/SidebarLeft';
import { ChapterTree } from '../center/ChapterTree';
import { DocumentEditor } from '../editor/DocumentEditor';
import { Timeline } from '../timeline/Timeline';
import ImportDialog from '../import/ImportDialog';
import { useAppStore } from '../../stores';
import { toggleTheme, useTheme } from '../../theme';
import { getStandardHeaders, getApiBase } from '../../api/client';
import { ResizeHandle, VerticalResizeHandle } from './ResizeHandles';
import { SearchOverlay } from './SearchOverlay';
import { BookSelector } from './BookSelector';
import { useResizePanels } from './useResizePanels';
import { exportToPdf } from '../../features/editor/pdfExport';

export function MainLayout() {
  const { t } = useTranslation('app');
  const {
    timelineOpen,
    toggleTimeline,
    setSettingsOpen,
    book,
    activeProjectTitle,
    sidebarLeftOpen,
    resetForProjectSwitch,
    setAppView,
    activeBookId,
    fetchBooks,
    switchBook,
  } = useAppStore();

  const shouldReduceMotion = useReducedMotion();
  const theme = useTheme();

  const {
    leftWidth,
    leftPanelRef,
    timelineHeight,
    timelinePanelRef,
    treeWidth,
    treePanelRef,
    handleLeftResize,
    handleLeftResizeStart,
    handleLeftResizeEnd,
    handleTimelineResize,
    handleTimelineResizeStart,
    handleTimelineResizeEnd,
    handleTreeResize,
    handleTreeResizeStart,
    handleTreeResizeEnd,
  } = useResizePanels();

  // Import dialog state
  const [showImport, setShowImport] = useState(false);
  const [importMinimized, setImportMinimized] = useState(false);
  const [importStatus, setImportStatus] = useState<{ isImporting: boolean; progress: number; bookName: string } | null>(null);

  const handleExportText = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBase()}/export/text`, { headers: getStandardHeaders() });
      if (!response.ok) return;
      const text = await response.text();
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(book?.title ?? 'book').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // export silently failed
      console.warn('[MainLayout] Text export failed');
    }
  }, [book]);

  const handleExportStory = useCallback(async () => {
    if (!activeBookId) return;
    try {
      const response = await fetch(`${getApiBase()}/export/story?bookId=${activeBookId}`, {
        headers: getStandardHeaders(),
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(book?.title ?? 'story').replace(/[^a-zA-Z0-9_-]/g, '_')}.story`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // export silently failed
      console.warn('[MainLayout] Story export failed');
    }
  }, [activeBookId, book]);

  const handleExportPdf = useCallback(async () => {
    if (!book?.content) return;
    try {
      await exportToPdf(book.content, book.title);
    } catch {
      console.warn('[MainLayout] PDF export failed');
    }
  }, [book]);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, [setSettingsOpen]);

  return (
    <div className="flex h-screen flex-col">
      {/* Header / Toolbar */}
      <header className="glass flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => { resetForProjectSwitch(); setAppView('projects'); }}
            className="focus-ring rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            title={t('layout.header.backToProjects')}
            aria-label={t('layout.header.backToProjects')}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
          <span className="text-sm font-bold text-gray-100">{activeProjectTitle || t('app.title')}</span>

          {/* Book Switcher */}
          <BookSelector />
        </div>

        {/* Search */}
        <SearchOverlay />

        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setAppView('planner')}
            className="focus-ring rounded px-2.5 py-1 text-xs font-medium text-purple-400 hover:bg-purple-900/40 hover:text-purple-300"
            title={t('layout.header.openStoryPlanner')}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </motion.button>
          <motion.button
            onClick={() => setAppView('tokenUsage')}
            className="focus-ring rounded px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-900/40 hover:text-amber-300"
            title={t('layout.header.tokenUsageDashboard')}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </motion.button>
          {/* Import button / minimized progress indicator */}
          {importStatus?.isImporting && importMinimized ? (
            <motion.button
              onClick={() => setImportMinimized(false)}
              className="focus-ring flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 text-xs font-medium text-blue-300 backdrop-blur-xl transition-all hover:shadow-[0_2px_12px_rgba(59,130,246,0.25)]"
              title={t('layout.header.importingBook', { name: importStatus.bookName })}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            >
              <svg className="h-3.5 w-3.5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="max-w-[120px] truncate">{importStatus.bookName}</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                  animate={{ width: `${importStatus.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="tabular-nums text-[10px] text-gray-500">{importStatus.progress}%</span>
            </motion.button>
          ) : (
            <motion.button
              onClick={() => { setImportMinimized(false); setShowImport(true); }}
              className="focus-ring rounded px-2.5 py-1 text-xs font-medium text-green-400 hover:bg-green-900/40 hover:text-green-300"
              title={t('layout.header.importBook')}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </motion.button>
          )}
          <motion.button
            onClick={handleExportStory}
            className={`focus-ring rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeBookId
                ? 'text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300'
                : 'text-gray-600 cursor-not-allowed'
            }`}
            title={activeBookId ? t('layout.header.exportStoryFile') : t('layout.header.noBookSelected')}
            disabled={!activeBookId}
            whileTap={shouldReduceMotion || !activeBookId ? undefined : { scale: 0.97 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </motion.button>
          <motion.button
            onClick={handleExportText}
            className="focus-ring rounded px-2.5 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            title={t('layout.header.exportText')}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </motion.button>
          <motion.button
            onClick={handleExportPdf}
            className="focus-ring rounded px-2.5 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            title={t('layout.header.exportPdf')}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v6h6" />
            </svg>
          </motion.button>
          <motion.button
            onClick={toggleTheme}
            className="focus-ring rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            title={theme === 'dark' ? t('navigation.switchToLightTheme', { ns: 'common' }) : t('navigation.switchToDarkTheme', { ns: 'common' })}
            aria-label={t('layout.header.toggleTheme')}
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
          <motion.button
            onClick={openSettings}
            className="focus-ring rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            title={t('layout.header.settings')}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
          </motion.button>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Characters & Events */}
        <div
          ref={leftPanelRef}
          style={{
            width: sidebarLeftOpen ? leftWidth : 0,
            transition: shouldReduceMotion ? 'none' : 'width 300ms ease-in-out',
          }}
          className="overflow-hidden shrink-0"
        >
          <div className="h-full overflow-hidden" style={{ width: leftWidth }}>
            <SidebarLeft />
          </div>
        </div>

        {/* Resize handle: left ↔ center */}
        {sidebarLeftOpen && (
          <ResizeHandle
            onResize={handleLeftResize}
            onResizeStart={handleLeftResizeStart}
            onResizeEnd={handleLeftResizeEnd}
          />
        )}

        {/* Center - Book Content */}
        <main className="flex flex-1 flex-col min-w-0">
          <div className="flex flex-1 min-h-0">
            {/* Chapter tree sidebar */}
            <div
              ref={treePanelRef}
              style={{ width: treeWidth }}
              className="shrink-0 overflow-y-auto border-r border-gray-700 bg-gray-900 p-3 min-h-0"
            >
              <ChapterTree />
            </div>

            {/* Resize handle: tree ↔ editor */}
            <ResizeHandle
              onResize={handleTreeResize}
              onResizeStart={handleTreeResizeStart}
              onResizeEnd={handleTreeResizeEnd}
            />

            {/* Editor area */}
            <div className="flex flex-1 flex-col min-w-0 bg-gray-900">
              <DocumentEditor />
            </div>
          </div>

          {/* Timeline (collapsible bottom panel) */}
          <div className="border-t border-gray-700 bg-gray-900">
            <button
              type="button"
              onClick={toggleTimeline}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <span className="text-xs">{timelineOpen ? '▼' : '▶'}</span>
              <span>{t('timeline.title')}</span>
            </button>
            <div
              ref={timelinePanelRef}
              style={{
                height: timelineOpen ? timelineHeight : 0,
                opacity: timelineOpen ? 1 : 0,
                transition: shouldReduceMotion
                  ? 'none'
                  : 'height 250ms ease-in-out, opacity 250ms ease-in-out',
              }}
              className="overflow-hidden border-t border-gray-700 flex flex-col"
            >
              <VerticalResizeHandle
                onResize={handleTimelineResize}
                onResizeStart={handleTimelineResizeStart}
                onResizeEnd={handleTimelineResizeEnd}
              />
              <div className="flex-1 overflow-hidden">
                <Timeline />
              </div>
            </div>
          </div>
        </main>

      </div>

      {/* Import Dialog */}
      <ImportDialog
        isOpen={showImport}
        onClose={() => { setShowImport(false); setImportMinimized(false); }}
        onImportComplete={(bookId: string) => {
          fetchBooks();
          switchBook(bookId);
          setShowImport(false);
          setImportMinimized(false);
        }}
        isMinimized={importMinimized}
        onMinimizeChange={(min: boolean) => {
          setImportMinimized(min);
        }}
        onImportStatus={setImportStatus}
      />
    </div>
  );
}
