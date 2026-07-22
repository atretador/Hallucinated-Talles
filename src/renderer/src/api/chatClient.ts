import type { ChatMessage, PendingEdit, SessionCommit, AiEffort, AgentTask, SubAgentRun, WritingSkill } from '../../../shared/types';

export interface ChatStreamCallbacks {
  onToken: (content: string) => void;
  onThinking: (content: string) => void;
  onToolCall: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void;
  onToolResult: (result: { id: string; result: unknown }) => void;
  onPendingEdit?: (pendingEdit: PendingEdit) => void;
  onContentUpdated?: (data: { content: string }) => void;
  onCommit?: (commit: SessionCommit) => void;
  onStatus?: (status: { status: string; model?: string; baseUrl?: string; taskCount?: number }) => void;
  onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens: number; model: string; contextWindow: number }) => void;
  onTaskUpdate?: (tasks: AgentTask[]) => void;
  onSubAgentUpdate?: (run: SubAgentRun) => void;
  onSkillUpdate?: (skills: WritingSkill[]) => void;
  onSubAgentDefinitionUpdate?: (subAgents: unknown[]) => void;
  onDone: (message: ChatMessage) => void;
  onError: (error: string) => void;
}

export async function streamChat(
  message: string,
  history: ChatMessage[],
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal,
  sessionId?: string,
  effort?: AiEffort,
  subAgentsEnabled?: boolean,
  images?: string[],
  bookIdOverride?: string,
  toolApprovals?: Record<string, boolean>,
  source?: string,  // 'chat' | 'editor-inline'
): Promise<void> {
  let doneCalled = false;
  const wrappedOnDone = (msg: ChatMessage) => {
    doneCalled = true;
    callbacks.onDone(msg);
  };
  const wrappedOnError = (err: string) => {
    doneCalled = true;
    callbacks.onError(err);
  };

  try {
    const API_BASE = `http://localhost:${window.electron?.getApiPort() ?? '3000'}/api`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Send active project ID for multi-project support
    const projectId = (window as unknown as Record<string, unknown>).__activeProjectId as string;
    if (projectId && projectId !== 'default') {
      headers['x-project-id'] = projectId;
    }

    // Send active book ID for multi-book support
    const bookId = bookIdOverride || (window as unknown as Record<string, unknown>).__activeBookId as string;
    if (bookId) {
      headers['x-book-id'] = bookId;
    }

    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, history, sessionId, effort, subAgentsEnabled, images, bookId: bookId || undefined, toolApprovals: toolApprovals || {}, source: source || undefined }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      wrappedOnError(error.error || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      wrappedOnError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            switch (currentEvent) {
              case 'token':
                callbacks.onToken(parsed.content);
                break;
              case 'thinking':
                callbacks.onThinking(parsed.content);
                break;
              case 'tool_call':
                callbacks.onToolCall(parsed);
                break;
              case 'tool_result':
                callbacks.onToolResult(parsed);
                break;
              case 'pending_edit':
                callbacks.onPendingEdit?.(parsed.pendingEdit);
                break;
              case 'content_updated':
                try { callbacks.onContentUpdated?.(parsed); } catch {}
                break;
              case 'commit':
                callbacks.onCommit?.(parsed);
                break;
              case 'status':
                callbacks.onStatus?.(parsed);
                break;
              case 'usage':
                callbacks.onUsage?.(parsed);
                break;
              case 'task_update':
                callbacks.onTaskUpdate?.(parsed.tasks);
                break;
              case 'sub_agent_update':
                callbacks.onSubAgentUpdate?.(parsed.run);
                break;
              case 'skill_update':
                callbacks.onSkillUpdate?.(parsed.skills);
                break;
              case 'sub_agent_definition_update':
                callbacks.onSubAgentDefinitionUpdate?.(parsed.subAgents);
                break;
              case 'done':
                wrappedOnDone(parsed.message);
                break;
              case 'error':
                wrappedOnError(parsed.error);
                break;
            }
          } catch {
            console.debug('[chatClient] Skipping malformed JSON');
            // skip malformed JSON
          }
          currentEvent = '';
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    console.error('[streamChat Error]', {
      name: err.name,
      message: err.message,
      cause: (err as any).cause?.message,
      code: (err as any).code,
      isAbort: err.name === 'AbortError',
    });
    if (err.name === 'AbortError') {
      // User cancelled — don't call onError, let finally unstick the UI
    } else {
      wrappedOnError(err.message || 'Unknown error in streamChat');
    }
  } finally {
    if (!doneCalled && !signal?.aborted) {
      callbacks.onDone({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export interface SubAgentStreamCallbacks {
  onToken: (content: string) => void;
  onThinking: (content: string) => void;
  onToolCall: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void;
  onToolResult: (result: { id: string; result: unknown }) => void;
  onStatus: (status: { status: string; model?: string }) => void;
  onDone: (result: { result?: string; error?: string; modelUsed?: string }) => void;
  onError: (error: string) => void;
}

export async function streamSubAgent(
  runId: string,
  callbacks: SubAgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let doneCalled = false;
  const wrappedOnDone: SubAgentStreamCallbacks['onDone'] = (result) => {
    doneCalled = true;
    callbacks.onDone(result);
  };
  const wrappedOnError = (err: string) => {
    doneCalled = true;
    callbacks.onError(err);
  };

  try {
    const API_BASE = `http://localhost:${window.electron?.getApiPort() ?? '3000'}/api`;
    const headers: Record<string, string> = {};
    const projectId = (window as unknown as Record<string, unknown>).__activeProjectId as string;
    if (projectId && projectId !== 'default') {
      headers['x-project-id'] = projectId;
    }
    const bookId = (window as unknown as Record<string, unknown>).__activeBookId as string;
    if (bookId) {
      headers['x-book-id'] = bookId;
    }

    const response = await fetch(`${API_BASE}/sub-agents/runs/${runId}/stream`, {
      method: 'GET',
      headers,
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      wrappedOnError(error.error || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      wrappedOnError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            switch (currentEvent) {
              case 'token':
                callbacks.onToken(parsed.content);
                break;
              case 'thinking':
                callbacks.onThinking(parsed.content);
                break;
              case 'tool_call':
                callbacks.onToolCall(parsed);
                break;
              case 'tool_result':
                callbacks.onToolResult(parsed);
                break;
              case 'status':
                callbacks.onStatus?.(parsed);
                break;
              case 'done':
                wrappedOnDone(parsed);
                break;
              case 'error':
                wrappedOnError(parsed.error);
                break;
            }
          } catch {
            console.debug('[chatClient] Skipping malformed JSON');
            // skip malformed JSON
          }
          currentEvent = '';
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      // User cancelled
    } else {
      wrappedOnError(err.message || 'Unknown error in streamSubAgent');
    }
  } finally {
    if (!doneCalled) {
      wrappedOnDone({});
    }
  }
}
