import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '../../api/client';

interface DirectorySetupViewProps {
  /** Called when directory is successfully set */
  onComplete: () => void;
  /** Pre-filled path from app-status */
  defaultPath?: string;
}

const STARTER_PATH = '~/Documents/Hallucinated Talles/projects/';

/* ── Decorative icon: compass ── */
function CompassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88L16.24 7.76Z" />
    </svg>
  );
}

/* ── Step indicator ── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < current;
        const isActive = step === current;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : isActive
                      ? 'bg-blue-500/15 text-blue-400 ring-2 ring-blue-500/40'
                      : 'bg-gray-700/50 text-gray-500'
                }`}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
            </div>
            {i < total - 1 && (
              <div className={`mb-5 h-px w-14 transition-colors duration-500 ${
                isCompleted ? 'bg-blue-500/60' : 'bg-gray-700/50'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DirectorySetupView({ onComplete, defaultPath }: DirectorySetupViewProps) {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();

  const [directoryPath, setDirectoryPath] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // ── Fetch current projects dir on mount ──
  useEffect(() => {
    if (defaultPath) {
      setDirectoryPath(defaultPath);
      return;
    }

    let cancelled = false;

    settingsApi
      .getProjectsDir()
      .then((res) => {
        if (!cancelled) {
          setDirectoryPath(res.data.path || STARTER_PATH);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDirectoryPath(STARTER_PATH);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [defaultPath]);

  // ── Save directory and proceed ──
  const handleContinue = useCallback(async () => {
    const trimmed = directoryPath.trim();
    if (!trimmed) {
      setStatus('error');
      setMessage(t('setup.directory.enterPath'));
      return;
    }

    setStatus('saving');
    setMessage('');

    try {
      await settingsApi.setProjectsDir(trimmed);
      setStatus('success');
      setMessage(t('setup.directory.saved'));

      // Brief pause so the user sees the success state before the view
      // transitions to the next onboarding step.
      setTimeout(() => onComplete(), 350);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('setup.directory.failedToSave'));
    }
  }, [directoryPath, onComplete]);

  // ── Keyboard support ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && status !== 'saving') {
        handleContinue();
      }
    },
    [handleContinue, status],
  );

  // ── Clear transient errors on edit ──
  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDirectoryPath(e.target.value);
    setStatus((s) => (s === 'error' || s === 'success' ? 'idle' : s));
    setMessage((m) => (m ? '' : m));
  }, []);

  // ── Animation variants ──
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
    },
  };

  const saving = status === 'saving';

  return (
    <div className="onboarding-bg flex h-screen w-screen items-center justify-center">
      <motion.div
        className="w-full max-w-lg px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── Step indicator ── */}
        <motion.div variants={itemVariants} className="mb-6">
          <StepIndicator current={2} total={2} />
        </motion.div>

        {/* ── Branding ── */}
        <motion.div variants={itemVariants} className="mb-3 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <CompassIcon className="h-7 w-7 text-blue-400/80" />
          </motion.div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500 mb-2">
            {t('app.title')}
          </p>
          <h1 className="text-3xl font-light tracking-wide text-gray-100">
            {t('setup.directory.title')}
          </h1>
        </motion.div>

        {/* ── Step 1 summary ── */}
        <motion.div
          variants={itemVariants}
          className="mb-6 flex items-center justify-center gap-2 text-sm text-green-400/80"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span>{t('setup.directory.connectedProvider')}</span>
        </motion.div>

        {/* ── Main card ── */}
        <motion.div variants={itemVariants} className="onboarding-card rounded-2xl p-8">
          <p className="mb-6 text-sm leading-relaxed text-gray-400">
            {t('setup.directory.description')}
          </p>

          {/* ── Path input ── */}
          <div className="mb-5">
            <label htmlFor="projects-dir" className="mb-1.5 block text-xs font-medium text-gray-400">
              {t('setup.directory.projectsDirectory')}
            </label>
            <input
              id="projects-dir"
              type="text"
              value={directoryPath}
              onChange={handlePathChange}
              onKeyDown={handleKeyDown}
              placeholder={t('setup.directory.pathPlaceholder')}
              className="focus-ring w-full rounded-lg border border-gray-600/50 bg-gray-800/80 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors duration-200 hover:border-gray-500/70 disabled:opacity-50"
              disabled={saving}
              autoFocus
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              {t('setup.directory.pathHint')}
            </p>
          </div>

          {/* ── Status message ── */}
          {message && (
            <motion.div
              role="status"
              className={`mb-5 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm ${
                status === 'error'
                  ? 'border-red-800/50 bg-red-900/20 text-red-300'
                  : status === 'success'
                    ? 'border-green-700/50 bg-green-900/15 text-green-300'
                    : 'text-gray-400'
              }`}
              initial={{ opacity: 0, y: prefersReduced ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {status === 'success' && (
                <svg className="h-4 w-4 shrink-0 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
              {status === 'error' && (
                <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
              )}
              <span>{message}</span>
            </motion.div>
          )}

          {/* ── Continue button ── */}
          <motion.button
            onClick={handleContinue}
            disabled={saving || !directoryPath.trim()}
            className="focus-ring w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
            whileTap={prefersReduced ? undefined : { scale: 0.98 }}
          >
            {saving ? t('setup.directory.saving') : t('setup.directory.continue')}
          </motion.button>
        </motion.div>

        {/* ── Footer hint ── */}
        <motion.p
          variants={itemVariants}
          className="mt-8 text-center text-xs text-gray-600"
        >
          {t('setup.directory.footerHint')}
        </motion.p>
      </motion.div>
    </div>
  );
}
