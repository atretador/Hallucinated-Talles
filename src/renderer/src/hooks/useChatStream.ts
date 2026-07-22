import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores';
import { streamChat } from '../api/chatClient';
import { getStandardHeaders, getApiBase } from '../api/client';
import type { ChatMessage as ChatMessageType, ChatMessagePart, AiEffort, AgentTask, SubAgentRun } from '../../../shared/types';

function generateId(): string {
  return crypto.randomUUID();
}

interface UseChatStreamParams {
  effort: AiEffort;
  subAgentsEnabled: boolean;
  activeBookId: string | null;
  streamExistingRun: (runId: string) => Promise<void>;
  setActiveRuns: (updater: (prev: Map<string, SubAgentRun>) => Map<string, SubAgentRun>) => void;
  setSelectedTab: (tab: string) => void;
  toolApprovals?: Record<string, boolean>;
}

export function useChatStream({
  effort,
  subAgentsEnabled,
  activeBookId,
  streamExistingRun,
  setActiveRuns,
  setSelectedTab,
  toolApprovals,
}: UseChatStreamParams) {
  const {
    messages,
    isStreaming,
    streamingParts,
    pendingEdits,
    addMessage,
    setMessages,
    setStreaming,
    resetStreaming,
    appendStreamingContent,
    appendStreamingReasoning,
    addStreamingToolCall,
    updateStreamingToolCallResult,
    finalizeStream: storeFinalizeStream,
    addPendingEdit,
    removePendingEdit,
    addCommitToSession,
    addStreamCommit,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [chatUsage, setChatUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
    model: string;
    contextWindow: number;
  } | null>(null);
  const [chatUsageUpdating, setChatUsageUpdating] = useState(false);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Wrap finalizeStream to also persist to session
  // Uses getState() to avoid stale closure over activeSessionId (session may be
  // auto-created mid-send, but the closure still sees null)
  const finalizeStream = useCallback((message: ChatMessageType) => {
    storeFinalizeStream(message);
    const state = useAppStore.getState();
    if (state.activeSessionId) {
      state.addMessageToSession(message).catch(() => {});
    }
  }, [storeFinalizeStream]);

  // Auto-continue main agent after sub-agent completes
  // The [Sub-Agent Result] system message is already in session history.
  // We just need to trigger a new turn so the main agent reads it and continues.
  //
  // Uses a ref pattern so handleSend's callback can call it without stale closures
  const continueAfterSubAgentRef = useRef<() => void>(() => {});

  // Update the ref's implementation each render (the actual logic)
  useEffect(() => {
    continueAfterSubAgentRef.current = async () => {
      if (isStreaming) return;

      const state = useAppStore.getState();
      const sessId = state.activeSessionId;
      if (!sessId) return;

      // Get the latest messages (including the injected [Sub-Agent Result] system message)
      const latestMessages = state.currentSessionData?.messages ?? state.messages;

      setStreaming(true);
      resetStreaming();
      setChatUsageUpdating(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          'Continue',
          latestMessages,
          {
            onToken: (content) => {
              appendStreamingContent(content);
              scrollToBottom();
            },
            onThinking: (content) => {
              appendStreamingReasoning(content);
              scrollToBottom();
            },
            onToolCall: (toolCall) => {
              addStreamingToolCall({ ...toolCall });
            },
            onToolResult: ({ id, result }) => {
              updateStreamingToolCallResult(id, result);
            },
            onContentUpdated: ({ content }) => {
              window.dispatchEvent(new CustomEvent('document-content-updated', {
                detail: { content },
              }));
            },
            onPendingEdit: (pendingEdit) => {
              addPendingEdit(pendingEdit);
            },
            onCommit: (commit) => {
              addCommitToSession(commit).catch(() => {});
              addStreamCommit(commit);
              const entityTypes = new Set(commit.changes.map(c => c.entityType));
              const st = useAppStore.getState();
              if (entityTypes.has('book')) {
                st.fetchBooks().catch(() => {});
              }
              if (entityTypes.has('page') || entityTypes.has('chapter')) {
                st.fetchBook().catch(() => {});
              }
              if (entityTypes.has('character')) {
                st.fetchCharacters().catch(() => {});
              }
              if (entityTypes.has('event')) {
                st.fetchEvents().catch(() => {});
              }
              if (entityTypes.has('worldData')) {
                st.fetchWorldData().catch(() => {});
              }
              if (entityTypes.has('relation')) {
                st.fetchRelations().catch(() => {});
              }
              if (entityTypes.has('plan')) {
                st.loadPlan().catch(() => {});
              }
            },
            onStatus: (status) => {
              if (status.status === 'connecting') {
                console.log('[Chat] Auto-continue: Connecting to', status.model);
              } else if (status.status === 'connected') {
                console.log('[Chat] Auto-continue: Connected, streaming...');
              }
            },
            onUsage: (usage) => {
              setChatUsage(usage);
              setChatUsageUpdating(false);
            },
            onTaskUpdate: (tasks) => {
              setAgentTasks(tasks);
              const st = useAppStore.getState();
              if (st.activeSessionId) {
                const existingTasks = st.currentSessionData?.tasks ?? [];
                const existingMap = new Map(existingTasks.map(t => [t.id, t]));
                for (const task of tasks) {
                  const prev = existingMap.get(task.id);
                  if (!prev) {
                    st.addTask(task).catch(() => {});
                  } else if (prev.status !== task.status) {
                    st.updateTask(task.id, { status: task.status, completedAt: task.completedAt }).catch(() => {});
                  }
                }
              }
              scrollToBottom();
            },
            onSubAgentUpdate: (run) => {
              setActiveRuns(prev => new Map(prev).set(run.id, run));
              const st = useAppStore.getState();
              if (st.activeSessionId) {
                const existingRuns = st.currentSessionData?.subAgentRuns ?? [];
                const existingRun = existingRuns.find(r => r.id === run.id);
                if (!existingRun) {
                  st.addSubAgentRun(run).catch(() => {});
                } else {
                  st.updateSubAgentRun(run.id, run).catch(() => {});
                }
              }
              if (run.status === 'running') {
                setSelectedTab(run.id);
                streamExistingRun(run.id);
              }
              // When sub-agent finishes during auto-continue, refresh and recursively continue
              if (run.status === 'completed' || run.status === 'error') {
                st.refreshCurrentSession().then(() => {
                  const updated = useAppStore.getState().currentSessionData;
                  if (updated) setMessages(updated.messages);
                  // If the main agent is no longer streaming, trigger another continuation
                  // (handles chained sub-agent delegations)
                  setTimeout(() => {
                    const currentState = useAppStore.getState();
                    if (!currentState.isStreaming) {
                      continueAfterSubAgentRef.current();
                    }
                  }, 500);
                }).catch(() => {});
              }
            },
            onSkillUpdate: (skills) => {
              useAppStore.setState({ skills });
            },
            onSubAgentDefinitionUpdate: (subAgents) => {
              console.debug('[useChatStream] Sub-agent definitions updated:', subAgents.length);
            },
            onDone: (message) => {
              setChatUsageUpdating(false);
              finalizeStream(message);
              scrollToBottom();
            },
            onError: (error) => {
              setChatUsageUpdating(false);
              const errorMessage: ChatMessageType = {
                id: generateId(),
                role: 'system',
                content: `Error: ${error}`,
                timestamp: new Date().toISOString(),
              };
              finalizeStream(errorMessage);
            },
          },
          controller.signal,
          sessId,
          effort,
          subAgentsEnabled,
          undefined, // images
          undefined, // bookIdOverride
          toolApprovals,
        );
      } catch (error) {
        const errorMessage: ChatMessageType = {
          id: generateId(),
          role: 'system',
          content: `Error: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        };
        finalizeStream(errorMessage);
      } finally {
        abortRef.current = null;
      }
    };
  });

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || isStreaming) return;

    // Auto-create session if none active — capture the returned ID (closure's activeSessionId is stale)
    let sessionId = useAppStore.getState().activeSessionId;
    if (!sessionId) {
      sessionId = await useAppStore.getState().createSession((text || 'Image').slice(0, 50));
    }

    setInput('');
    const imagesToSend = [...pendingImages];
    setPendingImages([]);

    const userMessage: ChatMessageType = {
      id: generateId(),
      role: 'user',
      content: text || (imagesToSend.length > 0 ? 'Please analyze this image.' : ''),
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);

    // Save user message to session (use captured sessionId, not stale closure)
    if (sessionId) {
      useAppStore.getState().addMessageToSession(userMessage).catch(() => {});
    }

    setStreaming(true);
    resetStreaming();
    setChatUsageUpdating(true);
    // Don't clear agentTasks here — they persist until replaced by new task_update events
    scrollToBottom();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        text,
        messages,
        {
          onToken: (content) => {
            appendStreamingContent(content);
            scrollToBottom();
          },
          onThinking: (content) => {
            appendStreamingReasoning(content);
            scrollToBottom();
          },
          onToolCall: (toolCall) => {
            addStreamingToolCall({ ...toolCall });
          },
          onToolResult: ({ id, result }) => {
            updateStreamingToolCallResult(id, result);
          },
          onContentUpdated: ({ content }) => {
            window.dispatchEvent(new CustomEvent('document-content-updated', {
              detail: { content },
            }));
          },
          onPendingEdit: (pendingEdit) => {
            addPendingEdit(pendingEdit);
          },
          onCommit: (commit) => {
            // Add commit to session store
            addCommitToSession(commit).catch(() => {});

            // Also add to stream commits for inline display
            addStreamCommit(commit);

            // Refresh relevant data stores based on changed entity types
            const entityTypes = new Set(commit.changes.map(c => c.entityType));
            const state = useAppStore.getState();
            if (entityTypes.has('book')) {
              state.fetchBooks().catch(() => {});
              state.fetchBook().catch(() => {});
            }
            if (entityTypes.has('page') || entityTypes.has('chapter')) {
              state.fetchBook().catch(() => {});
            }
            if (entityTypes.has('character')) {
              state.fetchCharacters().catch(() => {});
            }
            if (entityTypes.has('event')) {
              state.fetchEvents().catch(() => {});
            }
            if (entityTypes.has('worldData')) {
              state.fetchWorldData().catch(() => {});
            }
            if (entityTypes.has('relation')) {
              state.fetchRelations().catch(() => {});
            }
            if (entityTypes.has('plan')) {
              state.loadPlan().catch(() => {});
            }
          },
          onStatus: (status) => {
            if (status.status === 'connecting') {
              console.log('[Chat] Connecting to', status.model, 'at', status.baseUrl);
            } else if (status.status === 'connected') {
              console.log('[Chat] Model server reachable, streaming...');
            } else if (status.status === 'task_verification') {
              console.log(`[Chat] Verifying ${status.taskCount} incomplete task(s)...`);
            }
          },
          onUsage: (usage) => {
            setChatUsage(usage);
            setChatUsageUpdating(false);
          },
          onTaskUpdate: (tasks) => {
            setAgentTasks(tasks);
            // Persist each task to session
            const state = useAppStore.getState();
            if (state.activeSessionId) {
              // Upsert: find which tasks are new vs updated
              const existingTasks = state.currentSessionData?.tasks ?? [];
              const existingMap = new Map(existingTasks.map(t => [t.id, t]));
              for (const task of tasks) {
                const prev = existingMap.get(task.id);
                if (!prev) {
                  state.addTask(task).catch(() => {});
                } else if (prev.status !== task.status) {
                  state.updateTask(task.id, { status: task.status, completedAt: task.completedAt }).catch(() => {});
                }
              }
            }
            scrollToBottom();
          },
          onSubAgentUpdate: (run) => {
            // Backend already created the run — just track it and stream
            setActiveRuns(prev => new Map(prev).set(run.id, run));
            // Persist to session
            const state = useAppStore.getState();
            if (state.activeSessionId) {
              const existingRuns = state.currentSessionData?.subAgentRuns ?? [];
              const existingRun = existingRuns.find(r => r.id === run.id);
              if (!existingRun) {
                state.addSubAgentRun(run).catch(() => {});
              } else {
                state.updateSubAgentRun(run.id, run).catch(() => {});
              }
            }
            if (run.status === 'running') {
              setSelectedTab(run.id);
              streamExistingRun(run.id);
            }
            // When sub-agent finishes, refresh session and auto-continue main agent
            if (run.status === 'completed' || run.status === 'error') {
              state.refreshCurrentSession().then(() => {
                const updated = useAppStore.getState().currentSessionData;
                if (updated) setMessages(updated.messages);
                // Auto-continue main agent (it will see the [Sub-Agent Result] in history)
                setTimeout(() => continueAfterSubAgentRef.current(), 500);
              }).catch(() => {});
            }
          },
          onSkillUpdate: (skills) => {
            useAppStore.setState({ skills });
          },
          onSubAgentDefinitionUpdate: (subAgents) => {
            console.debug('[useChatStream] Sub-agent definitions updated:', subAgents.length);
          },
          onDone: (message) => {
            setChatUsageUpdating(false);
            finalizeStream(message);
            scrollToBottom();
          },
          onError: (error) => {
            setChatUsageUpdating(false);
            const errorMessage: ChatMessageType = {
              id: generateId(),
              role: 'system',
              content: `Error: ${error}`,
              timestamp: new Date().toISOString(),
            };
            finalizeStream(errorMessage);
          },
        },
        controller.signal,
        sessionId || undefined,
        effort,
        subAgentsEnabled,
        imagesToSend.length > 0 ? imagesToSend : undefined,
        activeBookId || undefined,
        toolApprovals,
      );
    } catch (error) {
      const errorMessage: ChatMessageType = {
        id: generateId(),
        role: 'system',
        content: `Error: ${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      };
      finalizeStream(errorMessage);
    } finally {
      abortRef.current = null;
    }
  }, [
    input,
    isStreaming,
    messages,
    addMessage,
    setMessages,
    setStreaming,
    resetStreaming,
    appendStreamingContent,
    appendStreamingReasoning,
    addStreamingToolCall,
    updateStreamingToolCallResult,
    finalizeStream,
    addCommitToSession,
    pendingImages,
    activeBookId,
    effort,
    subAgentsEnabled,
    streamExistingRun,
    setActiveRuns,
    setSelectedTab,
    scrollToBottom,
    addPendingEdit,
    addStreamCommit,
    toolApprovals,
  ]);

  const handleCancel = useCallback(async () => {
    const partialParts = streamingParts;
    const partialContent = partialParts
      .filter((part): part is Extract<ChatMessagePart, { type: 'text' }> => part.type === 'text')
      .map(part => part.content)
      .join('');

    if (partialParts.length > 0) {
      finalizeStream({
        id: generateId(),
        role: 'assistant',
        content: partialContent,
        parts: partialParts,
        timestamp: new Date().toISOString(),
      });
    } else {
      setStreaming(false);
      resetStreaming();
    }

    abortRef.current?.abort();
    try {
      await fetch(
        `${getApiBase()}/chat/cancel`,
        { method: 'POST', headers: getStandardHeaders() },
      );
    } catch {
      // ignore cancel errors
      console.debug('[useChatStream] Cancel request failed, ignoring');
    }
  }, [streamingParts, finalizeStream, setStreaming, resetStreaming]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleAcceptEdit = useCallback(async (editId: string) => {
    try {
      const response = await fetch(`${getApiBase()}/chat/accept-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getStandardHeaders() },
        body: JSON.stringify({ editId }),
      });
      if (response.ok) {
        const result = await response.json();
        removePendingEdit(editId);
        // Notify editor to refresh with new document content
        if (result.content) {
          window.dispatchEvent(new CustomEvent('document-content-updated', {
            detail: { content: result.content },
          }));
        }
      }
    } catch (err) {
      console.error('Accept edit failed:', err);
    }
  }, [removePendingEdit]);

  const handleRejectEdit = useCallback(async (editId: string) => {
    try {
      const response = await fetch(`${getApiBase()}/chat/reject-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getStandardHeaders() },
        body: JSON.stringify({ editId }),
      });
      if (response.ok) {
        removePendingEdit(editId);
      }
    } catch (err) {
      console.error('Reject edit failed:', err);
    }
  }, [removePendingEdit]);

  return {
    input,
    setInput,
    pendingImages,
    setPendingImages,
    isStreaming,
    streamingParts,
    pendingEdits,
    chatUsage,
    chatUsageUpdating,
    agentTasks,
    setAgentTasks,
    messagesEndRef,
    handleSend,
    handleCancel,
    handleKeyDown,
    handleAcceptEdit,
    handleRejectEdit,
    scrollToBottom,
    finalizeStream,
    continueAfterSubAgentRef,
  };
}
