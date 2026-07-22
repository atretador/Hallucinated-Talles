import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import { useAppStore } from '../../stores';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorBanner } from '../shared/ErrorBanner';
import { PlannerToolbar } from './PlannerToolbar';
import { NodePalette } from './NodePalette';
import { PlannerCanvas } from './PlannerCanvas';
import { NodeInspector } from './NodeInspector';

export function PlannerView() {
  const { t } = useTranslation();
  const { planLoading, planError, planModel, loadPlan, setPlanModel, canvasSelection } = useAppStore();
  const shouldReduceMotion = useReducedMotion();

  /* ── Load the plan on mount ── */
  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  /* ── Initialise an empty plan when none exists ── */
  useEffect(() => {
    if (!planLoading && planModel === null && !planError) {
      setPlanModel({ version: 1, nodes: [], edges: [] });
    }
  }, [planLoading, planModel, planError, setPlanModel]);

  /* ── Keyboard shortcuts for undo/redo ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useAppStore.temporal.getState().undo();
      } else if ((mod && e.key === 'z' && e.shiftKey) || (mod && e.key === 'y')) {
        e.preventDefault();
        useAppStore.temporal.getState().redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── Loading state ── */
  if (planLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--theme-bg)]">
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <LoadingSpinner message={t('planner.loading', { ns: 'app' })} size="lg" />
        </motion.div>
      </div>
    );
  }

  /* ── Error state ── */
  if (planError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-[var(--theme-bg)]">
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <ErrorBanner message={planError} />
        </motion.div>
        <motion.button
          onClick={() => loadPlan()}
          className="focus-ring rounded px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-900/40 hover:text-blue-300"
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          {t('planner.retry', { ns: 'app' })}
        </motion.button>
      </div>
    );
  }

  /* ── Main planner UI ── */
  const selectedNodeId = canvasSelection.length === 1 ? canvasSelection[0] : null;

  return (
    <div className="flex h-screen flex-col bg-[var(--theme-bg)]">
      <PlannerToolbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Node Palette (220px) */}
        <NodePalette />

        {/* Center: ReactFlow Canvas — no min-width so chat can expand freely */}
        <main className="relative flex-1 min-w-0">
          <PlannerCanvas />

          {/* Floating Node Inspector — appears when a node is selected */}
          {selectedNodeId && (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute right-3 top-3 bottom-3 w-72 z-20 overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-xl"
            >
              <NodeInspector />
            </motion.div>
          )}
        </main>
      </div>

      {/* Subtle bottom border for visual closure */}
      <div className="h-px bg-[var(--theme-border)]" />
    </div>
  );
}
