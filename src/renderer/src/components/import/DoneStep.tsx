import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { EntityItem, ProgressState } from './useImportStream';

/* ── Types ───────────────────────────────────────────────────────────────────── */

export interface DoneStepProps {
  progress: ProgressState;
  entities: EntityItem[];
  prefersReduced: boolean;
}

/* ── DoneStep ─────────────────────────────────────────────────────────────────── */

export function DoneStep({ progress, entities, prefersReduced }: DoneStepProps) {
  const { t } = useTranslation('app');
  return (
    <div className="card-elevated flex flex-col items-center gap-4 rounded-xl p-6 text-center">
      <motion.div
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20"
        initial={prefersReduced ? { opacity: 1 } : { scale: 0.5, opacity: 0 }}
        animate={prefersReduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
      >
        <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <div
          className="absolute inset-0 rounded-full ring-1 ring-emerald-500/10"
          style={{ animation: 'done-pulse 2s ease-in-out infinite' }}
        />
      </motion.div>
      <div>
        <p className="text-sm font-medium text-gray-200">{progress.message}</p>
        {entities.length > 0 && (
          <p className="mt-1.5 text-xs text-gray-500">
            {t('import.doneStep.extractedSummary', {
              characters: entities.filter((e) => e.type === 'character').length,
              events: entities.filter((e) => e.type === 'event').length,
              chapters: entities.filter((e) => e.type === 'chapter').length,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
