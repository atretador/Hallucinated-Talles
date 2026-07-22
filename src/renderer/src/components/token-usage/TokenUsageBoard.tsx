import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import { tokenUsageApi } from '../../api/client';
import { useAppStore } from '../../stores';
import { FilterBar } from './FilterBar';
import { KpiCards } from './KpiCards';
import { UsageOverTimeChart } from './UsageOverTimeChart';
import { ModelDistributionChart } from './ModelDistributionChart';
import { TokenTable } from './TokenTable';
import type { TokenUsageRecord, TokenUsageSummary } from '../../../../shared/types';

/* ── Constants ── */

const PAGE_SIZE = 15;

/* ── Props ── */

interface TokenUsageBoardProps {
  onClose: () => void;
}

/* ── Helpers ── */

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/* ── Component ── */

export function TokenUsageBoard({ onClose }: TokenUsageBoardProps) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const shouldReduce = prefersReduced ?? true;

  /* ── Filter state ── */
  const { from: defaultFrom, to: defaultTo } = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [source, setSource] = useState<'all' | 'chat' | 'import'>('all');

  /* ── Data state ── */
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [records, setRecords] = useState<TokenUsageRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [models, setModels] = useState<string[]>([]);
  const [projects, setProjects] = useState<Array<{ projectId: string; projectName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [retentionDays, setRetentionDays] = useState(90);
  const [retentionSaving, setRetentionSaving] = useState(false);

  /* ── App store for project navigation ── */
  const { switchProject, setAppView } = useAppStore();

  /* ── Abort controller refs for cleanup ── */
  const summaryAbortRef = useRef<AbortController | null>(null);
  const recordsAbortRef = useRef<AbortController | null>(null);

  /* ── Fetch models on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function loadModels() {
      try {
        const res = await tokenUsageApi.getModels();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          setModels(res.data);
        }
      } catch {
        // models list is non-critical
        console.debug('[TokenUsageBoard] Models list not critical, skipping');
      }
    }
    loadModels();
    return () => { cancelled = true; };
  }, []);

  /* ── Fetch retention days on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function loadRetention() {
      try {
        const res = await tokenUsageApi.getRetentionDays();
        if (cancelled) return;
        if (res.success && res.data) {
          setRetentionDays(res.data.days);
        }
      } catch {
        // non-critical
        console.debug('[TokenUsageBoard] Retention days non-critical, skipping');
      }
    }
    loadRetention();
    return () => { cancelled = true; };
  }, []);

  /* ── Fetch projects on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function loadProjects() {
      try {
        const res = await tokenUsageApi.getProjects();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          setProjects(res.data);
        }
      } catch {
        // non-critical
        console.debug('[TokenUsageBoard] Projects list non-critical, skipping');
      }
    }
    loadProjects();
    return () => { cancelled = true; };
  }, []);

  /* ── Existing project IDs set (for broken-link detection) ── */
  const existingProjectIds = useRef(new Set<string>());
  useEffect(() => {
    existingProjectIds.current = new Set(projects.map(p => p.projectId));
  }, [projects]);

  /* ── Build query params from current filters ── */
  const buildRecordsParams = useCallback(
    (pageNum: number) => {
      const params: Parameters<typeof tokenUsageApi.getRecords>[0] = {
        from: dateFrom || undefined,
        to: dateTo || undefined,
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      };
      if (selectedModel) params.model = selectedModel;
      if (source !== 'all') params.source = source;
      if (selectedProject) params.project = selectedProject;
      return params;
    },
    [dateFrom, dateTo, selectedModel, source, selectedProject],
  );

  const buildSummaryParams = useCallback(() => {
    const params: Parameters<typeof tokenUsageApi.getSummary>[0] = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (selectedModel) params.model = selectedModel;
    if (source !== 'all') params.source = source;
    if (selectedProject) params.project = selectedProject;
    return params;
  }, [dateFrom, dateTo, selectedModel, source, selectedProject]);

  /* ── Fetch summary ── */
  const fetchSummary = useCallback(async () => {
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    setSummaryLoading(true);
    setError(null);

    try {
      const res = await tokenUsageApi.getSummary(buildSummaryParams());
      if (controller.signal.aborted) return;
      if (res.success && res.data) {
        setSummary(res.data);
      } else {
        setError((res as any).error ?? t('tokenUsage.errors.loadSummary'));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : t('tokenUsage.errors.loadSummary'));
    } finally {
      if (!controller.signal.aborted) setSummaryLoading(false);
    }
  }, [buildSummaryParams]);

  /* ── Fetch records ── */
  const fetchRecords = useCallback(
    async (pageNum: number) => {
      recordsAbortRef.current?.abort();
      const controller = new AbortController();
      recordsAbortRef.current = controller;

      setRecordsLoading(true);
      setError(null);

      try {
        const res = await tokenUsageApi.getRecords(buildRecordsParams(pageNum));
        if (controller.signal.aborted) return;
        if (res.success && res.data) {
          setRecords(res.data.records);
          setTotalRecords(res.data.total);
        } else {
          setError((res as any).error ?? t('tokenUsage.errors.loadRecords'));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : t('tokenUsage.errors.loadRecords'));
      } finally {
        if (!controller.signal.aborted) setRecordsLoading(false);
      }
    },
    [buildRecordsParams],
  );

  /* ── Initial fetch ── */
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSummary(), fetchRecords(0)]).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Re-fetch when filters change ── */
  useEffect(() => {
    setPage(0);
    fetchSummary();
    fetchRecords(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, selectedModel, source, selectedProject]);

  /* ── Update records when page changes (only if not already loading from filter change) ── */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      fetchRecords(newPage);
    },
    [fetchRecords],
  );

  /* ── Filter handlers ── */
  const handleModelChange = useCallback((model: string | null) => {
    setSelectedModel(model);
  }, []);

  const handleProjectChange = useCallback((projectId: string | null) => {
    setSelectedProject(projectId);
  }, []);

  const handleSourceChange = useCallback((s: 'all' | 'chat' | 'import') => {
    setSource(s);
  }, []);

  const handleProjectClick = useCallback(async (projectId: string) => {
    const proj = projects.find(p => p.projectId === projectId);
    if (proj) {
      await switchProject(proj.projectId, proj.projectName);
      setAppView('author');
    }
  }, [projects, switchProject, setAppView]);

  const handleSaveRetention = useCallback(async () => {
    setRetentionSaving(true);
    try {
      const res = await tokenUsageApi.setRetentionDays(retentionDays);
      if (res.success && res.data) {
        setRetentionDays(res.data.days);
      }
    } catch {
      // ignore
      console.debug('[TokenUsageBoard] Saving retention failed, ignoring');
    } finally {
      setRetentionSaving(false);
    }
  }, [retentionDays]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      summaryAbortRef.current?.abort();
      recordsAbortRef.current?.abort();
    };
  }, []);

  /* ── Stagger variants ── */
  const springEase: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

  const containerVariants = shouldReduce
    ? { hidden: {}, visible: {} }
    : {
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.06, delayChildren: 0.1 },
        },
      };

  const sectionVariants = shouldReduce
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: springEase },
        },
      };

  /* ── Render ── */

  const showEmptyHint =
    !loading &&
    !error &&
    summary &&
    summary.totalTokens === 0 &&
    records.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex h-screen flex-col bg-[var(--theme-bg)]">
      {/* ════════ Glass Header ════════ */}
      <header className="glass flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={shouldReduce ? undefined : { scale: 0.95 }}
            className="focus-ring flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--theme-text-dim)] transition-colors hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)]"
            title={t('tokenUsage.backToAuthorView', { ns: 'app' })}
            aria-label={t('tokenUsage.backToAuthorView', { ns: 'app' })}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">{t('buttons.back', { ns: 'common' })}</span>
          </motion.button>

          <div className="h-5 w-px bg-[var(--theme-border)]" />

          <h1 className="text-sm font-bold tracking-tight text-[var(--theme-text)]">
            {t('tokenUsage.title', { ns: 'app' })}
          </h1>
        </div>

        {/* Retention config */}
        <div className="flex items-center gap-1.5 ml-auto">
          <label className="text-[11px] text-[var(--theme-text-mute)]">{t('tokenUsage.retention.keep', { ns: 'app' })}</label>
          <input
            type="number"
            min={1}
            max={365}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Math.max(1, Math.min(365, Number(e.target.value) || 90)))}
            className="focus-ring w-14 rounded border border-[var(--theme-border)] bg-[var(--theme-surface)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--theme-text)]"
          />
          <span className="text-[11px] text-[var(--theme-text-mute)]">{t('tokenUsage.retention.days', { ns: 'app' })}</span>
          <button
            type="button"
            onClick={handleSaveRetention}
            disabled={retentionSaving}
            className="focus-ring rounded bg-[var(--theme-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--theme-text-dim)] transition-colors hover:bg-blue-600/30 hover:text-blue-300 disabled:opacity-50"
          >
            {retentionSaving ? '...' : t('tokenUsage.retention.save', { ns: 'app' })}
          </button>
        </div>
      </header>

      {/* ════════ Scrollable Content ════════ */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6">
        {error && !loading && (
          /* ── Error Banner ── */
          <motion.div
            initial={shouldReduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
          >
            <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-xs text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => {
                fetchSummary();
                fetchRecords(page);
              }}
              className="ml-auto rounded border border-red-500/30 px-2 py-1 text-[10px] text-red-300 transition-colors hover:bg-red-500/20"
            >
              {t('buttons.retry', { ns: 'common' })}
            </button>
          </motion.div>
        )}

        {/* ── Dashboard Content (always visible) ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {/* ── Filter Bar ── */}
          <motion.div variants={sectionVariants}>
            <FilterBar
              models={models}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              projects={projects}
              selectedProject={selectedProject}
              onProjectChange={handleProjectChange}
              source={source}
              onSourceChange={handleSourceChange}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
          </motion.div>

          {/* ── Empty hint (subtle, inline) ── */}
          {showEmptyHint && (
            <motion.div
              initial={shouldReduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3"
            >
              <svg className="h-4 w-4 shrink-0 text-[var(--theme-text-mute)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p className="text-xs text-[var(--theme-text-dim)]">
                {t('tokenUsage.emptyHint', { ns: 'app' })}
              </p>
            </motion.div>
          )}

          {/* ── KPI Cards ── */}
          <motion.div variants={sectionVariants}>
            <KpiCards summary={summary} loading={summaryLoading} />
          </motion.div>

          {/* ── Charts Row ── */}
          <motion.div
            variants={sectionVariants}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            <UsageOverTimeChart summary={summary} loading={summaryLoading} />
            <ModelDistributionChart summary={summary} loading={summaryLoading} />
          </motion.div>

          {/* ── Records Table ── */}
          <motion.div variants={sectionVariants}>
            <TokenTable
              records={records}
              total={totalRecords}
              loading={recordsLoading}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
              existingProjectIds={existingProjectIds.current}
              onProjectClick={handleProjectClick}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
