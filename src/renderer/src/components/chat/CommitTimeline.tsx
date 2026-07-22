import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import type { SessionCommit, CommitChange } from '../../../../shared/types';

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

function CommitItem({ commit, onViewChanges }: { commit: SessionCommit; onViewChanges: (commit: SessionCommit) => void }) {
  const { t } = useTranslation();
  const [undoing, setUndoing] = useState(false);
  const undoChange = useAppStore((s) => (s as { undoChange?: (entityType: string, entityId: string) => Promise<unknown> }).undoChange);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const undoableChange = commit.changes.find(
    (c) => (c.entityType === 'page' || c.entityType === 'chapter') && c.before
  );

  const handleUndo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!undoableChange || undoing) return;

    const name = undoableChange.entityName || undoableChange.entityType;
    const confirmed = window.confirm(
      t('chat.commit.undoConfirm', { name, defaultValue: `Undo changes to "${name}"?` })
    );
    if (!confirmed || !undoChange) return;

    setUndoing(true);
    try {
      await undoChange(undoableChange.entityType, undoableChange.entityId);
    } catch (err) {
      console.error('Undo failed:', err);
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="group">
      <button
        onClick={() => onViewChanges(commit)}
        className="flex w-full items-start gap-2 rounded p-2 text-left transition-colors hover:bg-gray-800/50"
      >
        <div className="mt-0.5">
          {commit.changes.length > 0 && <ChangeIcon type={commit.changes[0].type} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200">{commit.message}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
            <span>{formatTime(commit.timestamp)}</span>
            {commit.changes.length > 1 && (
              <span>{t('chat.commit.changes', { count: commit.changes.length, ns: 'app' })}</span>
            )}
          </div>
        </div>
        {undoableChange && (
          <button
            onClick={handleUndo}
            disabled={undoing}
            title={t('chat.commit.undo', { defaultValue: 'Undo this change' })}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 opacity-0 transition-all hover:bg-gray-700 hover:text-amber-400 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-40"
          >
            {undoing ? (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            )}
          </button>
        )}
        <svg
          className="h-4 w-4 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
    </div>
  );
}

export function CommitTimeline({ onViewChanges }: { onViewChanges: (commit: SessionCommit) => void }) {
  const { t } = useTranslation();
  const { currentSessionData } = useAppStore();

  if (!currentSessionData || currentSessionData.commits.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        {t('chat.noCommits', { ns: 'app' })}
      </div>
    );
  }

  // Group commits by date
  const commitsByDate = new Map<string, SessionCommit[]>();
  for (const commit of currentSessionData.commits) {
    const date = new Date(commit.timestamp).toLocaleDateString();
    if (!commitsByDate.has(date)) {
      commitsByDate.set(date, []);
    }
    commitsByDate.get(date)!.push(commit);
  }

  return (
    <div className="overflow-y-auto">
      {Array.from(commitsByDate.entries()).map(([date, commits]) => (
        <div key={date}>
          <div className="sticky top-0 bg-gray-900 px-4 py-2 text-xs font-medium text-gray-500">
            {date}
          </div>
          <div className="space-y-0.5 px-2">
            {commits.map((commit) => (
              <CommitItem key={commit.id} commit={commit} onViewChanges={onViewChanges} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
