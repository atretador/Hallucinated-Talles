import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { EditPhase } from './useAiEdit';

/* ── Progress bar ────────────────────────────────────── */

export function StreamingProgress() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="relative w-full max-w-xs">
        <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-blue-500"
            initial={{ width: '0%' }}
            animate={{ width: '90%' }}
            transition={{ duration: 8, ease: 'easeInOut' }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
        {t('editor.aiEditSidePanel.aiIsWorking', { ns: 'app' })}
      </div>
    </div>
  );
}

/* ── Streaming / result content (non-diff phases) ────── */

interface AiEditStreamingContentProps {
  phase: EditPhase;
  streamingText: string;
  errorMsg: string;
}

export function AiEditStreamingContent({ phase, streamingText, errorMsg }: AiEditStreamingContentProps) {
  const { t } = useTranslation();

  if (phase === 'streaming') {
    return (
      <>
        <StreamingProgress />
        {streamingText && (
          <div className="border-t border-gray-700 px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">{t('editor.aiResponseLabel', { ns: 'app' })}</div>
            <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {streamingText}
            </div>
          </div>
        )}
      </>
    );
  }

  if (phase === 'accepted') {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm text-green-400 font-medium">{t('editor.aiEditSidePanel.changesApplied', { ns: 'app' })}</span>
      </div>
    );
  }

  if (phase === 'rejected') {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span className="text-sm text-gray-400">{t('editor.aiEditSidePanel.changesRejected', { ns: 'app' })}</span>
      </div>
    );
  }

  // error phase
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <span className="text-sm text-red-400 text-center max-w-md">{errorMsg}</span>
    </div>
  );
}
