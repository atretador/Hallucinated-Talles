import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { aiApi, effortConfigApi, getImportState, getPageCount } from '../../api/client';
import type { AiProvider, AiEffort, ImportState, EffortConfig } from '../../../../shared/types';
import { getEffortsForModel } from '../../../../shared/effortUtils';
import { useImportStream } from './useImportStream';
import { ConfigureStep, ConfigFormSection } from './ConfigureStep';
import { ImportingStep } from './ImportingStep';
import { DoneStep } from './DoneStep';

/* ── Types ───────────────────────────────────────────────────────────────────── */

interface ImportStatus {
  isImporting: boolean;
  progress: number;   // 0–100
  bookName: string;
}

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (bookId: string) => void;
  isMinimized: boolean;
  onMinimizeChange: (minimized: boolean) => void;
  onImportStatus: (status: ImportStatus | null) => void;
}

interface ProviderOption {
  id: string;
  name: string;
  models: string[];
  baseUrl?: string;
  apiKey?: string;
}

/* ── Step config ────────────────────────────────────────────────────────────── */

const STEPS = [
  { key: 'configure' as const, labelKey: 'import.steps.configure' },
  { key: 'importing' as const, labelKey: 'import.steps.importing' },
  { key: 'done' as const, labelKey: 'import.steps.done' },
] as const;

type Step = (typeof STEPS)[number]['key'];

/* ── Component ────────────────────────────────────────────────────────────────── */

