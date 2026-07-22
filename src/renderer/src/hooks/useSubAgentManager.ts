import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores';
import { subAgentApi } from '../api/client';
import { streamSubAgent } from '../api/chatClient';
import type { ChatMessage as ChatMessageType, ChatMessagePart, SubAgent, SubAgentRun } from '../../../shared/types';
import { appendTextPart, appendToolPart, updateToolPart } from '../components/chat/StreamingMessage';

export function useSubAgentManager() {
  const [activeRuns, setActiveRuns] = useState<Map<string, SubAgentRun>>(new Map());
  const [selectedTab, setSelectedTab] = useState<string>('main');
  const [subAgentMessages, setSubAgentMessages] = useState<Map<string, ChatMessageType[]>>(new Map());
  const [subAgentStreaming, setSubAgentStreaming] = useState<Map<string, ChatMessagePart[]>>(new Map());
  const [subAgentTabsExpanded, setSubAgentTabsExpanded] = useState(false);

  // Sub-agent task input modal state
  const [subAgentTaskInput, setSubAgentTaskInput] = useState('');
  const [pendingRunAgentId, setPendingRunAgentId] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string[]>([]);
  const subAgentTaskInputRef = useRef<HTMLTextAreaElement>(null);

  const subAgentAbortRefs = useRef<Map<string, AbortController>>(new Map());

  // Focus textarea when task input modal opens
  useEffect(() => {
    if (pendingRunAgentId) {
      requestAnimationFrame(() => {
        subAgentTaskInputRef.current?.focus();
      });
    }
  }, [pendingRunAgentId]);

  // Stream an existing sub-agent run (called after backend creates the run)
  const streamExistingRun = useCallback(async (runId: string) => {
    const controller = new AbortController();
    subAgentAbortRefs.current.set(runId, controller);

    try {
      await streamSubAgent(runId, {
        onToken: (content) => {
          setSubAgentStreaming(prev => {
            const next = new Map(prev);
            const current = next.get(runId) ?? [];
            next.set(runId, appendTextPart(current, 'text', content));
            return next;
          });
        },
        onThinking: (content) => {
          setSubAgentStreaming(prev => {
            const next = new Map(prev);
            const current = next.get(runId) ?? [];
            next.set(runId, appendTextPart(current, 'thinking', content));
            return next;
          });
        },
        onToolCall: (toolCall) => {
          setSubAgentStreaming(prev => {
            const next = new Map(prev);
            const current = next.get(runId) ?? [];
            next.set(runId, appendToolPart(current, { ...toolCall }));
            return next;
          });
        },
        onToolResult: ({ id, result }) => {
          setSubAgentStreaming(prev => {
            const next = new Map(prev);
            const current = next.get(runId) ?? [];
            next.set(runId, updateToolPart(current, id, result));
            return next;
          });
        },
        onStatus: () => {},
        onDone: (result) => {
          // Finalize: move streaming content to messages
          setSubAgentStreaming(prev => {
            const next = new Map(prev);
            const streaming = next.get(runId);
            if (streaming) {
              const content = streaming
                .filter((part): part is Extract<ChatMessagePart, { type: 'text' }> => part.type === 'text')
                .map(part => part.content)
                .join('') || result.result || '';
              const assistantMsg: ChatMessageType = {
                id: `sa-msg-${crypto.randomUUID()}`,
                role: 'assistant',
                content,
                parts: streaming.length > 0 ? streaming : undefined,
                timestamp: new Date().toISOString(),
              };
              setSubAgentMessages(prev2 => {
                const next2 = new Map(prev2);
                const msgs = next2.get(runId) ?? [];
                next2.set(runId, [...msgs, assistantMsg]);
                return next2;
              });
            }
            next.delete(runId);
            return next;
          });

          const updates = {
            status: result.error ? 'error' as const : 'completed' as const,
            result: result.result,
            error: result.error,
            modelUsed: result.modelUsed,
            completedAt: new Date().toISOString(),
          };

          setActiveRuns(prev => {
            const next = new Map(prev);
            const run = next.get(runId);
            if (run) {
              next.set(runId, { ...run, ...updates });
            }
            return next;
          });

          // Persist completion to session
          const state = useAppStore.getState();
          if (state.activeSessionId) {
            state.updateSubAgentRun(runId, updates).catch(() => {});
            // Refresh session to pick up injected result message
            state.refreshCurrentSession().then(() => {
              const updated = useAppStore.getState().currentSessionData;
              if (updated) state.setMessages(updated.messages);
            }).catch(() => {});
            // Refresh all data stores since sub-agent may have modified any of them
            state.fetchBook().catch(() => {});
            state.fetchCharacters().catch(() => {});
            state.fetchEvents().catch(() => {});
            state.fetchWorldData().catch(() => {});
          }
        },
        onError: (error) => {
          const updates = { status: 'error' as const, error, completedAt: new Date().toISOString() };
          setActiveRuns(prev => {
            const next = new Map(prev);
            const run = next.get(runId);
            if (run) {
              next.set(runId, { ...run, ...updates });
            }
            return next;
          });
          setSubAgentStreaming(prev => {
            const next = new Map(prev);
            next.delete(runId);
            return next;
          });
          // Persist error to session
          const state = useAppStore.getState();
          if (state.activeSessionId) {
            state.updateSubAgentRun(runId, updates).catch(() => {});
            // Refresh session to pick up injected error message
            state.refreshCurrentSession().then(() => {
              const updated = useAppStore.getState().currentSessionData;
              if (updated) state.setMessages(updated.messages);
            }).catch(() => {});
          }
        },
      }, controller.signal);
    } catch {
      // Abort or error
      console.debug('[useSubAgentManager] Sub-agent stream aborted or errored');
    } finally {
      subAgentAbortRefs.current.delete(runId);
    }
  }, []);

  // Start a sub-agent run from UI (calls delegate API, then streams)
  const startSubAgentRun = useCallback(async (subAgentId: string, task: string, sessionId: string, context?: string[], subAgents?: SubAgent[]) => {
    const agents = subAgents ?? [];
    const agent = agents.find(a => a.id === subAgentId);
    if (!agent) return;

    let runId: string;
    try {
      const res = await subAgentApi.delegate(subAgentId, task, sessionId, agent.name, context);
      if (!res.success || !res.data) return;
      runId = res.data.runId;
    } catch {
      return;
    }

    const run: SubAgentRun = {
      id: runId,
      subAgentId,
      subAgentName: agent.name,
      sessionId,
      task,
      status: 'running',
      messages: [],
      startedAt: new Date().toISOString(),
    };

    setActiveRuns(prev => new Map(prev).set(runId, run));
    setSubAgentMessages(prev => new Map(prev).set(runId, []));
    setSelectedTab(runId);

    // Persist the new run to session
    const state = useAppStore.getState();
    if (state.activeSessionId) {
      state.addSubAgentRun(run).catch(() => {});
    }

    // Add initial system message
    const systemMsg: ChatMessageType = {
      id: `sa-msg-${crypto.randomUUID()}`,
      role: 'system',
      content: `Sub-agent "${agent.name}" started: ${task}`,
      timestamp: new Date().toISOString(),
    };
    setSubAgentMessages(prev => {
      const next = new Map(prev);
      next.set(runId, [systemMsg]);
      return next;
    });

    // Stream the sub-agent run
    await streamExistingRun(runId);
  }, [streamExistingRun]);

  const cancelSubAgentRun = useCallback(async (runId: string) => {
    // Cancel on backend
    try {
      await subAgentApi.cancel(runId);
    } catch {
      // Non-fatal — backend may have already finished
      console.debug('[useSubAgentManager] Cancel request failed, backend may have already finished');
    }
    // Cancel frontend stream
    subAgentAbortRefs.current.get(runId)?.abort();
    subAgentAbortRefs.current.delete(runId);
  }, []);

  return {
    activeRuns,
    setActiveRuns,
    selectedTab,
    setSelectedTab,
    subAgentMessages,
    setSubAgentMessages,
    subAgentStreaming,
    setSubAgentStreaming,
    subAgentTabsExpanded,
    setSubAgentTabsExpanded,
    subAgentTaskInput,
    setSubAgentTaskInput,
    pendingRunAgentId,
    setPendingRunAgentId,
    selectedContext,
    setSelectedContext,
    subAgentTaskInputRef,
    subAgentAbortRefs,
    streamExistingRun,
    startSubAgentRun,
    cancelSubAgentRun,
  };
}
