import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { AiEffort, ImportState } from '../../../../shared/types';

/* ── Types ───────────────────────────────────────────────────────────────────── */

interface ProviderOption {
  id: string;
  name: string;
  models: string[];
  baseUrl?: string;
  apiKey?: string;
}

/* ── ConfigFormSection props (reusable from other steps) ─────────────────────── */

export interface ConfigFormSectionProps {
  file: File | null;
  filePath: string;
  bookName: string;
  setBookName: (name: string) => void;
  providers: ProviderOption[];
  providerId: string;
  setProviderId: (id: string) => void;
  availableModels: string[];
  model: string;
  setModel: (model: string) => void;
  effort: AiEffort;
  setEffort: (effort: AiEffort) => void;
  effortOptions: { efforts: string[]; default: string };
  effortDisabled: boolean;
  startPage: number;
  setStartPage: (page: number) => void;
  endPage: number;
  setEndPage: (page: number) => void;
  totalPages: number;
  chapterHints: string;
  setChapterHints: (hints: string) => void;
  isImporting: boolean;
  onSelectFile: () => void;
  bookNameInputRef?: React.RefObject<HTMLInputElement | null>;
}

/* ── ConfigureStep props ── */

export interface ConfigureStepProps {
  file: File | null;
  filePath: string;
  bookName: string;
  setBookName: (name: string) => void;
  providers: ProviderOption[];
  providerId: string;
  setProviderId: (id: string) => void;
  availableModels: string[];
  model: string;
  setModel: (model: string) => void;
  effort: AiEffort;
  setEffort: (effort: AiEffort) => void;
  effortOptions: { efforts: string[]; default: string };
  effortDisabled: boolean;
  startPage: number;
  setStartPage: (page: number) => void;
  endPage: number;
  setEndPage: (page: number) => void;
  totalPages: number;
  chapterHints: string;
  setChapterHints: (hints: string) => void;
  isImporting: boolean;
  onSelectFile: () => void;
  resumeState: ImportState | null;
  setResumeState: (state: ImportState | null) => void;
  setFilePath: (path: string) => void;
  setStep: (step: 'configure' | 'importing' | 'done') => void;
  setTotalPages: (pages: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  acceptedTypes: string;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  prefersReduced: boolean;
  bookNameInputRef: React.RefObject<HTMLInputElement | null>;
}

/* ── Config Form Section (reusable from other steps) ─────────────────────────── */

export function ConfigFormSection({
  file,
  filePath,
  bookName,
  setBookName,
  providers,
  providerId,
  setProviderId,
  availableModels,
  model,
  setModel,
  effort,
  setEffort,
  effortOptions,
  effortDisabled,
  startPage,
  setStartPage,
  endPage,
  setEndPage,
  totalPages,
  chapterHints,
  setChapterHints,
  isImporting,
  onSelectFile,
  bookNameInputRef,
}: ConfigFormSectionProps) {
  const { t } = useTranslation('app');
  return (
    <div className="space-y-5">
      {/* ── Book Details Section ── */}
      <div className="rounded-xl bg-white/[0.05] p-4 ring-1 ring-white/[0.08]">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-400/70">
          {t('import.configureStep.bookDetails')}
        </h3>

        {/* Selected File */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-400">
            {t('import.configureStep.fileLabel')}
          </label>
          <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08]">
              <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <span className="flex-1 truncate text-sm text-gray-200">
              {file?.name || filePath.split('/').pop() || t('import.configureStep.unknownFile')}
            </span>
            <button
              onClick={onSelectFile}
              className="focus-ring shrink-0 rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
            >
              {t('import.configureStep.changeFile')}
            </button>
          </div>
        </div>

        {/* Book Name */}
        <div>
          <label htmlFor="import-book-name" className="mb-1 block text-xs font-medium text-gray-400">
            {t('import.configureStep.bookName')}
          </label>
          <input
            ref={bookNameInputRef}
            id="import-book-name"
            type="text"
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            disabled={isImporting}
            placeholder={t('import.configureStep.bookNamePlaceholder')}
            className="focus-ring w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] focus:border-blue-500/50 focus:bg-white/[0.08] disabled:opacity-50"
          />
        </div>
      </div>

      {/* ── AI Settings Section ── */}
      <div className="rounded-xl bg-white/[0.05] p-4 ring-1 ring-white/[0.08]">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-400/70">
          {t('import.configureStep.aiSettings')}
        </h3>

        {/* Provider */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-400">{t('import.configureStep.provider')}</label>
          <select
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value);
              const prov = providers.find((p) => p.id === e.target.value);
              if (prov && prov.models.length > 0) {
                setModel(prov.models[0]);
              }
            }}
            disabled={isImporting || providers.length === 0}
            className="focus-ring w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-100 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] focus:border-blue-500/50 disabled:opacity-50"
          >
            {providers.length === 0 ? (
              <option value="">{t('import.configureStep.noProviders')}</option>
            ) : (
              <>
                <option value="">{t('import.configureStep.autoProvider')}</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Model + Effort row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="import-model" className="mb-1 block text-xs font-medium text-gray-400">
              {t('import.configureStep.model')}
            </label>
            {providerId && availableModels.length > 0 ? (
              <select
                id="import-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isImporting}
                className="focus-ring w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-100 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] focus:border-blue-500/50 disabled:opacity-50"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="import-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isImporting}
                placeholder={t('import.configureStep.modelPlaceholder')}
                className="focus-ring w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] focus:border-blue-500/50 disabled:opacity-50"
              />
            )}
          </div>

          <div className="w-32">
            <label htmlFor="import-effort" className="mb-1 block text-xs font-medium text-gray-400">
              {t('import.configureStep.effort')}
            </label>
            {effortDisabled ? (
              <div className="focus-ring w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-500">
                {t('import.configureStep.alwaysOn')}
              </div>
            ) : (
              <select
                id="import-effort"
                value={effort}
                onChange={(e) => setEffort(e.target.value as AiEffort)}
                disabled={isImporting}
                className="focus-ring w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-100 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] focus:border-blue-500/50 disabled:opacity-50"
              >
                {effortOptions.efforts.map((e) => (
                  <option key={e} value={e}>
                    {e.charAt(0).toUpperCase() + e.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── Optional Section ── */}
      <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {t('import.configureStep.optional')}
          </h3>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-white/[0.08]">
            {t('import.configureStep.advanced')}
          </span>
        </div>

        {/* ── Prompt ── */}
        <div className="mb-3">
          <label htmlFor="import-prompt" className="mb-1 block text-xs font-medium text-gray-400">
            {t('labels.prompt', { ns: 'common' })} <span className="text-gray-600">{t('import.configureStep.optional')}</span>
          </label>
          <textarea
            id="import-prompt"
            rows={3}
            value={chapterHints}
            onChange={(e) => setChapterHints(e.target.value)}
            disabled={isImporting}
            placeholder={t('import.configureStep.promptHint')}
            className="focus-ring w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] focus:border-blue-500/50 focus:bg-white/[0.08] disabled:opacity-50"
          />
        </div>

        {/* Page Range */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            {t('import.configureStep.pageRange')}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={startPage}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  setStartPage(v);
                  if (v > endPage) setEndPage(v);
                }}
                disabled={isImporting}
                min={1}
                max={totalPages}
                className="focus-ring w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-100 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] focus:border-blue-500/50 disabled:opacity-50"
              />
            </div>
            <span className="text-xs text-gray-600">{t('import.configureStep.to')}</span>
            <div className="flex-1">
              <input
                type="number"
                value={endPage}
                onChange={(e) => {
                  const v = Math.max(startPage, parseInt(e.target.value) || startPage);
                  setEndPage(v);
                }}
                disabled={isImporting}
                min={startPage}
                max={totalPages}
                className="focus-ring w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-gray-100 transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] focus:border-blue-500/50 disabled:opacity-50"
              />
            </div>
            <span className="shrink-0 text-xs text-gray-600">{t('import.configureStep.totalPages', { total: totalPages })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ConfigureStep (file selection + configuration form) ─────────────────────── */

export function ConfigureStep({
  file,
  filePath,
  bookName,
  setBookName,
  providers,
  providerId,
  setProviderId,
  availableModels,
  model,
  setModel,
  effort,
  setEffort,
  effortOptions,
  effortDisabled,
  startPage,
  setStartPage,
  endPage,
  setEndPage,
  totalPages,
  chapterHints,
  setChapterHints,
  isImporting,
  onSelectFile,
  resumeState,
  setResumeState,
  setFilePath,
  setStep,
  setTotalPages,
  fileInputRef,
  acceptedTypes,
  handleFileInputChange,
  prefersReduced,
  bookNameInputRef,
}: ConfigureStepProps) {
  const { t } = useTranslation('app');
  // ── If no file selected yet, show file selection UI ──
  if (!file && !filePath) {
    return (
      <>
        {!window.electron?.openFileDialog && (
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            className="hidden"
            onChange={handleFileInputChange}
          />
        )}
        <div className="flex flex-col items-center gap-5 py-6">
          {/* ── Resume banner ── */}
          {resumeState && (
            <div className="w-full rounded-xl border border-amber-600/30 bg-amber-500/5 p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2.5 text-amber-300">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">{t('import.configureStep.resumeBanner.title')}</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  {t('import.configureStep.resumeBanner.resuming')}
                </span>
              </div>
              <p className="mb-3 pl-8 text-sm text-amber-200/70">
                {t('import.configureStep.resumeBanner.description', { current: resumeState.currentPage, total: resumeState.totalPages, filename: resumeState.filename })}
              </p>
              <div className="flex gap-2 pl-8">
                <motion.button
                  onClick={() => {
                    let name = resumeState.filename.replace(/\.(pdf|docx|odt|txt)$/i, '');
                    name = name.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
                    setBookName(name);
                    setFilePath(resumeState.sourcePath || resumeState.filename);
                    setStartPage((resumeState.currentPage || 0) + 1);
                    setTotalPages(resumeState.totalPages);
                    setEndPage(resumeState.endPage || resumeState.totalPages);
                    setProviderId(resumeState.providerId || '');
                    setModel(resumeState.model || '');
                    setEffort(resumeState.effort || 'medium' as AiEffort);
                    setChapterHints(resumeState.chapterHints || '');
                    setResumeState(null);
                    setStep('configure');
                  }}
                  className="focus-ring rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 px-4 py-1.5 text-xs font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_2px_8px_rgba(217,119,6,0.4)]"
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                >
                  {t('buttons.resume', { ns: 'common' })}
                </motion.button>
                <motion.button
                  onClick={() => setResumeState(null)}
                  className="focus-ring rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 backdrop-blur-sm transition-all hover:border-white/15 hover:bg-white/[0.08] hover:text-gray-300"
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                >
                  {t('buttons.startFresh', { ns: 'common' })}
                </motion.button>
              </div>
            </div>
          )}

          {/* ── Dropzone area ── */}
          <motion.button
            onClick={onSelectFile}
            className="group focus-ring relative w-full max-w-sm rounded-2xl border-2 border-dashed border-[var(--theme-border)] bg-white/[0.02] p-10 text-center transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-500/[0.04]"
            whileTap={prefersReduced ? undefined : { scale: 0.985 }}
            aria-label={t('import.configureStep.dropzoneLabel')}
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: 'inset 0 0 30px rgba(59,130,246,0.06)' }} />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-blue-600/5 ring-1 ring-blue-500/15 transition-all duration-300 group-hover:from-blue-500/25 group-hover:to-blue-600/10 group-hover:ring-blue-500/25 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <svg className="h-7 w-7 text-blue-400/80 transition-colors group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="mb-1 text-sm font-medium text-gray-300 transition-colors group-hover:text-gray-200">
              {t('import.configureStep.dropzoneLabel')}
            </p>
            <p className="text-xs text-gray-600">{t('import.configureStep.dropzoneHint')}</p>
          </motion.button>
        </div>
      </>
    );
  }

  // ── File selected — show configuration form ──
  return (
    <>
      {!window.electron?.openFileDialog && (
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={handleFileInputChange}
        />
      )}
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
        isImporting={isImporting}
        onSelectFile={onSelectFile}
        bookNameInputRef={bookNameInputRef}
      />
    </>
  );
}
