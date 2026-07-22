import { useTranslation } from 'react-i18next';
import { StreamingMessage } from './StreamingMessage';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType, ChatMessagePart, SubAgent, SubAgentRun, AgentTask } from '../../../../shared/types';

interface SubAgentStreamingProps {
  activeRuns: Map<string, SubAgentRun>;
  subAgentMessages: Map<string, ChatMessageType[]>;
  subAgentStreaming: Map<string, ChatMessagePart[]>;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  subAgentTabsExpanded: boolean;
  setSubAgentTabsExpanded: (expanded: boolean) => void;
  cancelSubAgentRun: (runId: string) => Promise<void>;
  agentTasks: AgentTask[];

  // Task input modal
  subAgentTaskInput: string;
  setSubAgentTaskInput: (value: string) => void;
  pendingRunAgentId: string | null;
  setPendingRunAgentId: (id: string | null) => void;
  selectedContext: string[];
  setSelectedContext: (updater: string[] | ((prev: string[]) => string[])) => void;
  subAgentTaskInputRef: React.RefObject<HTMLTextAreaElement | null>;
  subAgents?: SubAgent[];
  activeSessionId: string | null;
  startSubAgentRun: (subAgentId: string, task: string, sessionId: string, context?: string[], subAgents?: SubAgent[]) => Promise<void>;
}

