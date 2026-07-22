import { useCallback, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { aiApi } from '../../api/client';
import type { AiProvider } from '../../../../shared/types';

interface LlmSetupViewProps {
  onComplete: () => void;
}

/* ── Decorative icon: AI sparkle ── */
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
      <path d="M19 15L19.75 17.25L22 18L19.75 18.75L19 21L18.25 18.75L16 18L18.25 17.25L19 15Z" />
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
              <motion.div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : isActive
                      ? 'bg-blue-500/15 text-blue-400 ring-2 ring-blue-500/40'
                      : 'bg-gray-700/50 text-gray-500'
                }`}
                initial={false}
                animate={isActive ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </motion.div>
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

export function LlmSetupView({ onComplete }: LlmSetupViewProps) {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();

  // Form state
  const [name, setName] = useState('Ollama');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [apiKey, setApiKey] = useState('');
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [discoveredContextLengths, setDiscoveredContextLengths] = useState<Record<string, number>>({});
  const [selectedModel, setSelectedModel] = useState('');

  // UI state
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Entrance animation variants
  const fadeUp: Variants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.07,
        duration: prefersReduced ? 0 : 0.5,
        ease: [0.25, 0.1, 0.25, 1],
      },
    }),
  };

  /** Fetch models from the provider's API */
  const handleDiscoverModels = useCallback(async () => {
    if (!baseUrl.trim()) {
      setMessage({ type: 'error', text: t('validation.enterBaseUrlFirst', { ns: 'common' }) });
      return;
    }

    setDiscovering(true);
    setMessage(null);
    setDiscoveryDone(false);
    setIsSuccess(false);
    setDiscoveredModels([]);
    setSelectedModel('');

    try {
      const res = await aiApi.discoverModels(baseUrl.trim(), apiKey.trim() || undefined);

      if (res.success && res.models && res.models.length > 0) {
        setDiscoveredModels(res.models);
        setDiscoveredContextLengths(res.contextLengths || {});
        setSelectedModel(res.models[0]);
        setDiscoveryDone(true);
        setMessage({ type: 'success', text: t('setup.llm.foundModels', { count: res.models.length }) });
      } else {
        setMessage({ type: 'error', text: res.error || t('setup.llm.noModelsFound') });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: t('setup.llm.discoveryFailed', { error: err instanceof Error ? err.message : String(err) }),
      });
    } finally {
      setDiscovering(false);
    }
  }, [baseUrl, apiKey]);

  /** Save provider, set it active, and complete setup */
  const handleContinue = useCallback(async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: t('setup.llm.providerNameRequired') });
      return;
    }
    if (!baseUrl.trim()) {
      setMessage({ type: 'error', text: t('setup.llm.baseUrlRequired') });
      return;
    }
    if (!selectedModel) {
      setMessage({ type: 'error', text: t('setup.llm.selectModel') });
      return;
    }

    setSaving(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const provider: AiProvider = {
        id: `provider-${Date.now()}`,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey,
        models: discoveredModels.length > 0 ? discoveredModels : [selectedModel],
        contextLengths: Object.keys(discoveredContextLengths).length > 0 ? discoveredContextLengths : undefined,
      };

      const addRes = await aiApi.addProvider(provider);
      const providerId = addRes.data?.id ?? provider.id;

      await aiApi.setActive(providerId, selectedModel);

      setMessage({ type: 'success', text: t('setup.llm.connected', { name: name.trim() }) });
      setIsSuccess(true);

      // Brief success display before completing
      setTimeout(() => {
        onComplete();
      }, 800);
    } catch (err) {
      setMessage({
        type: 'error',
        text: t('setup.llm.failedToSave', { error: err instanceof Error ? err.message : String(err) }),
      });
    } finally {
      setSaving(false);
    }
  }, [name, baseUrl, apiKey, selectedModel, discoveredModels, discoveredContextLengths, onComplete]);

  const canContinue = name.trim() && baseUrl.trim() && selectedModel && !saving;

  return (
    <motion.div
      className="onboarding-bg flex min-h-screen items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReduced ? 0 : 0.5 }}
    >
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="mb-6"
        >
          <StepIndicator current={1} total={2} />
        </motion.div>

        {/* Welcome heading */}
        <motion.div
          className="mb-8 text-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <SparkleIcon className="h-7 w-7 text-blue-400/80" />
          </motion.div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500 mb-2">
            {t('setup.llm.welcomeTo')}
          </p>
          <h1 className="text-3xl font-light tracking-wide text-gray-100">
            {t('app.title')}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {t('setup.llm.subtitle')}
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          className={`onboarding-card rounded-2xl p-8 transition-all duration-300 ${
            isSuccess ? 'animate-celebrate !border-green-500/30' : ''
          }`}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
        >
          <h2 className="mb-6 text-base font-semibold text-gray-200">
            {t('setup.llm.title')}
          </h2>

          <div className="space-y-5">
            {/* Provider Name */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
              <label htmlFor="provider-name" className="mb-1.5 block text-xs font-medium text-gray-400">
                {t('setup.llm.providerName')}
              </label>
              <input
                id="provider-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('setup.llm.providerNamePlaceholder')}
                className="focus-ring w-full rounded-lg border border-gray-600/50 bg-gray-800/80 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors duration-200 hover:border-gray-500/70"
              />
            </motion.div>

            {/* Base URL */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
              <label htmlFor="provider-url" className="mb-1.5 block text-xs font-medium text-gray-400">
                {t('setup.llm.baseUrl')}
              </label>
              <input
                id="provider-url"
                type="text"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setDiscoveryDone(false);
                  setDiscoveredModels([]);
                  setSelectedModel('');
                }}
                placeholder={t('setup.llm.baseUrlPlaceholder')}
                className="focus-ring w-full rounded-lg border border-gray-600/50 bg-gray-800/80 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors duration-200 hover:border-gray-500/70"
              />
            </motion.div>

            {/* API Key */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
              <label htmlFor="provider-key" className="mb-1.5 block text-xs font-medium text-gray-400">
                {t('setup.llm.apiKey')}{' '}
                <span className="text-gray-500 font-normal">{t('setup.llm.apiKeyHint')}</span>
              </label>
              <input
                id="provider-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('setup.llm.apiKeyPlaceholder')}
                className="focus-ring w-full rounded-lg border border-gray-600/50 bg-gray-800/80 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors duration-200 hover:border-gray-500/70"
              />
            </motion.div>

            {/* Discover Models */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
              <div className="flex items-end gap-2.5">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">{t('setup.llm.model')}</label>
                  {discoveredModels.length > 0 ? (
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="focus-ring w-full rounded-lg border border-gray-600/50 bg-gray-800/80 px-4 py-2.5 text-sm text-gray-100 transition-colors duration-200 hover:border-gray-500/70"
                    >
                      {discoveredModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      placeholder={t('setup.llm.modelPlaceholder')}
                      className="focus-ring w-full rounded-lg border border-gray-600/50 bg-gray-800/80 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors duration-200 hover:border-gray-500/70"
                    />
                  )}
                  {discoveryDone && discoveredModels.length === 0 && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      {t('setup.llm.noModelsHint')}
                    </p>
                  )}
                </div>
                <motion.button
                  type="button"
                  onClick={handleDiscoverModels}
                  disabled={discovering || !baseUrl.trim()}
                  className="focus-ring shrink-0 rounded-lg border border-gray-600/50 bg-gray-700/40 px-4 py-2.5 text-sm font-medium text-gray-300 transition-all duration-200 hover:border-blue-500/30 hover:bg-blue-900/30 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-600/50 disabled:hover:bg-gray-700/40 disabled:hover:text-gray-300"
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                >
                  {discovering ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400/40 border-t-blue-400" />
                      {t('setup.llm.scanning')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                      {t('setup.llm.discoverModels')}
                    </span>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Status message */}
          {message && (
            <motion.div
              className={`mt-5 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm ${
                message.type === 'error'
                  ? 'border-red-800/50 bg-red-900/20 text-red-300'
                  : message.type === 'success'
                    ? 'border-green-700/50 bg-green-900/15 text-green-300'
                    : 'border-gray-600 bg-gray-700/50 text-gray-300'
              }`}
              initial={{ opacity: 0, y: prefersReduced ? 0 : -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {message.type === 'success' && (
                <motion.svg
                  className="h-4 w-4 shrink-0 text-green-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                >
                  <path d="M5 13l4 4L19 7" />
                </motion.svg>
              )}
              {message.type === 'error' && (
                <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
              )}
              <span>{message.text}</span>
            </motion.div>
          )}

          {/* Continue button */}
          <motion.div
            className="mt-6"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={7}
          >
            <motion.button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className="focus-ring w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              whileTap={prefersReduced || !canContinue ? undefined : { scale: 0.98 }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {t('setup.llm.connecting')}
                </span>
              ) : (
                t('setup.llm.continue')
              )}
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Footer hint */}
        <motion.p
          className="mt-8 text-center text-xs text-gray-600"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={8}
        >
          {t('setup.llm.footerHint')}
        </motion.p>
      </div>
    </motion.div>
  );
}
