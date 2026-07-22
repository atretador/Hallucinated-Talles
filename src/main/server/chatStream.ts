import type { Request, Response } from 'express';
import type { AiService } from '../services/aiService';
import { FileService } from '../services/fileService';
import { tokenUsageService } from './serverState';
import { mcpClientManager } from './serverState';
import { activeChatControllers } from './serverState';
import { buildSystemPrompt } from './systemPrompt';
import { toOpenAIMessage, resolveProjectTitle } from './utils';
import { getActiveMcpServerIds } from '../services/settings';
import { mergeTools } from '../mcp/toolMerger';
import { toolDefinitions } from '../services/toolDefinitions';
import { setMcpToolCaller, executeToolCall } from '../services/toolExecutor';

import { getContextWindow } from '../utils/contextWindows';
import { extractReasoningDelta } from '../utils/reasoningDelta';
import { generateId, generateCommitId } from '../utils/idGenerator';
import type {
  ChatMessage, ChatMessagePart, AiEffort, AgentTask,
} from '../../shared/types';
import { CHAT_TOOL_HANDLERS, handlePendingEdit } from '../services/chatToolHandlers.js';
import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources/chat/completions';

// Tools that support the pending-edit approval flow
const PENDING_EDIT_TOOLS = new Set([
  'editContent', 'appendToContent', 'editRange',
  'insertChapter', 'deleteChapter',
  'addCharacter', 'editCharacter', 'deleteCharacter',
  'addEvent', 'editEvent', 'deleteEvent',
  'addWorldData', 'editWorldData', 'deleteWorldData',
  'createBook', 'addRelation', 'editRelation', 'deleteRelation',
]);

/**
 * SSE streaming endpoint for /api/chat.
 * Processes a user message with tool-calling loop, emits SSE events for tokens, thinking, tool calls, usage, and final done.
 */