export function SubAgentStreaming({
  activeRuns,
  subAgentMessages,
  subAgentStreaming,
  selectedTab,
  setSelectedTab,
  subAgentTabsExpanded,
  setSubAgentTabsExpanded,
  cancelSubAgentRun,
  agentTasks,

  // Task input modal
  subAgentTaskInput,
  setSubAgentTaskInput,
  pendingRunAgentId,
  setPendingRunAgentId,
  selectedContext,
  setSelectedContext,
  subAgentTaskInputRef,
  subAgents,
  activeSessionId,
  startSubAgentRun,
}: SubAgentStreamingProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* Sub-agent tabs */}
      {(activeRuns.size > 0 || subAgentMessages.size > 0) && (
        <div className="border-b border-gray-700">
          <div className="flex items-center gap-1 px-2 py-1">
            <button
              onClick={() => setSubAgentTabsExpanded(!subAgentTabsExpanded)}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            >
              <svg
                className={`h-3 w-3 transition-transform ${subAgentTabsExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {t('chat.subAgent.tabLabel', { ns: 'app' })}
            </button>
            {subAgentTabsExpanded && (
              <button
                onClick={() => setSelectedTab('main')}
                className={`rounded-t px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  selectedTab === 'main'
                    ? 'bg-gray-700 text-gray-100 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                {t('chat.subAgent.main', { ns: 'app' })}
              </button>
            )}
            {/* Collapsed badges — right side */}
            {!subAgentTabsExpanded && (
              <div className="ml-auto flex items-center gap-2">
                {(() => {
                  const runningCount = Array.from(activeRuns.values()).filter(r => r.status === 'running').length;
                  const completedCount = Array.from(activeRuns.values()).filter(r => r.status === 'completed').length;
                  const totalCount = activeRuns.size;
                  return (
                    <>
                      {runningCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(74,222,128,0.6)' }} />
                          {t('chat.subAgent.running', { ns: 'app', count: runningCount })}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">
                        {completedCount}/{totalCount}
                      </span>
                    </>
                  );
                })()}
                {agentTasks.length > 0 && (
                  <span className="text-[10px] text-gray-500" title={t('chat.subAgent.statusLabel', { ns: 'app', status: 'completed' })}>
                    {t('chat.subAgent.tasks', { ns: 'app', count: agentTasks.filter(t => t.status === 'completed').length, total: agentTasks.length })}
                  </span>
                )}
              </div>
            )}
          </div>
          {subAgentTabsExpanded && (
            <div className="flex items-center gap-0.5 px-2 pb-1 overflow-x-auto">
              {Array.from(activeRuns.entries()).map(([runId, run]) => {
                const isRunning = run.status === 'running';
                return (
                  <div
                    key={runId}
                    className="relative group shrink-0"
                  >
                    <button
                      onClick={() => setSelectedTab(runId)}
                      className={`flex items-center gap-1.5 rounded-t px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        selectedTab === runId
                          ? 'bg-gray-700 text-gray-100 border-b-2 border-orange-500'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      {isRunning && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
                      )}
                      {run.status === 'completed' && (
                        <span className="h-2 w-2 rounded-full bg-green-400" />
                      )}
                      {run.status === 'error' && (
                        <span className="h-2 w-2 rounded-full bg-red-400" />
                      )}
                      <span className="max-w-[100px] truncate">{run.agentName || run.subAgentName}</span>
                    </button>
                    {isRunning && (
                      <button
                        onClick={(e) => { e.stopPropagation(); cancelSubAgentRun(runId); }}
                        className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-600 text-gray-300 hover:bg-red-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t('buttons.cancel', { ns: 'common' })}
                      >
                        <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {/* Hover tooltip */}
                    <div className="absolute left-0 top-full z-50 hidden group-hover:block w-56 rounded border border-gray-600 bg-gray-800 p-2 shadow-lg text-[11px] text-gray-300">
                      <div className="font-medium text-gray-100 mb-1">{run.agentName || run.subAgentName}</div>
                      <div className="text-gray-400 truncate">{run.task}</div>
                      <div className="mt-1 text-gray-500">
                        {t('chat.subAgent.statusLabel', { ns: 'app', status: run.status })}
                        {run.modelUsed && <> · {run.modelUsed}</>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sub-agent content view */}
      {selectedTab !== 'main' && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            {(subAgentMessages.get(selectedTab) ?? []).map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {(() => {
              const streaming = subAgentStreaming.get(selectedTab);
              const run = activeRuns.get(selectedTab);
              if (streaming) {
                return <StreamingMessage parts={streaming} />;
              }
              if (run?.status === 'running') {
                return (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-gray-700 px-3 py-2 text-gray-100">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 animate-bounce-dot rounded-full bg-orange-400" style={{ animationDelay: '0s' }} />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce-dot rounded-full bg-orange-400" style={{ animationDelay: '0.16s' }} />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce-dot rounded-full bg-orange-400" style={{ animationDelay: '0.32s' }} />
                      </span>
                    </div>
                  </div>
                );
              }
              if (run?.status === 'error') {
                return (
                  <div className="rounded-lg bg-red-900/20 px-3 py-2 text-sm text-red-400">
                    {t('chat.subAgent.statusError', { ns: 'app', error: run.error })}
                  </div>
                );
              }
              if (run?.status === 'completed') {
                return (
                  <div className="rounded-lg bg-green-900/20 px-3 py-2 text-sm text-green-400">
                    {t('chat.subAgent.statusCompleted', { ns: 'app', model: run.modelUsed ?? '' })}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}

      {/* Sub-Agent Task Input Modal */}
      {pendingRunAgentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-4 shadow-xl"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setPendingRunAgentId(null);
                setSubAgentTaskInput('');
                setSelectedContext([]);
              }
            }}
          >
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-200">
                {t('chat.subAgent.taskModalTitle', { ns: 'app', name: subAgents?.find(a => a.id === pendingRunAgentId)?.name ?? 'sub-agent' })}
              </div>
              {(() => {
                const agent = subAgents?.find(a => a.id === pendingRunAgentId);
                if (agent?.maxStreams && agent.maxStreams > 0) {
                  return (
                    <div className="mt-1 text-[11px] text-gray-500">
                      {t('chat.subAgent.maxStreams', { ns: 'app', count: agent.maxStreams })} · {agent.defaultModel.providerId}/{agent.defaultModel.model}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <textarea
              ref={subAgentTaskInputRef}
              value={subAgentTaskInput}
              onChange={(e) => setSubAgentTaskInput(e.target.value)}
              placeholder={t('chat.subAgent.taskPlaceholder', { ns: 'app' })}
              rows={4}
              autoFocus
              className="w-full resize-none rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setPendingRunAgentId(null);
                  setSubAgentTaskInput('');
                  setSelectedContext([]);
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.stopPropagation();
                  if (subAgentTaskInput.trim() && activeSessionId) {
                    startSubAgentRun(pendingRunAgentId, subAgentTaskInput.trim(), activeSessionId, selectedContext, subAgents);
                    setPendingRunAgentId(null);
                    setSubAgentTaskInput('');
                    setSelectedContext([]);
                  }
                }
              }}
            />
            {/* Context selection */}
            <div className="mt-2">
              <div className="text-[11px] text-gray-500 mb-1.5">{t('chat.subAgent.passContext', { ns: 'app' })}</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'bookStructure', label: t('chat.subAgent.bookStructure', { ns: 'app' }) },
                  { key: 'characters', label: t('chat.subAgent.characters', { ns: 'app' }) },
                  { key: 'events', label: t('chat.subAgent.events', { ns: 'app' }) },
                  { key: 'plan', label: t('chat.subAgent.plan', { ns: 'app' }) },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedContext(prev =>
                      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
                    )}
                    className={`rounded px-2 py-1 text-[11px] transition-colors ${
                      selectedContext.includes(key)
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                        : 'bg-gray-700 text-gray-400 border border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => { setPendingRunAgentId(null); setSubAgentTaskInput(''); setSelectedContext([]); }}
                className="rounded px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              >
                {t('buttons.cancel', { ns: 'common' })}
              </button>
              <button
                onClick={() => {
                  if (subAgentTaskInput.trim() && activeSessionId) {
                    startSubAgentRun(pendingRunAgentId, subAgentTaskInput.trim(), activeSessionId, selectedContext, subAgents);
                    setPendingRunAgentId(null);
                    setSubAgentTaskInput('');
                    setSelectedContext([]);
                  }
                }}
                disabled={!subAgentTaskInput.trim()}
                className="rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 transition-colors"
              >
                {t('chat.subAgent.run', { ns: 'app' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
