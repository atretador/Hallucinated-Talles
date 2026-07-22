import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { SessionCommit, CommitChange } from '../../../../shared/types';

// --- Icons (reused from CommitTimeline) ---

function ChangeIcon({ type }: { type: CommitChange['type'] }) {
  switch (type) {
    case 'create':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-900/50 text-green-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </span>
      );
    case 'edit':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-900/50 text-blue-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </span>
      );
    case 'update':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-900/50 text-blue-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </span>
      );
    case 'delete':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-900/50 text-red-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </span>
      );
  }
}

function EntityIcon({ type }: { type: CommitChange['entityType'] }) {
  switch (type) {
    case 'book':
      return (
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'page':
      return (
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'chapter':
      return (
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'character':
      return (
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'event':
      return (
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'worldData':
      return (
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'relation':
      return (
        <svg className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case 'plan':
      return (
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
  }
}

// --- Helpers ---

function hasDiffData(change: CommitChange): boolean {
  return (change.before != null && change.before.length > 0) ||
         (change.after != null && change.after.length > 0);
}

// --- Component ---

interface CommitCardProps {
  commit: SessionCommit;
  onViewChanges: (commit: SessionCommit) => void;
}

export function CommitCard({ commit, onViewChanges }: CommitCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const firstChange = commit.changes[0];
  const canViewChanges = commit.changes.some(hasDiffData);
  const changeCount = commit.changes.length;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-800/50">
      {/* Summary row — always visible */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Icons */}
        {firstChange && (
          <div className="flex shrink-0 items-center gap-1">
            <ChangeIcon type={firstChange.type} />
            <EntityIcon type={firstChange.entityType} />
          </div>
        )}

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-gray-200 truncate">{commit.message}</div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>{formatTime(commit.timestamp)}</span>
            {changeCount > 1 && (
              <span>{t('chat.commit.changes', { ns: 'app', count: changeCount })}</span>
            )}
          </div>
        </div>

        {/* View Changes button */}
        {canViewChanges && (
          <button
            onClick={() => onViewChanges(commit)}
            className="shrink-0 rounded border border-gray-600 bg-gray-700/50 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-900/20 hover:text-blue-300"
          >
{t('chat.commit.viewChanges', { ns: 'app' })}
          </button>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-700/50 hover:text-gray-300"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-700/40 px-3 py-2 space-y-1">
              {commit.changes.map((change, i) => (
                <div key={i} className="flex items-start gap-2 rounded bg-gray-900/40 px-2 py-1.5">
                  <div className="mt-0.5 flex shrink-0 gap-1">
                    <ChangeIcon type={change.type} />
                    <EntityIcon type={change.entityType} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-300">
                        {change.entityName || change.entityId}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {t(`chat.commit.changeVerbs.${change.type}`, { ns: 'app' })} {t(`chat.commit.entityTypes.${change.entityType}`, { ns: 'app' }).toLowerCase()}
                      </span>
                    </div>
                    {change.before && change.after && (
                      <div className="mt-1 text-[11px]">
                        <span className="text-red-400/60 line-through">{change.before.slice(0, 80)}{change.before.length > 80 ? '...' : ''}</span>
                        <span className="mx-1 text-gray-600">→</span>
                        <span className="text-green-400/60">{change.after.slice(0, 80)}{change.after.length > 80 ? '...' : ''}</span>
                      </div>
                    )}
                    {change.before && !change.after && (
                      <div className="mt-1 text-[11px] text-red-400/60 truncate">
                        {change.before.slice(0, 80)}{change.before.length > 80 ? '...' : ''}
                      </div>
                    )}
                    {!change.before && change.after && (
                      <div className="mt-1 text-[11px] text-green-400/60 truncate">
                        {change.after.slice(0, 80)}{change.after.length > 80 ? '...' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