export async function handleChatStream(
  req: Request,
  res: Response,
  aiService: AiService,
): Promise<void> {
  if (!aiService.isConfigured()) {
    res.status(400).json({ success: false, error: 'AI service is not configured' });
    return;
  }

  const { message, history, effort, subAgentsEnabled, images, bookId: bodyBookId, source } = req.body as { message: string; history: ChatMessage[]; effort?: AiEffort; subAgentsEnabled?: boolean; images?: string[]; bookId?: string; source?: string };
  const effectiveBookId = req.bookId || bodyBookId || undefined;
  const abortController = new AbortController();
  const chatRequestId = generateId('chat');
  activeChatControllers.set(chatRequestId, abortController);

  // Use res.on('close') — fires when the SOCKET closes (client disconnects),
  // NOT req.on('close') which fires when the request body is fully received.
  const onSocketClose = () => {
    console.log('[Chat] Socket closed (client disconnected)', {
      signalAborted: abortController.signal.aborted,
      resDestroyed: res.destroyed,
    });
    abortController.abort();
  };
  res.on('close', onSocketClose);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering if proxied
  });

  // Send SSE keepalive pings every 15s to prevent connection timeout
  const keepAliveInterval = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch { console.debug('[chatStream] Connection closed'); /* connection closed */ }
  }, 15000);
  const clearKeepAlive = () => clearInterval(keepAliveInterval);
  res.on('close', clearKeepAlive);

  // Build user message with optional images for vision support
  const userMessage: ChatCompletionMessageParam = images && images.length > 0
    ? {
        role: 'user',
        content: [
          { type: 'text' as const, text: message },
          ...images.map(img => ({
            type: 'image_url' as const,
            image_url: { url: img, detail: 'auto' as const },
          })),
        ],
      }
    : { role: 'user', content: message };

  const effectiveHistory = source === 'editor-inline' ? [] : history;

  const openaiMessages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: await buildSystemPrompt(req.projectId, effectiveBookId),
    },
    ...effectiveHistory.map(msg => toOpenAIMessage(msg)),
    userMessage,
  ];

  const fileService = new FileService(req.projectId, effectiveBookId);
  let accumulatedContent = '';
  let accumulatedReasoning = '';
  const orderedParts: ChatMessagePart[] = [];
  const appendOrderedTextPart = (type: 'text' | 'thinking', content: string) => {
    const last = orderedParts[orderedParts.length - 1];
    if (last?.type === type) {
      orderedParts[orderedParts.length - 1] = { ...last, content: last.content + content };
    } else {
      orderedParts.push({ type, content });
    }
  };
  let iterations = 0;
  const maxIterations = 50; // Increased for long-running task queue
  const chatStartTime = Date.now();
  const iterationUsages: NonNullable<ChatCompletionChunk['usage']>[] = [];

  // Agent task queue (for long-running autonomous work)
  const agentTasks: AgentTask[] = [];
  const taskCounter = { value: 0 };

  // Pre-flight: verify model server is reachable before streaming
  const config = aiService.getConfig();
  console.log('[Chat] Pre-flight check', {
    model: config?.model,
    baseUrl: config?.baseUrl,
  });
  res.write(`event: status\ndata: ${JSON.stringify({ status: 'connecting', model: config?.model, baseUrl: config?.baseUrl })}\n\n`);

  const probe = await aiService.checkConnection();
  if (!probe.ok) {
    console.error('[Chat] Connection probe failed:', probe.error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: probe.error })}\n\n`);
    res.end();
    return;
  }
  res.write(`event: status\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

  let pendingEditNudgeGiven = false;

  try {
    while (iterations < maxIterations) {
      iterations++;
      const toolCallsAcc = new Map<
        number,
        { id: string; name: string; args: string }
      >();
      let content = '';

      const config = aiService.getConfig();
      const activeMcpIds = new Set(getActiveMcpServerIds());
      const externalMcpTools = mcpClientManager.getAllTools(activeMcpIds);
      const { tools: mergedToolsRaw, lookup: mcpLookup } = mergeTools(toolDefinitions, externalMcpTools);
      // Filter delegation tools when sub-agents are disabled
      const subAgentToolNames = new Set(['delegateToSubAgent', 'listSubAgents', 'getSubAgentResult', 'awaitSubAgentResult']);
      const mergedTools = subAgentsEnabled === false
        ? mergedToolsRaw.filter(t => 'function' in t && !subAgentToolNames.has(t.function.name))
        : mergedToolsRaw;
      setMcpToolCaller((name, args) => mcpClientManager.callTool(name, args), mcpLookup);
      console.log('[Chat] Starting stream', {
        model: config?.model,
        baseUrl: config?.baseUrl,
        messageCount: openaiMessages.length,
        toolCount: mergedTools.length,
        effort,
        iteration: iterations,
      });
      const stream = aiService.chatStream(
        openaiMessages,
        mergedTools,
        abortController.signal,
        effort,
      );

      console.log('[Chat] Signal state before for-await:', { aborted: abortController.signal.aborted });

      // First-chunk timeout: if no chunk arrives in time, the model server is stuck
      const firstChunkTimeoutSec = aiService.getSettings().firstChunkTimeoutSec ?? 300;
      let firstChunkReceived = false;
      const firstChunkTimeout = setTimeout(() => {
        if (!firstChunkReceived && !abortController.signal.aborted) {
          console.error(`[Chat] No chunks received in ${firstChunkTimeoutSec}s — model server may be stuck`);
          res.write(`event: error\ndata: ${JSON.stringify({ error: `Model server is not responding (${firstChunkTimeoutSec}s timeout). Check that the model server is running and the model name is correct.` })}\n\n`);
          abortController.abort();
        } else if (abortController.signal.aborted) {
          console.log(`[Chat] ${firstChunkTimeoutSec}s timeout fired but signal already aborted (client disconnected)`);
        }
      }, firstChunkTimeoutSec * 1000);

      let iterationUsage: ChatCompletionChunk['usage'] | null = null;

      try {
        for await (const chunk of stream) {
          firstChunkReceived = true;
          clearTimeout(firstChunkTimeout);
          const delta = chunk.choices[0]?.delta;

          // Reasoning/thinking content (DeepSeek R1, QwQ, llama.cpp, vLLM, OpenRouter)
          const reasoningDelta = extractReasoningDelta(delta) ?? null;
          if (reasoningDelta) {
            accumulatedReasoning += reasoningDelta;
            appendOrderedTextPart('thinking', reasoningDelta);
            res.write(
              `event: thinking\ndata: ${JSON.stringify({ content: reasoningDelta })}\n\n`,
            );
          }

          if (delta?.content) {
            content += delta.content;
            accumulatedContent += delta.content;
            appendOrderedTextPart('text', delta.content);
            res.write(
              `event: token\ndata: ${JSON.stringify({ content: delta.content })}\n\n`,
            );
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsAcc.has(idx)) {
                toolCallsAcc.set(idx, { id: '', name: '', args: '' });
              }
              const existing = toolCallsAcc.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.args += tc.function.arguments;
            }
          }

          if (chunk.usage) {
            iterationUsage = chunk.usage;
          }
        }
      } finally {
        clearTimeout(firstChunkTimeout);
      }

      if (iterationUsage) {
        iterationUsages.push(iterationUsage);
      }

      // No tool calls — we are done streaming
      if (toolCallsAcc.size === 0) {
        // Continuation nudge after pending edit — ask LLM to describe what it changed
        if (!pendingEditNudgeGiven && iterations < maxIterations - 1) {
          const lastMsg = openaiMessages[openaiMessages.length - 1];
          if (lastMsg?.role === 'tool') {
            try {
              const lastResult = JSON.parse(lastMsg.content as string);
              if (lastResult.pending === true) {
                pendingEditNudgeGiven = true;
                openaiMessages.push({
                  role: 'user',
                  content: 'The edit has been sent to the user for approval. Please briefly describe what you changed and why in a short message.',
                });
                continue;
              }
            } catch { /* not JSON */ }
          }
        }

        // Task completion guard: if there are incomplete tasks, ask the agent to verify
        const incompleteTasks = agentTasks.filter(t => t.status === 'pending');
        if (incompleteTasks.length > 0 && iterations < maxIterations - 1) {
          const taskList = incompleteTasks
            .map(t => `- "${t.displayName}" (id: ${t.id})`)
            .join('\n');
          const verifyMsg = `You have ${incompleteTasks.length} incomplete task(s) remaining:\n${taskList}\n\nPlease check: are these tasks actually done? If so, mark them complete. If not, continue working on them or explain what's left.`;
          openaiMessages.push({ role: 'user', content: verifyMsg });
          res.write(`event: status\ndata: ${JSON.stringify({ status: 'task_verification', taskCount: incompleteTasks.length })}\n\n`);
          continue; // Go back to the top of the while loop
        }
        break;
      }

      // Build assistant message with tool calls for the API
      openaiMessages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: Array.from(toolCallsAcc.entries()).map(([, call]) => ({
          id: call.id,
          type: 'function' as const,
          function: {
            name: call.name,
            arguments: call.args,
          },
        })),
      });

      // Execute each tool call
      for (const [, tc] of toolCallsAcc) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.args);
        } catch {
          args = {};
        }
        if (effectiveBookId && typeof args.bookId !== 'string') {
          args.bookId = effectiveBookId;
        }

        res.write(
          `event: tool_call\ndata: ${JSON.stringify({ id: tc.id, name: tc.name, args })}\n\n`,
        );
        orderedParts.push({ type: 'tool_call', toolCall: { id: tc.id, name: tc.name, args } });

        let result: unknown;

        const toolApprovals = (req.body.toolApprovals ?? {}) as Record<string, boolean>;
        const needsApproval = toolApprovals[tc.name] === true;

        if (needsApproval && PENDING_EDIT_TOOLS.has(tc.name)) {
          // Route through generic pending edit handler
          result = await handlePendingEdit({
            toolCallId: tc.id,
            toolName: tc.name,
            args,
            emit: (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            projectId: req.projectId,
            sessionId: req.body.sessionId,
            bookId: effectiveBookId,
            agentTasks,
            taskCounter,
            fileService,
            aiService,
            externalMcpTools,
            mcpToolCaller: (name, mcpArgs) => mcpClientManager.callTool(name, mcpArgs),
          });
        } else if (CHAT_TOOL_HANDLERS[tc.name]) {
          result = await CHAT_TOOL_HANDLERS[tc.name]({
            toolCallId: tc.id,
            toolName: tc.name,
            args,
            emit: (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            projectId: req.projectId,
            sessionId: req.body.sessionId,
            bookId: effectiveBookId,
            agentTasks,
            taskCounter,
            fileService,
            aiService,
            externalMcpTools,
            mcpToolCaller: (name, mcpArgs) => mcpClientManager.callTool(name, mcpArgs),
          });
        } else {
          // Existing toolExecutor path for standard file tools
          try {
            const execResult = await executeToolCall(tc.name, args, fileService, effectiveBookId);
            result = execResult.result;

            // Auto-commit if there's a commit change and session ID
            if (execResult.commitChange && req.body.sessionId) {
              const commit = {
                id: generateCommitId(),
                sessionId: req.body.sessionId,
                timestamp: new Date().toISOString(),
                message: `${execResult.commitChange.type === 'create' ? 'Created' : execResult.commitChange.type === 'edit' ? 'Edited' : 'Deleted'} ${execResult.commitChange.entityType} "${execResult.commitChange.entityName || execResult.commitChange.entityId}"`,
                changes: [execResult.commitChange],
                source: source || 'chat',
              };
              // Emit commit event
              res.write(
                `event: commit\ndata: ${JSON.stringify(commit)}\n\n`,
              );
              // Persist commit to session (project-level)
              try {
                const sessionFs = new FileService(req.projectId);
                await sessionFs.addCommit(req.body.sessionId, commit);
              } catch (err) {
                console.warn('[chatStream] Commit persistence failed', err);
                // Non-fatal: commit persistence failed
              }
            }
          } catch (err) {
            result = { error: String(err) };
          }
        }

        res.write(
          `event: tool_result\ndata: ${JSON.stringify({ id: tc.id, result })}\n\n`,
        );

        const partIndex = orderedParts.findIndex(
          part => part.type === 'tool_call' && part.toolCall.id === tc.id,
        );
        if (partIndex >= 0) {
          const part = orderedParts[partIndex];
          if (part.type === 'tool_call') {
            orderedParts[partIndex] = {
              ...part,
              toolCall: { ...part.toolCall, result },
            };
          }
        }

        openaiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Record token usage for the entire chat session
    // Use provider-reported usage when available; fall back to estimation
    const lastUsage = iterationUsages[iterationUsages.length - 1];
    const chatDurationMs = Date.now() - chatStartTime;
    const projectName = await resolveProjectTitle(req.projectId);

    if (lastUsage) {
      // Provider returned usage data — use it directly
      tokenUsageService.addRecord({
        id: generateId('usage'),
        timestamp: new Date().toISOString(),
        sessionId: req.body.sessionId,
        projectId: req.projectId,
        projectName,
        bookId: effectiveBookId,
        source: (source || 'chat') as 'chat' | 'import' | 'editor-inline',
        providerId: aiService.getSettings().activeProviderId,
        model: config!.model,
        promptTokens: lastUsage.prompt_tokens ?? 0,
        completionTokens: lastUsage.completion_tokens ?? 0,
        totalTokens: lastUsage.total_tokens ?? 0,
        cachedTokens: lastUsage.prompt_tokens_details?.cached_tokens ?? 0,
        iterationCount: iterations,
        durationMs: chatDurationMs,
      }).catch((err: unknown) => console.error('[TokenUsage] Failed to record chat usage:', err));
    } else if (accumulatedContent || accumulatedReasoning) {
      // Provider didn't return usage — estimate from content length (~4 chars/token)
      const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));
      const promptText = openaiMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
      const promptTokens = estimateTokens(promptText);
      const completionTokens = estimateTokens(accumulatedContent + accumulatedReasoning);

      tokenUsageService.addRecord({
        id: generateId('usage'),
        timestamp: new Date().toISOString(),
        sessionId: req.body.sessionId,
        projectId: req.projectId,
        projectName,
        bookId: effectiveBookId,
        source: (source || 'chat') as 'chat' | 'import' | 'editor-inline',
        providerId: aiService.getSettings().activeProviderId,
        model: config!.model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cachedTokens: 0,
        iterationCount: iterations,
        durationMs: chatDurationMs,
      }).catch((err: unknown) => console.error('[TokenUsage] Failed to record estimated chat usage:', err));
    }

    // Emit usage event to client before done. Always provide an estimated
    // fallback so tool-heavy or empty-text turns still refresh the indicator.
    const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));
    const promptText = openaiMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
    const estimatedPromptTokens = estimateTokens(promptText);
    const estimatedCompletionTokens = estimateTokens(accumulatedContent + accumulatedReasoning);
    const promptTokens = lastUsage?.prompt_tokens ?? estimatedPromptTokens;
    const completionTokens = lastUsage?.completion_tokens ?? estimatedCompletionTokens;
    const usageData = {
      promptTokens,
      completionTokens,
      totalTokens: lastUsage?.total_tokens ?? promptTokens + completionTokens,
      cachedTokens: lastUsage?.prompt_tokens_details?.cached_tokens ?? 0,
      model: config!.model,
      contextWindow: getContextWindow(
        config!.model,
        aiService.getSettings().providers.find(p => p.id === aiService.getSettings().activeProviderId)?.contextLengths,
      ),
    };

    res.write(`event: usage\ndata: ${JSON.stringify(usageData)}\n\n`);

    const finalMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: accumulatedContent,
      parts: orderedParts.length > 0 ? orderedParts : undefined,
      timestamp: new Date().toISOString(),
    };

    res.write(
      `event: done\ndata: ${JSON.stringify({ message: finalMessage })}\n\n`,
    );
  } catch (err) {
    const error = err as Error;
    console.error('[Chat Error]', {
      name: error.name,
      message: error.message,
      cause: (error as any).cause?.message,
      code: (error as any).code,
      status: (error as any).status,
      type: (error as any).type,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      isAbort: error.name === 'AbortError',
      isConnectionError: (error as any).code === 'ECONNREFUSED' || (error as any).code === 'ECONNRESET',
    });
    if (error.name === 'AbortError') {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: 'Request was cancelled or connection dropped' })}\n\n`,
      );
    } else {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`,
      );
    }
  } finally {
    res.end();
    activeChatControllers.delete(chatRequestId);
  }
}
