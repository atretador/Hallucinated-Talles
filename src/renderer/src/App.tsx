import { useEffect, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from './components/layout/MainLayout';
import { LlmSetupView } from './components/setup/LlmSetupView';
import { DirectorySetupView } from './components/setup/DirectorySetupView';
import { ProjectsView } from './components/projects/ProjectsView';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { TokenUsageBoard } from './components/token-usage/TokenUsageBoard';
import { PlannerView } from './components/planner/PlannerView';
import { ChatPanel } from './components/chat/ChatPanel';
import { ResizeHandle } from './components/layout/ResizeHandles';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppStore } from './stores';
import { settingsApi, getStandardHeaders, getApiBase } from './api/client';
import { fontManager } from './fonts/FontManager';


function App() {
  const { t } = useTranslation();
  const { book, appView, setAppView, switchProject, setSettingsOpen, sidebarRightOpen } = useAppStore();
  const tokenUsageReturnTo = useRef<'projects' | 'author'>('author');

  // On mount: determine which view to show
  useEffect(() => {
    let cancelled = false;
    async function initApp() {
      try {
        const res = await settingsApi.getAppStatus();
        if (cancelled) return;
        if (res.success) {
          const data = res.data;
          if (!data.llmConfigured) {
            setAppView('llmSetup');
          } else if (!data.projectsDirConfigured) {
            setAppView('directorySetup');
          } else {
            setAppView('projects');
          }
        } else {
          setAppView('projects');
        }
      } catch {
        if (!cancelled) setAppView('projects');
      }
    }
    initApp();
    return () => { cancelled = true; };
  }, [setAppView]);

  // On mount: load persisted imported fonts into the browser
  useEffect(() => {
    fontManager.loadPersistedFonts();
  }, []);

  // Export handler
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
      console.warn('[App] Text export failed');
    }
  }, [book]);

  // PDF export handler
  const handleExportPdf = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBase()}/export/pdf`, { headers: getStandardHeaders() });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(book?.title ?? 'book').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // export silently failed
      console.warn('[App] PDF export failed');
    }
  }, [book]);

  // Keyboard shortcuts — only respond in author view
  const handleSave = useCallback(() => {
    if (appView !== 'author') return;
    window.dispatchEvent(new CustomEvent('save-current-page'));
  }, [appView]);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleNewChapter = useCallback(() => {
    if (appView !== 'author') return;
    setInfoMessage(t('app.infoMessage.newChapter', { ns: 'app' }));
  }, [appView]);

  // Auto-dismiss info message after 3 seconds
  useEffect(() => {
    if (!infoMessage) return;
    const timer = setTimeout(() => setInfoMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [infoMessage]);

  const handleSearchFocus = useCallback(() => {
    if (appView !== 'author') return;
    const input = document.querySelector<HTMLInputElement>('[data-search-input]');
    input?.focus();
  }, [appView]);

  useKeyboardShortcuts({
    onSave: handleSave,
    onExportText: handleExportText,
    onExportPdf: handleExportPdf,
    onNewChapter: handleNewChapter,
    onSearchFocus: handleSearchFocus,
  });

  // Listen for native menu events (Export as Text) — only in author view
  useEffect(() => {
    if (appView !== 'author') return;
    const handleMenuExport = () => {
      handleExportText();
    };
    window.addEventListener('menu-export-text', handleMenuExport);
    return () => window.removeEventListener('menu-export-text', handleMenuExport);
  }, [handleExportText, appView]);

  const handleSelectProject = useCallback(async (projectId: string, projectTitle: string) => {
    await switchProject(projectId, projectTitle);
    setAppView('author');
  }, [switchProject, setAppView]);

  /* ── Chat resize state (replaces MainLayout/PlannerView right panels) ── */
  const [chatWidth, setChatWidth] = useState(320);
  const chatWidthRef = useRef(320);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const handleChatResize = useCallback((delta: number) => {
    chatWidthRef.current = Math.max(320, Math.min(800, chatWidthRef.current - delta));
    if (chatPanelRef.current) {
      chatPanelRef.current.style.width = `${chatWidthRef.current}px`;
    }
  }, []);

  const handleChatResizeStart = useCallback(() => {
    if (chatPanelRef.current) chatPanelRef.current.style.transition = 'none';
  }, []);

  const handleChatResizeEnd = useCallback(() => {
    if (chatPanelRef.current) chatPanelRef.current.style.transition = '';
    setChatWidth(chatWidthRef.current);
  }, []);

  return (
    <div className="flex h-screen">
      {/* Info banner */}
      {infoMessage && (
        <div className="fixed left-1/2 top-4 z-[200] -translate-x-1/2 animate-in fade-in slide-in-from-top-2 rounded border border-blue-700 bg-blue-900/80 px-4 py-2 text-sm text-blue-200 shadow-lg backdrop-blur-sm">
          {infoMessage}
          <button onClick={() => setInfoMessage(null)} className="ml-3 text-blue-300 hover:text-blue-100" aria-label={t('messages.dismiss', { ns: 'common' })}>
            ✕
          </button>
        </div>
      )}

      {/* Left: view content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {appView === 'loading' && null}
        {appView === 'llmSetup' && <LlmSetupView onComplete={() => setAppView('directorySetup')} />}
        {appView === 'directorySetup' && <DirectorySetupView onComplete={() => setAppView('projects')} />}
        {appView === 'projects' && (
          <>
            <ProjectsView onSelectProject={handleSelectProject} onOpenSettings={() => setSettingsOpen(true)} onOpenUsage={() => { tokenUsageReturnTo.current = 'projects'; setAppView('tokenUsage'); }} />
            <SettingsPanel />
          </>
        )}
        {(appView === 'tokenUsage' || appView === 'author') && (
          <>
            {appView === 'tokenUsage' && <TokenUsageBoard onClose={() => setAppView(tokenUsageReturnTo.current)} />}
            <MainLayout />
            <SettingsPanel />
          </>
        )}
        {appView === 'planner' && (
          <>
            <PlannerView />
            <SettingsPanel />
          </>
        )}
      </div>

      {/* Right: stable chat panel — never destroyed/recreated */}
      {(appView === 'author' || appView === 'planner') && sidebarRightOpen && (
        <>
          <ResizeHandle
            onResize={handleChatResize}
            onResizeStart={handleChatResizeStart}
            onResizeEnd={handleChatResizeEnd}
          />
          <div
            ref={chatPanelRef}
            className="shrink-0 overflow-hidden"
            style={{ width: chatWidth }}
          >
            <div className="h-full border-l border-gray-700 overflow-hidden" style={{ width: chatWidth }}>
              <ChatPanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
