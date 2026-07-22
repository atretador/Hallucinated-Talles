import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { EntityItem, ProgressState } from './useImportStream';

/* ── Types ───────────────────────────────────────────────────────────────────── */

export interface ImportingStepProps {
  progress: ProgressState;
  entities: EntityItem[];
  prefersReduced: boolean;
}

/* ── ImportingStep ────────────────────────────────────────────────────────────── */

export function ImportingStep({
  progress,
  entities,
  prefersReduced,
}: ImportingStepProps) {
  const { t } = useTranslation('app');
  // ── Smooth stagger animation for entity feed ──
  const entityVariants: Variants = {
    hidden: { opacity: 0, x: prefersReduced ? 0 : -12 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.03, duration: prefersReduced ? 0 : 0.25 },
    }),
  };
  const progressPercent =
    progress.totalPages > 0
      ? Math.round((progress.page / progress.totalPages) * 100)
      : 0;

  return (
    <div className="space-y-3">
      {/* ── Progress Bar ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="tabular-nums font-medium text-gray-300">
            {t('import.importingStep.pagesProgress', { current: progress.page, total: progress.totalPages, percent: progressPercent })}
            {progress.tkPerSec > 0 && (
              <span className="ml-2 text-blue-400/70">{t('import.importingStep.tokensPerSec', { rate: progress.tkPerSec })}</span>
            )}
          </span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
          {/* Shimmer overlay */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
            <div
              className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite]"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Entity Feed ── */}
      {entities.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t('import.importingStep.extractedEntities')}
            </label>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <span className="tabular-nums text-xs text-gray-500">{entities.length}</span>
            </div>
          </div>
          <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.04] p-1.5 backdrop-blur-sm">
            <AnimatePresence initial={false}>
              {entities.map((entity, i) => (
                <motion.div
                  key={entity.id}
                  custom={i}
                  variants={entityVariants}
                  initial="hidden"
                  animate="visible"
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-gray-300 transition-colors ${
                    i % 2 === 0 ? 'bg-white/[0.015]' : ''
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      entity.type === 'character'
                        ? 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]'
                        : entity.type === 'event'
                          ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                          : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                    }`}
                  />
                  <span className="w-14 shrink-0 text-[10px] font-medium uppercase tracking-wider text-gray-600">
                    {t('import.importingStep.entityTypes.' + entity.type)}
                  </span>
                  <span className="truncate">{entity.name}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