export default function ImportDialog({
  isOpen,
  onClose,
  onImportComplete,
  isMinimized,
  onMinimizeChange,
  onImportStatus,
}: ImportDialogProps) {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();

  // ── Streaming hook ──
  const {
    isImporting,
    progress,
    entities,
    error: streamError,
    warnings,
    warningReportPath,
    startImport,
    cancelImport,
  } = useImportStream();

  // Local error state for validation / file-selection errors
  const [configError, setConfigError] = useState<string | null>(null);
  const error = configError || streamError;

  // ── Motion variants ──
  const overlayVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const contentVariants: Variants = {
    hidden: {
      opacity: 0,
      ...(prefersReduced ? {} : { scale: 0.96, y: 24 }),
    },
    visible: {
      opacity: 1,
      ...(prefersReduced ? {} : { scale: 1, y: 0 }),
    },
    exit: {
      opacity: 0,
      ...(prefersReduced ? {} : { scale: 0.96, y: 24 }),
      transition: { duration: 0.2 },
    },
  };

  // ── Config state ──
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState('');
  const [bookName, setBookName] = useState('');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState<AiEffort>('medium');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [chapterHints, setChapterHints] = useState('');
  const [step, setStep] = useState<Step>('configure');
  const [resumeState, setResumeState] = useState<ImportState | null>(null);

  // ── Effort config ──
  const [effortConfig, setEffortConfig] = useState<EffortConfig | null>(null);
  const [effortOptions, setEffortOptions] = useState<{ efforts: string[]; default: string }>({
    efforts: ['low', 'medium', 'high'],
    default: 'medium',
  });
  const [effortDisabled, setEffortDisabled] = useState(false);

  // ── File input refs ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bookNameInputRef = useRef<HTMLInputElement>(null);

  // ── Accepted file types ──
  const acceptedTypes = '.pdf,.docx,.odt,.txt';

  // ── Selected provider (needed for OpenRouter effort resolution) ──
  const selectedProvider = providers.find((p) => p.id === providerId);
  const availableModels = selectedProvider?.models ?? [];

  // ── Report import status to parent for header indicator ──
  const progressPercent =
    progress.totalPages > 0 ? Math.round((progress.page / progress.totalPages) * 100) : 0;

  useEffect(() => {
    if (isImporting) {
      onImportStatus({ isImporting: true, progress: progressPercent, bookName: bookName || t('import.importingTitle') });
    } else if (step === 'done' || step === 'configure') {
      onImportStatus(null);
    }
  }, [isImporting, progressPercent, bookName, step, onImportStatus]);

  // ── Fetch providers on mount ──
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadProviders() {
      try {
        const res = await aiApi.getStatus();
        if (cancelled || !res.success) return;
        const provs: ProviderOption[] = (res.settings?.providers ?? []).map((p: AiProvider) => ({
          id: p.id,
          name: p.name,
          models: p.models ?? [],
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
        }));
        setProviders(provs);

        // Auto-select active provider & model
        if (res.settings?.activeProviderId) {
          setProviderId(res.settings.activeProviderId);
        }
        if (res.settings?.activeModel) {
          setModel(res.settings.activeModel);
        }
      } catch {
        // providers unavailable — user can still type model manually
        console.debug('[ImportDialog] Providers unavailable, user can type model manually');
      }
    }

    loadProviders();
    return () => { cancelled = true; };
  }, [isOpen]);

  // ── Effort config ──
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadEffortConfig() {
      try {
        const res = await effortConfigApi.get();
        if (!cancelled && res.success && res.data) {
          setEffortConfig(res.data);
        }
      } catch {
        // Effort config service might not be ready yet
        console.debug('[ImportDialog] Effort config not ready yet, skipping');
      }
    }

    loadEffortConfig();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Update effort options when model or config changes
  useEffect(() => {
    if (!effortConfig || !model) return;

    let cancelled = false;

    const resolveOptions = async () => {
      // If provider is OpenRouter, use server-side resolution with live metadata
      const providerUrl = selectedProvider?.baseUrl;
      const providerApiKey = selectedProvider?.apiKey;
      const isOpenRouter = providerUrl && (
        providerUrl.includes('openrouter.ai') || providerUrl.includes('openrouter')
      );

      let resolved: { efforts: string[]; default: string };
      if (isOpenRouter) {
        try {
          const res = await effortConfigApi.resolve(model, providerUrl, providerApiKey);
          if (cancelled) return;
          if (res.success && res.data) {
            resolved = { efforts: res.data.efforts, default: res.data.default };
          } else {
            resolved = getEffortsForModel(effortConfig, model);
          }
        } catch {
          if (cancelled) return;
          resolved = getEffortsForModel(effortConfig, model);
        }
      } else {
        resolved = getEffortsForModel(effortConfig, model);
      }

      if (cancelled) return;
      setEffortOptions(resolved);
      setEffortDisabled(resolved.efforts.length === 0);

      // If current effort isn't in the new model's supported list, reset to default
      if (resolved.efforts.length > 0 && !resolved.efforts.includes(effort)) {
        setEffort(resolved.default as AiEffort);
      } else if (resolved.efforts.length === 0) {
        setEffort('' as AiEffort);
      }
    };

    resolveOptions();
    return () => { cancelled = true; };
  }, [model, effortConfig, selectedProvider?.baseUrl]);

  // ── Reset form when dialog opens ──
  useEffect(() => {
    if (isOpen) {
      setStep('configure');
      setFile(null);
      setFilePath('');
      setBookName('');
      setStartPage(1);
      setEndPage(1);
      setTotalPages(1);
      setChapterHints('');
      setResumeState(null);
      setConfigError(null); // local error state from config validation
      onMinimizeChange(false);

      // Cancel any lingering import from a previous session
      cancelImport();

      // Check if there's an existing incomplete import for the active book
      const activeBookId = (window as unknown as Record<string, unknown>).__activeBookId as string;
      let importStateCancelled = false;
      if (activeBookId) {
        getImportState(activeBookId).then((state) => {
          if (!importStateCancelled && state && (state.status === 'processing' || state.status === 'failed')) {
            setResumeState(state);
          }
        }).catch(() => {
          // Ignore — no import state for this book
        });
      }

      // Auto-focus book name on configure step
      setTimeout(() => bookNameInputRef.current?.focus(), 100);

      return () => {
        importStateCancelled = true;
      };
    }
  }, [isOpen]);

  // Reset model if it's not in the new provider's list
  useEffect(() => {
    if (providerId && availableModels.length > 0 && !availableModels.includes(model)) {
      setModel(availableModels[0]);
    }
  }, [providerId, availableModels, model]);

  // ── File selection ──
  const handleSelectFile = useCallback(async () => {
    try {
      // Try native dialog first
      if (window.electron?.openFileDialog) {
        const result = await window.electron.openFileDialog([
          { name: t('import.configureStep.supportedDocuments'), extensions: ['pdf', 'docx', 'odt', 'txt'] },
        ]);
        if (result.canceled || !result.filePaths?.length) return;

        const path = result.filePaths[0];
        setFilePath(path);

        // Extract filename for display
        const segments = path.replace(/\\/g, '/').split('/');
        const filename = segments[segments.length - 1] || t('import.configureStep.unknownFile');
        setFile(new File([], filename));

        // Extract book name from filename (strip extension)
        let nameCandidate = filename.replace(/\.(pdf|docx|odt|txt)$/i, '');
        // Replace underscores/hyphens with spaces, clean up
        nameCandidate = nameCandidate.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (nameCandidate) {
          setBookName(nameCandidate);
        }

        // Auto-detect page count
        try {
          const pages = await getPageCount(path);
          setTotalPages(pages);
          setEndPage(pages);
        } catch {
          // Keep default of 1 — not critical
          console.debug('[ImportDialog] Page count detection failed, keeping default of 1');
        }
      } else {
        // Fallback to HTML file input
        fileInputRef.current?.click();
      }
    } catch {
      setConfigError(t('import.configureStep.failedFileDialog'));
    }
  }, []);

  // ── Fallback: HTML file input change ──
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Browser fallback is not supported - require Electron
    if (!window.electron?.openFileDialog) {
      setConfigError(t('import.configureStep.electronRequired'));
      return;
    }

    // This shouldn't be reached since the input is hidden when Electron is available
    setConfigError(t('import.configureStep.useChooseFile'));
  }, []);

  // ── Start import ──
  const handleStartImport = useCallback(() => {
    if (!filePath || !bookName.trim()) {
      setConfigError(t('validation.selectFileAndBookName', { ns: 'common' }));
      return;
    }

    startImport(
      {
        bookName: bookName.trim(),
        filePath,
        startPage,
        endPage,
        providerId: providerId || undefined,
        model: model || undefined,
        effort,
        chapterHints: chapterHints || undefined,
      },
      {
        onStepChange: (newStep) => setStep(newStep),
        onComplete: (bookId) => onImportComplete(bookId),
        onMinimizeChange: (minimized) => onMinimizeChange(minimized),
      },
    );
  }, [filePath, bookName, startPage, endPage, providerId, model, effort, chapterHints, onImportComplete, startImport]);

  // ── Cancel import ──
  const handleCancel = useCallback(() => {
    cancelImport();
    setStep('configure');
  }, [cancelImport]);

  // ── Minimize during import, close otherwise ──
  const handleMinimizeOrClose = useCallback(() => {
    if (isImporting) {
      onMinimizeChange(true);
    } else {
      onClose();
    }
  }, [isImporting, onClose]);

  // ── Close and reset (truly cancel + close) ──
  const handleClose = useCallback(() => {
    if (isImporting) {
      handleCancel();
    }
    onMinimizeChange(false);
    onClose();
  }, [isImporting, handleCancel, onClose]);

  // ── Current stepper index ──
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Render ──
  return (
    <AnimatePresence>
      {isOpen && (
        <div key="import-root">
          {/* ── Full modal (hidden when minimized) ── */}
          {!isMinimized && (
            <motion.div
              key="import-overlay"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.2 }}
              onClick={isImporting ? undefined : handleClose}
            >
              <motion.div
                key="import-content"
                className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 shadow-[var(--shadow-3)] backdrop-blur-xl"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Header ── */}
                <div className="mb-4 flex items-center justify-between border-b border-[var(--glass-border)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 ring-1 ring-blue-500/20">
                      <svg className="h-4.5 w-4.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-100">
                      {step === 'importing'
                        ? t('import.importingTitle')
                        : step === 'done'
                          ? t('import.completeTitle')
                          : t('import.title')}
                    </h2>
                  </div>
                  <button
                    onClick={handleMinimizeOrClose}
                    className="focus-ring rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
                    aria-label={isImporting ? t('import.minimize') : t('import.close')}
                  >
                    {isImporting ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* ── Step Indicator (hidden when no file selected) ── */}
                {(file || filePath) && (
                  <div className="mb-6 flex items-center justify-center gap-0">
                    {STEPS.map((s, i) => {
                      const isActive = s.key === step;
                      const isCompleted = currentStepIndex > i;
                      return (
                        <div key={s.key} className="flex items-center">
                          {/* Dot */}
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-300 ${
                                isActive
                                  ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                                  : isCompleted
                                    ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                                    : 'bg-white/5 text-gray-600 ring-1 ring-white/10'
                              }`}
                            >
                              {isCompleted ? (
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                i + 1
                              )}
                            </div>
                            <span
                              className={`text-xs font-medium transition-colors duration-300 ${
                                isActive ? 'text-blue-400' : isCompleted ? 'text-gray-400' : 'text-gray-600'
                              }`}
                            >
                              {t(s.labelKey)}
                            </span>
                          </div>
                          {/* Connector line */}
                          {i < STEPS.length - 1 && (
                            <div className="mx-3 flex items-center">
                              <div
                                className={`h-px w-10 transition-colors duration-300 ${
                                  isCompleted ? 'bg-blue-500/40' : 'bg-white/10'
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Configure Step (file selection + configuration) ── */}
                {step === 'configure' && (
                  <ConfigureStep
                    file={file}
                    filePath={filePath}
                    bookName={bookName}
                    setBookName={setBookName}
                    providers={providers}
                    providerId={providerId}
                    setProviderId={setProviderId}
                    availableModels={availableModels}
                    model={model}
                    setModel={setModel}
                    effort={effort}
                    setEffort={setEffort}
                    effortOptions={effortOptions}
                    effortDisabled={effortDisabled}
                    startPage={startPage}
                    setStartPage={setStartPage}
                    endPage={endPage}
                    setEndPage={setEndPage}
                    totalPages={totalPages}
                    chapterHints={chapterHints}
                    setChapterHints={setChapterHints}
                    isImporting={false}
                    onSelectFile={handleSelectFile}
                    resumeState={resumeState}
                    setResumeState={setResumeState}
                    setFilePath={setFilePath}
                    setStep={setStep}
                    setTotalPages={setTotalPages}
                    fileInputRef={fileInputRef}
                    acceptedTypes={acceptedTypes}
                    handleFileInputChange={handleFileInputChange}
                    prefersReduced={!!prefersReduced}
                    bookNameInputRef={bookNameInputRef}
                  />
                )}

                {/* ── Importing Step ── */}
                {step === 'importing' && (
                  <div className="space-y-5">
                    <ConfigFormSection
                      file={file}
                      filePath={filePath}
                      bookName={bookName}
                      setBookName={setBookName}
                      providers={providers}
                      providerId={providerId}
                      setProviderId={setProviderId}
                      availableModels={availableModels}
                      model={model}
                      setModel={setModel}
                      effort={effort}
                      setEffort={setEffort}
                      effortOptions={effortOptions}
                      effortDisabled={effortDisabled}
                      startPage={startPage}
                      setStartPage={setStartPage}
                      endPage={endPage}
                      setEndPage={setEndPage}
                      totalPages={totalPages}
                      chapterHints={chapterHints}
                      setChapterHints={setChapterHints}
                      isImporting={true}
                      onSelectFile={handleSelectFile}
                    />
                    <ImportingStep
                      progress={progress}
                      entities={entities}
                      prefersReduced={!!prefersReduced}
                    />
                  </div>
                )}

                {/* ── Done Step ── */}
                {step === 'done' && (
                  <div className="space-y-5">
                    <ConfigFormSection
                      file={file}
                      filePath={filePath}
                      bookName={bookName}
                      setBookName={setBookName}
                      providers={providers}
                      providerId={providerId}
                      setProviderId={setProviderId}
                      availableModels={availableModels}
                      model={model}
                      setModel={setModel}
                      effort={effort}
                      setEffort={setEffort}
                      effortOptions={effortOptions}
                      effortDisabled={effortDisabled}
                      startPage={startPage}
                      setStartPage={setStartPage}
                      endPage={endPage}
                      setEndPage={setEndPage}
                      totalPages={totalPages}
                      chapterHints={chapterHints}
                      setChapterHints={setChapterHints}
                      isImporting={false}
                      onSelectFile={handleSelectFile}
                    />
                    <DoneStep
                      progress={progress}
                      entities={entities}
                      prefersReduced={!!prefersReduced}
                    />
                    {warnings.length > 0 && (
                      <div className="rounded-xl border border-amber-300/20 bg-amber-50/10 px-4 py-3 text-sm text-amber-200">
                        <div className="flex items-start gap-2.5">
                          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                          <div className="flex-1">
                            <span>
                              Some HTML elements were stripped during import for security.{' '}
                              {warnings.length} element(s) were removed.
                            </span>
                            {warningReportPath && window.electron?.openPath && (
                              <button
                                onClick={() => window.electron?.openPath?.(warningReportPath)}
                                className="ml-2 font-medium text-amber-400 underline underline-offset-2 hover:text-amber-300"
                              >
                                View Report
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Error ── */}
                {error && (
                  <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                    <div className="flex items-start gap-2.5">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {/* ── Actions ── */}
                <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--glass-border)] pt-4">
                  {step === 'configure' && (
                    <>
                      <motion.button
                        onClick={handleClose}
                        className="focus-ring rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-400 backdrop-blur-sm transition-all hover:border-white/15 hover:bg-white/[0.08] hover:text-gray-300"
                        whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                      >
                        {t('buttons.cancel', { ns: 'common' })}
                      </motion.button>
                      <motion.button
                        onClick={handleStartImport}
                        disabled={!filePath || !bookName.trim()}
                        className="focus-ring rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 px-5 py-2 text-sm font-medium text-white shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_2px_12px_rgba(59,130,246,0.35)] disabled:opacity-40 disabled:shadow-none disabled:hover:from-blue-500 disabled:hover:to-blue-600"
                        whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                      >
                        {t('import.startImport')}
                      </motion.button>
                    </>
                  )}
                  {step === 'importing' && (
                    <motion.button
                      onClick={handleCancel}
                      className="focus-ring rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 backdrop-blur-sm transition-all hover:border-red-500/30 hover:bg-red-500/15"
                      whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                    >
                      {t('import.cancelImport')}
                    </motion.button>
                  )}
                  {step === 'done' && (
                    <motion.button
                      onClick={handleClose}
                      className="focus-ring rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:from-emerald-400 hover:to-emerald-500 hover:shadow-[0_2px_12px_rgba(52,211,153,0.35)]"
                      whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                    >
                      {t('import.done')}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
