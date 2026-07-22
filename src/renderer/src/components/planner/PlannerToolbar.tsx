import { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { motion, useReducedMotion } from 'motion/react';
import { useAppStore, undo, redo } from '../../stores';
import { toggleTheme, useTheme } from '../../theme';
import { ConfirmDialog } from '../shared/ConfirmDialog';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function PlannerToolbar() {
  const { t } = useTranslation();
  const {
    setAppView,
    setSettingsOpen,
    planModel,
    planError,
    clearPlan,
    autoLayout,
    generationStatus,
    generationProgress,
    generationError,
    startGeneration,
    sidebarRightOpen,
    toggleSidebarRight,
  } = useAppStore();
  const shouldReduceMotion = useReducedMotion();
  const theme = useTheme();

  // Reactively track undo/redo availability
  const canUndo = useStore(useAppStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useAppStore.temporal, (s) => s.futureStates.length > 0);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPlanRef = useRef(planModel);

  // Update save status when the plan changes
  useEffect(() => {
    if (planError) {
      setSaveStatus('error');
      return;
    }
    if (!planModel) {
      setSaveStatus('idle');
      return;
    }

    // Skip the first assignment (initial load / empty init)
    if (prevPlanRef.current === null || prevPlanRef.current === planModel) {
      prevPlanRef.current = planModel;
      if (planModel.nodes.length > 0 || planModel.edges.length > 0) {
        setSaveStatus('saved');
      }
      return;
    }

    prevPlanRef.current = planModel;
    setSaveStatus('saving');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('saved'), 600);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [planModel, planError]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClear = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  // Reset generation status from 'complete' back to 'idle' after 3s
  useEffect(() => {
    if (generationStatus === 'complete') {
      const timer = setTimeout(() => {
        useAppStore.setState({ generationStatus: 'idle' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [generationStatus]);

  const statusLabel = {
    idle: '',
    saving: t('planner.toolbar.saveStatus.saving', { ns: 'app' }),
    saved: t('planner.toolbar.saveStatus.saved', { ns: 'app' }),
    error: t('planner.toolbar.saveStatus.error', { ns: 'app' }),
  };

  const statusColor = {
    idle: 'bg-gray-500',
    saving: 'bg-amber-400',
    saved: 'bg-green-400',
    error: 'bg-red-400',
  };

  const genLabel = (() => {
    switch (generationStatus) {
      case 'idle':
        return t('planner.toolbar.generate', { ns: 'app' });
      case 'connecting':
        return t('planner.toolbar.connecting', { ns: 'app' });
      case 'generating':
        return t('planner.toolbar.generating', { ns: 'app' });
      case 'complete':
        return t('planner.toolbar.complete', { ns: 'app' });
      case 'error':
        return t('planner.toolbar.generationError', { ns: 'app' });
    }
  })();

  const isGenerating = generationStatus === 'connecting' || generationStatus === 'generating';
  const genDisabled = isGenerating || generationStatus === 'complete';

  return (
    <header className="glass z-40 flex items-center justify-between px-4 py-2">
      {/* Left */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => setAppView('author')}
          className="focus-ring rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          title={t('planner.toolbar.backToAuthor', { ns: 'app' })}
          aria-label={t('planner.toolbar.backToAuthor', { ns: 'app' })}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>

        <h1 className="select-none text-sm font-bold tracking-wide text-gray-100">
          {t('planner.title', { ns: 'app' })}
        </h1>

        {saveStatus !== 'idle' && (
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor[saveStatus]}`} />
            <span className="text-xs text-gray-400">{statusLabel[saveStatus]}</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Undo */}
        <motion.button
          onClick={undo}
          disabled={!canUndo}
          className={`focus-ring rounded p-1 ${
            canUndo
              ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
              : 'cursor-not-allowed text-gray-600'
          }`}
          title={t('planner.toolbar.undo', { ns: 'app' })}
          aria-label={t('planner.toolbar.undo', { ns: 'app' })}
          whileTap={shouldReduceMotion || !canUndo ? undefined : { scale: 0.97 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </motion.button>

        {/* Redo */}
        <motion.button
          onClick={redo}
          disabled={!canRedo}
          className={`focus-ring rounded p-1 ${
            canRedo
              ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
              : 'cursor-not-allowed text-gray-600'
          }`}
          title={t('planner.toolbar.redo', { ns: 'app' })}
          aria-label={t('planner.toolbar.redo', { ns: 'app' })}
          whileTap={shouldReduceMotion || !canRedo ? undefined : { scale: 0.97 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
        </motion.button>

        {/* Generate from plan */}
        <div className="flex items-center gap-1.5">
          <motion.button
            onClick={() => startGeneration()}
            disabled={genDisabled}
            className={`focus-ring rounded px-2.5 py-1 text-xs font-medium ${
              genDisabled
                ? 'cursor-not-allowed text-gray-600'
                : generationStatus === 'error'
                  ? 'text-red-400 hover:bg-gray-700 hover:text-red-300'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            title={
              generationStatus === 'error' && generationError
                ? t('planner.toolbar.generationFailed', { error: generationError, ns: 'app' })
                : t('planner.toolbar.generationHint', { ns: 'app' })
            }
            whileTap={shouldReduceMotion || genDisabled ? undefined : { scale: 0.97 }}
          >
            {genLabel}
          </motion.button>

          {generationProgress && generationStatus === 'generating' && (
            <span className="whitespace-nowrap text-xs text-gray-400">
              {t('planner.toolbar.nodeProgress', { current: generationProgress.current, total: generationProgress.total, label: generationProgress.nodeLabel, ns: 'app' })}
            </span>
          )}
        </div>

        {/* Auto-layout using dagre */}
        <motion.button
          onClick={autoLayout}
          className="focus-ring rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          title={t('planner.toolbar.autoLayout', { ns: 'app' })}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
            />
          </svg>
        </motion.button>

        <motion.button
          onClick={handleClear}
          className="focus-ring rounded px-2.5 py-1 text-xs font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          title={t('planner.toolbar.clear', { ns: 'app' })}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          {t('planner.toolbar.clear', { ns: 'app' })}
        </motion.button>

        {/* Separator */}
        <div className="mx-1 h-4 w-px bg-gray-700" />

        {/* Toggle AI Chat */}
        <motion.button
          onClick={toggleSidebarRight}
          className={`focus-ring rounded p-1.5 ${
            sidebarRightOpen
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
          title={sidebarRightOpen ? t('planner.toolbar.hideAiChat', { ns: 'app' }) : t('planner.toolbar.showAiChat', { ns: 'app' })}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </motion.button>

        {/* Token Usage */}
        <motion.button
          onClick={() => setAppView('tokenUsage')}
          className="focus-ring rounded p-1.5 text-amber-400 hover:bg-amber-900/40 hover:text-amber-300"
          title={t('planner.toolbar.tokenUsage', { ns: 'app' })}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </motion.button>

        {/* Theme toggle */}
        <motion.button
          onClick={toggleTheme}
          className="focus-ring rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          title={theme === 'dark' ? t('navigation.switchToLightTheme', { ns: 'common' }) : t('navigation.switchToDarkTheme', { ns: 'common' })}
          aria-label={t('navigation.toggleColorTheme', { ns: 'common' })}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          {theme === 'dark' ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </motion.button>

        {/* Settings */}
        <motion.button
          onClick={() => setSettingsOpen(true)}
          className="focus-ring rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          title={t('planner.toolbar.settings', { ns: 'app' })}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </motion.button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        message={t('planner.toolbar.clearConfirm', { ns: 'app' })}
        confirmLabel={t('planner.toolbar.clearConfirmLabel', { ns: 'app' })}
        onConfirm={() => {
          clearPlan();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </header>
  );
}
