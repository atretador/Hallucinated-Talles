import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';

export function SessionListModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const {
    sessions,
    activeSessionId,
    switchSession,
    updateSession,
    deleteSession,
    archiveSession,
    forkSession,
    books,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterBookId, setFilterBookId] = useState<string>('all');

  // Build a map of bookId -> book title for display
  const bookMap = new Map(books.map(b => [b.id, b.title]));

  // Filter sessions based on selected book filter
  const filteredSessions = filterBookId === 'all'
    ? sessions
    : sessions.filter(s => s.bookId === filterBookId);

  const handleSwitch = async (id: string) => {
    await switchSession(id);
    onClose();
  };

  const handleRename = async (id: string) => {
    if (editTitle.trim()) {
      await updateSession(id, { title: editTitle.trim() });
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setConfirmDeleteId(null);
  };

  const handleFork = async (id: string) => {
    const session = sessions.find((s) => s.id === id);
    await forkSession(id, t('chat.sessionList.forkOf', { ns: 'app', title: session?.title || 'Session' }));
  };

  const handleArchive = async (id: string) => {
    await archiveSession(id);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('time.justNow', { ns: 'common' });
    if (diffMins < 60) return t('time.minutesAgo', { ns: 'common', count: diffMins });
    if (diffHours < 24) return t('time.hoursAgo', { ns: 'common', count: diffHours });
    if (diffDays < 7) return t('time.daysAgo', { ns: 'common', count: diffDays });
    return date.toLocaleDateString();
  };

  const activeSessions = filteredSessions.filter((s) => s.status === 'active');
  const archivedSessions = filteredSessions.filter((s) => s.status === 'archived');

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg rounded-lg border border-gray-700 bg-gray-800 shadow-xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-100">{t('chat.sessionList.title', { ns: 'app' })}</h2>
            {books.length > 1 && (
              <select
                value={filterBookId}
                onChange={(e) => setFilterBookId(e.target.value)}
                className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">{t('chat.sessionList.allBooks', { ns: 'app' })}</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Session list */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              {filterBookId === 'all'
                ? t('chat.sessionList.noSessions', { ns: 'app' })
                : t('chat.sessionList.noSessionsForBook', { ns: 'app' })}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active sessions */}
              {activeSessions.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium uppercase text-gray-500">{t('chat.sessionList.active', { ns: 'app' })}</div>
                  <div className="space-y-1">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`group rounded-lg border p-3 transition-colors ${
                          session.id === activeSessionId
                            ? 'border-blue-600 bg-blue-600/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 cursor-pointer" onClick={() => handleSwitch(session.id)}>
                            {editingId === session.id ? (
                              <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(session.id);
                                  if (e.key === 'Escape') {
                                    setEditingId(null);
                                    setEditTitle('');
                                  }
                                }}
                                onBlur={() => handleRename(session.id)}
                                className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                                autoFocus
                              />
                            ) : (
                              <>
                                <div className="font-medium text-gray-100">{session.title}</div>
                                <div className="mt-1 flex gap-3 text-xs text-gray-500">
                                  {session.bookId && bookMap.has(session.bookId) && (
                                    <span className="rounded bg-gray-600/50 px-1.5 py-0.5 text-gray-400">
                                      {bookMap.get(session.bookId)}
                                    </span>
                                  )}
                                  <span>{t('chat.sessionList.messages', { ns: 'app', count: session.messageCount })}</span>
                                  <span>{t('chat.sessionList.commits', { ns: 'app', count: session.commitCount })}</span>
                                  <span>{formatDate(session.updatedAt)}</span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Actions */}
                          {editingId !== session.id && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(session.id);
                                  setEditTitle(session.title);
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                                title={t('buttons.rename', { ns: 'common' })}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFork(session.id);
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                                title={t('buttons.fork', { ns: 'common' })}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleArchive(session.id);
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                                title={t('buttons.archive', { ns: 'common' })}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                              </button>
                              {confirmDeleteId === session.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(session.id);
                                    }}
                                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
                                  >
                                    {t('buttons.confirm', { ns: 'common' })}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteId(null);
                                    }}
                                    className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700"
                                  >
                                    {t('buttons.cancel', { ns: 'common' })}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(session.id);
                                  }}
                                  className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-red-400"
                                  title={t('buttons.delete', { ns: 'common' })}
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archived sessions */}
              {archivedSessions.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium uppercase text-gray-500">{t('chat.sessionList.archived', { ns: 'app' })}</div>
                  <div className="space-y-1">
                    {archivedSessions.map((session) => (
                      <div
                        key={session.id}
                        className="group rounded-lg border border-gray-700/50 p-3 opacity-60 transition-opacity hover:opacity-100"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 cursor-pointer" onClick={() => handleSwitch(session.id)}>
                            <div className="font-medium text-gray-300">{session.title}</div>
                            <div className="mt-1 flex gap-3 text-xs text-gray-500">
                              {session.bookId && bookMap.has(session.bookId) && (
                                <span className="rounded bg-gray-600/50 px-1.5 py-0.5 text-gray-400">
                                  {bookMap.get(session.bookId)}
                                </span>
                              )}
<span>{t('chat.sessionList.messages', { ns: 'app', count: session.messageCount })}</span>
                                  <span>{formatDate(session.updatedAt)}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSession(session.id, { status: 'active' });
                            }}
                            className="rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-700 hover:text-gray-200 transition-opacity"
                            title={t('buttons.unarchive', { ns: 'common' })}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
