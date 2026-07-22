import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import type { TokenUsageRecord } from '../../../../shared/types';

/* ── Props ── */

interface TokenTableProps {
  records: TokenUsageRecord[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  existingProjectIds: Set<string>;
  onProjectClick: (projectId: string) => void;
}

/* ── Helpers ── */

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceBadgeStyle(source: string): string {
  switch (source) {
    case 'chat':
      return 'border-blue-500/30 text-blue-400 bg-blue-500/10';
    case 'import':
      return 'border-green-500/30 text-green-400 bg-green-500/10';
    default:
      return 'border-gray-500/30 text-gray-400 bg-gray-500/10';
  }
}

/* ── Component ── */

export function TokenTable({
  records,
  total,
  loading,
  page,
  pageSize,
  onPageChange,
  existingProjectIds,
  onProjectClick,
}: TokenTableProps) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();

  const sourceLabel = (source: string) => {
    const key = `tokenUsage.table.source.${source}`;
    return t(key) !== key ? t(key) : source;
  };
  const shouldReduce = prefersReduced ?? true;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [sortKey, setSortKey] = useState<'timestamp' | 'totalTokens'>('timestamp');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const handleSort = (key: 'timestamp' | 'totalTokens') => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1;
    if (sortKey === 'timestamp') {
      return mul * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return mul * (a.totalTokens - b.totalTokens);
  });

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="card-elevated-lg rounded-xl p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-dim)]">
          {t('tokenUsage.table.recentRecords', { ns: 'app' })}
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-700" />
              <div className="h-3 w-24 animate-pulse rounded bg-gray-700" />
              <div className="h-3 w-16 animate-pulse rounded bg-gray-700" />
              <div className="ml-auto h-3 w-12 animate-pulse rounded bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated-lg rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-dim)]">
          {t('tokenUsage.table.recentRecords', { ns: 'app' })}
        </h3>
        <span className="text-[10px] text-[var(--theme-text-mute)]">
          {t('tokenUsage.table.total', { count: total, ns: 'app' })}
        </span>
      </div>

      {records.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center">
          <p className="text-xs text-[var(--theme-text-mute)]">{t('tokenUsage.table.noRecords', { ns: 'app' })}</p>
        </div>
      ) : (
        <>
          {/* ── Table ── */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--theme-border)] text-[10px] uppercase tracking-wider text-[var(--theme-text-mute)]">
                  <th className="pb-2 pr-3 font-medium">{t('tokenUsage.table.time', { ns: 'app' })}</th>
                  <th className="pb-2 pr-3 font-medium">{t('tokenUsage.table.model', { ns: 'app' })}</th>
                  <th className="pb-2 pr-3 font-medium">{t('tokenUsage.table.source', { ns: 'app' })}</th>
                  <th className="pb-2 pr-3 font-medium">{t('tokenUsage.table.project', { ns: 'app' })}</th>
                  <th
                    className="cursor-pointer pb-2 pr-3 font-medium transition-colors hover:text-[var(--theme-text-dim)] select-none"
                    onClick={() => handleSort('totalTokens')}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {t('tokenUsage.table.tokens', { ns: 'app' })}
                      {sortKey === 'totalTokens' && (
                        <svg className={`h-2.5 w-2.5 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                  </th>
                  <th className="pb-2 pr-3 font-medium text-right">{t('tokenUsage.table.cached', { ns: 'app' })}</th>
                  <th className="pb-2 pr-3 font-medium text-right">{t('tokenUsage.table.duration', { ns: 'app' })}</th>
                </tr>
              </thead>
              <motion.tbody
                initial={shouldReduce ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {sortedRecords.map((rec, i) => (
                  <motion.tr
                    key={rec.id}
                    initial={shouldReduce ? undefined : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="border-b border-[var(--theme-border)]/50 transition-colors hover:bg-[var(--theme-surface-2)]/50"
                  >
                    <td className="py-2 pr-3 text-[var(--theme-text-dim)] whitespace-nowrap">
                      {formatTimestamp(rec.timestamp)}
                    </td>
                    <td className="py-2 pr-3 text-[var(--theme-text)] max-w-[140px] truncate" title={rec.model}>
                      {rec.model}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${sourceBadgeStyle(rec.source)}`}>
                        {sourceLabel(rec.source)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[var(--theme-text-dim)] max-w-[140px]">
                      {rec.projectId ? (
                        existingProjectIds.has(rec.projectId) ? (
                          <button
                            type="button"
                            onClick={() => onProjectClick(rec.projectId!)}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[140px] block transition-colors"
                            title={t('tokenUsage.table.goToProject', { name: rec.projectName ?? rec.projectId, ns: 'app' })}
                          >
                            {rec.projectName ?? rec.projectId}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--theme-text-mute)]" title={t('tokenUsage.table.projectDeleted', { ns: 'app' })}>
                            <svg className="h-3 w-3 shrink-0 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="truncate max-w-[100px]">{rec.projectName ?? rec.projectId}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-[var(--theme-text-mute)]">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-medium tabular-nums text-[var(--theme-text)]">
                      {formatNumber(rec.totalTokens)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--theme-text-dim)]">
                      {rec.cachedTokens > 0 ? formatNumber(rec.cachedTokens) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--theme-text-dim)] whitespace-nowrap">
                      {formatDuration(rec.durationMs)}
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-[var(--theme-border)]/50 pt-3">
              <span className="text-[10px] text-[var(--theme-text-mute)]">
                {t('tokenUsage.table.page', { current: page + 1, total: totalPages, ns: 'app' })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => onPageChange(page - 1)}
                  className="rounded px-2 py-1 text-xs text-[var(--theme-text-dim)] transition-colors hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)] disabled:opacity-30 disabled:pointer-events-none"
                >
                  {t('tokenUsage.table.previous', { ns: 'app' })}
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i;
                  } else if (page < 2) {
                    pageNum = i;
                  } else if (page > totalPages - 3) {
                    pageNum = totalPages - 5 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => onPageChange(pageNum)}
                      className={`rounded px-2 py-1 text-xs transition-colors ${
                        pageNum === page
                          ? 'bg-blue-600 text-white'
                          : 'text-[var(--theme-text-dim)] hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)]'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => onPageChange(page + 1)}
                  className="rounded px-2 py-1 text-xs text-[var(--theme-text-dim)] transition-colors hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)] disabled:opacity-30 disabled:pointer-events-none"
                >
                  {t('tokenUsage.table.next', { ns: 'app' })}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
