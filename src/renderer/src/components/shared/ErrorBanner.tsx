import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();

  const variants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : -16 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: prefersReduced ? 0 : -16 },
  };

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="error-banner"
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.25 }}
          className="flex items-center gap-3 rounded border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300"
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span className="flex-1">{message}</span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-400 hover:text-red-200"
              aria-label={t('shared.errorBanner.dismiss', { ns: 'app' })}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
