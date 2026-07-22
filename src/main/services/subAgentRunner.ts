import crypto from 'node:crypto';
import { generateTaskId, generateCommitId } from '../utils/idGenerator';
import { settingsStore } from './settings';
import { AiService } from './aiService';
import { extractReasoningDelta } from '../utils/reasoningDelta';
import { toolDefinitions } from './toolDefinitions';
import { executeToolCall, setMcpToolCaller } from './toolExecutor';
import { FileService } from './fileService';
import { mergeTools } from '../mcp/toolMerger';
import { buildSubAgentSystemPrompt } from './subAgentPrompt';
import { getSubAgent, activeRuns, runAbortControllers } from './subAgentService';
import type { McpExternalTool } from '../mcp/types';
import type {
  AgentTask,
  SubAgent,
  SubAgentRun,
  SubAgentModelConfig,
  AiProvider,
  ChatMessagePart,
  AiEffort,
} from '../../shared/types';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// ── Delegate ───────────────────────────────────────────────────────

export async function delegateToSubAgent(
  subAgentId: string,
  task: string,
  sessionId: string,
  projectId?: string,
  bookId?: string,
  sessionFileService?: FileService,
  agentName?: string,
  context?: string[],
  externalMcpTools?: McpExternalTool[],
  mcpToolCallerFn?: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<string> {
  const subAgent = await getSubAgent(subAgentId);
  if (!subAgent) {
    throw new Error(`Sub-agent '${subAgentId}' not found`);
  }

  const runId = crypto.randomUUID();
  const run: SubAgentRun = {
    id: runId,
    subAgentId: subAgent.id,
    subAgentName: subAgent.name,
    agentName: agentName,
    sessionId,
    task,
    status: 'running',
    messages: [],
    startedAt: new Date().toISOString(),
  };

  activeRuns.set(runId, run);

  // Fire-and-forget async execution
  runExecution(run, subAgent, projectId, bookId, sessionFileService, context, externalMcpTools, mcpToolCallerFn).catch(err => {
    console.error(`[SubAgent] Unhandled error in run ${runId}:`, err);
    const current = activeRuns.get(runId);
    if (current && current.status === 'running') {
      current.status = 'error';
      current.error = String(err);
      current.completedAt = new Date().toISOString();

      // Schedule cleanup after 5 minutes
      setTimeout(() => {
        activeRuns.delete(runId);
        runAbortControllers.delete(runId);
      }, 5 * 60 * 1000);
    }
  });

  return runId;
}

// ── Model Fallback ─────────────────────────────────────────────────

interface ProviderWithModel {
  provider: AiProvider;
  model: string;
  effort: AiEffort;
}

function resolveModelConfig(config: SubAgentModelConfig): ProviderWithModel | undefined {
  const settings = settingsStore.get('ai');
  if (!settings) return undefined;

  const provider = settings.providers.find(p => p.id === config.providerId);
  if (!provider) return undefined;

  return { provider, model: config.model, effort: config.effort };
}

interface ModelChainResult {
  chain: ProviderWithModel[];
  missingProviders: string[];
}

function buildModelChain(subAgent: SubAgent): ModelChainResult {
  const chain: ProviderWithModel[] = [];
  const missingProviders: string[] = [];

  const primary = resolveModelConfig(subAgent.defaultModel);
  if (primary) {
    chain.push(primary);
  } else if (subAgent.defaultModel?.providerId) {
    missingProviders.push(subAgent.defaultModel.providerId);
  }

  for (const fb of subAgent.fallbackModels) {
    const resolved = resolveModelConfig(fb);
    if (resolved) {
      chain.push(resolved);
    } else if (fb.providerId) {
      if (!missingProviders.includes(fb.providerId)) {
        missingProviders.push(fb.providerId);
      }
    }
  }

  if (missingProviders.length > 0) {
    console.warn(
      `[SubAgent] Missing providers/models for agent "${subAgent.name}": ${missingProviders.join(', ')}. ` +
      'Check that these providers exist in AI settings.',
    );
  }

  return { chain, missingProviders };
}

// ── Autonomous Execution Loop ──────────────────────────────────────

async function runExecution(
  run: SubAgentRun,
  subAgent: SubAgent,
  projectId?: string,
  bookId?: string,
  sessionFileService?: FileService,
  context?: string[],
  externalMcpTools?: McpExternalTool[],
  mcpToolCallerFn?: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<void> {
  const abortController = new AbortController();
  runAbortControllers.set(run.id, abortController);

  // Build the model chain with fallback
  const { chain: modelChain, missingProviders } = buildModelChain(subAgent);
  if (modelChain.length === 0) {
    run.status = 'error';
    run.error = missingProviders.length > 0
      ? `No valid provider/model configuration found. Missing providers: ${missingProviders.join(', ')}. Check that these providers exist in AI settings.`
      : 'No valid provider/model configuration found. Check that the provider exists in AI settings.';
    run.completedAt = new Date().toISOString();
    runAbortControllers.delete(run.id);

    // Persist the failed run to session
    if (sessionFileService && run.sessionId) {
      try {
        await sessionFileService.addSubAgentRun(run.sessionId, { ...run });
      } catch {
        console.debug('[subAgentRunner] Non-fatal error persisting failed run');
        /* non-fatal */
      }
    }

    // Schedule cleanup after 5 minutes
    setTimeout(() => {
      activeRuns.delete(run.id);
      runAbortControllers.delete(run.id);
    }, 5 * 60 * 1000);

    return;
  }

  const systemPrompt = await buildSubAgentSystemPrompt(subAgent, projectId, bookId, context);

  // Build initial messages
  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: run.task },
  ];

  // Create FileService for tool execution (if project context available)
  const fileService = projectId ? new FileService(projectId, bookId || undefined) : null;

  // Use shared tool definitions, excluding main-agent-only orchestration tools
  const subAgentOnlyToolNames = new Set([
    'delegateToSubAgent', 'listSubAgents', 'getSubAgentResult', 'awaitSubAgentResult',
    'listSkills', 'getSkill',
    'createSkill', 'updateSkill', 'deleteSkill',
    'createSubAgent', 'updateSubAgent', 'deleteSubAgent',
  ]);
  const baseTools: ChatCompletionTool[] = toolDefinitions.filter(
    t => 'function' in t && !subAgentOnlyToolNames.has(t.function.name),
  );

  // Merge MCP tools if available
  const mcpTools = externalMcpTools ?? [];
  let subAgentTools: ChatCompletionTool[];
  if (mcpTools.length > 0 && mcpToolCallerFn) {
    const { tools, lookup } = mergeTools(baseTools, mcpTools);
    subAgentTools = tools;
    setMcpToolCaller(mcpToolCallerFn, lookup);
  } else {
    subAgentTools = baseTools;
  }

  let lastError: string | undefined;

  for (const modelAttempt of modelChain) {
    if (abortController.signal.aborted) break;

    try {
      // Create a fresh AiService instance for this model attempt
      const aiService = new AiService();
      aiService.configure({
        baseUrl: modelAttempt.provider.baseUrl,
        apiKey: modelAttempt.provider.apiKey,
        model: modelAttempt.model,
      });

      run.modelUsed = modelAttempt.model;
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
      let hitIterationLimit = false;
      const maxIterations = 50;
      const effectiveMaxIterations = subAgent.maxStreams && subAgent.maxStreams > 0
        ? Math.min(subAgent.maxStreams, maxIterations)
        : maxIterations;

      for (let iteration = 0; iteration < effectiveMaxIterations; iteration++) {
        if (abortController.signal.aborted) {
          throw new Error('Aborted');
        }

        const toolCallsAcc = new Map<number, { id: string; name: string; args: string }>();
        let content = '';

        const stream = aiService.chatStream(
          openaiMessages,
          subAgentTools,
          abortController.signal,
          modelAttempt.effort,
        );

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            content += delta.content;
            accumulatedContent += delta.content;
            appendOrderedTextPart('text', delta.content);
          }
          run.streamingContent = content;  // expose to SSE endpoint for real-time polling

          // Reasoning/thinking content (DeepSeek R1, QwQ, llama.cpp, vLLM, OpenRouter)
          const reasoningDelta = extractReasoningDelta(delta) ?? null;
          if (reasoningDelta) {
            accumulatedReasoning += reasoningDelta;
            appendOrderedTextPart('thinking', reasoningDelta);
          }
          run.streamingReasoning = accumulatedReasoning;  // expose to SSE endpoint

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
        }

        // Clear streaming fields — content will now appear in completed messages
        run.streamingContent = undefined;
        run.streamingReasoning = undefined;

        // No tool calls — done
        if (toolCallsAcc.size === 0) {
          // Record the assistant message
          run.messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            parts: orderedParts.length > 0 ? [...orderedParts] : undefined,
            timestamp: new Date().toISOString(),
          });
          break;
        }

        // Check if this is the last allowed iteration
        if (iteration === effectiveMaxIterations - 1) {
          hitIterationLimit = true;
        }

        // Build assistant message with tool calls
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

        // Record assistant message with tool calls
        const assistantParts: ChatMessagePart[] = [
          ...orderedParts,
          ...Array.from(toolCallsAcc.entries()).map(([, call]) => {
            let parsedArgs: Record<string, unknown> = {};
            try { parsedArgs = JSON.parse(call.args); } catch { console.debug('[subAgentRunner] Failed to parse tool call args, using empty object'); /* ignore */ }
            return {
              type: 'tool_call' as const,
              toolCall: { id: call.id, name: call.name, args: parsedArgs },
            };
          }),
        ];
        run.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
          parts: assistantParts,
        });

        // Execute each tool call
        const toolResults = new Map<string, unknown>();
        for (const [, tc] of toolCallsAcc) {
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.args);
          } catch {
            args = {};
          }

          let result: unknown;

          // Handle task management tools inline (same pattern as main chat loop)
          if (tc.name === 'createTask') {
            const task: AgentTask = {
              id: generateTaskId(),
              displayName: (args.displayName as string) || 'Untitled Task',
              content: (args.content as string) || '',
              status: 'pending',
              createdAt: new Date().toISOString(),
            };
            // Persist to session if available
            if (sessionFileService && run.sessionId) {
              try {
                await sessionFileService.addTask(run.sessionId, task);
              } catch {
                console.debug('[subAgentRunner] Non-fatal: failed to persist task');
                /* non-fatal */
              }
            }
            result = { success: true, taskId: task.id, displayName: task.displayName };
          } else if (tc.name === 'completeTask') {
            if (sessionFileService && run.sessionId) {
              try {
                await sessionFileService.updateTask(run.sessionId, args.taskId as string, {
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                });
              } catch {
                console.debug('[subAgentRunner] Non-fatal: failed to update task');
                /* non-fatal */
              }
            }
            result = { success: true, taskId: args.taskId };
          } else if (tc.name === 'getTasks') {
            // Return tasks from session if available
            if (sessionFileService && run.sessionId) {
              try {
                const sessionData = await sessionFileService.getSession(run.sessionId);
                result = { tasks: sessionData?.tasks ?? [] };
              } catch {
                result = { tasks: [] };
              }
            } else {
              result = { tasks: [] };
            }
          } else if (fileService) {
            try {
              if (bookId && typeof args.bookId !== 'string') {
                args.bookId = bookId;
              }
              const execResult = await executeToolCall(tc.name, args, fileService, bookId);
              result = execResult.result;

              // Persist commit if the tool made a tracked change
              if (execResult.commitChange && sessionFileService && run.sessionId) {
                const commit = {
                  id: generateCommitId(),
                  sessionId: run.sessionId,
                  timestamp: new Date().toISOString(),
                  message: `${execResult.commitChange.type === 'create' ? 'Created' : execResult.commitChange.type === 'edit' ? 'Edited' : 'Deleted'} ${execResult.commitChange.entityType} "${execResult.commitChange.entityName || execResult.commitChange.entityId}"`,
                  changes: [execResult.commitChange],
                };
                try {
                  await sessionFileService.addCommit(run.sessionId, commit);
                } catch (err) {
                  console.warn('[subAgentRunner] Commit persistence failed:', err);
                  // Non-fatal: commit persistence failed
                }
              }
            } catch (err) {
              result = { error: String(err) };
            }
          } else {
            result = { error: 'No project context available for tool execution' };
          }

          // Store result for SSE emission
          toolResults.set(tc.id, result);

          // Add tool result to conversation for the LLM
          openaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }

        // Update the assistant message's toolCalls with results for SSE emission
        const lastAssistantMsg = run.messages[run.messages.length - 1];
        if (lastAssistantMsg?.parts) {
          for (const part of lastAssistantMsg.parts) {
            if (part.type === 'tool_call' && toolResults.has(part.toolCall.id)) {
              part.toolCall.result = toolResults.get(part.toolCall.id);
            }
          }
        }

        // Record tool results as tool role messages for the run message history
        for (const [tcId, result] of toolResults) {
          const tcEntry = Array.from(toolCallsAcc.values()).find(t => t.id === tcId);
          run.messages.push({
            id: crypto.randomUUID(),
            role: 'tool',
            content: JSON.stringify(result),
            toolCallId: tcId,
            toolCallName: tcEntry?.name,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Success — set result and finish
      run.status = 'completed';
      run.result = accumulatedContent || undefined;
      if (hitIterationLimit) {
        run.error = `Reached maximum iteration limit (${effectiveMaxIterations}). Task may be incomplete.`;
      }
      run.completedAt = new Date().toISOString();
      runAbortControllers.delete(run.id);

      // Persist the completed run to session
      if (sessionFileService && run.sessionId) {
        try {
          await sessionFileService.addSubAgentRun(run.sessionId, { ...run });
          // Inject result as system message so main agent sees it automatically
          const displayName = run.agentName || run.subAgentName;
          const resultMsg = run.result
            ? `[Sub-Agent Result] "${displayName}" completed task: "${run.task}"\n\nResult:\n${run.result}`
            : `[Sub-Agent Result] "${displayName}" completed task: "${run.task}" (no text output — edits were applied directly)`;
          await sessionFileService.addMessage(run.sessionId, {
            id: crypto.randomUUID(),
            role: 'system',
            content: resultMsg,
            timestamp: new Date().toISOString(),
          });
        } catch {
          console.debug('[subAgentRunner] Non-fatal: failed to persist completed run message');
          /* non-fatal */
        }
      }

      // Schedule cleanup after 5 minutes
      setTimeout(() => {
        activeRuns.delete(run.id);
        runAbortControllers.delete(run.id);
      }, 5 * 60 * 1000);

      return;
    } catch (err) {
      const error = err as Error;

      // If aborted, don't try fallbacks
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        run.status = 'error';
        run.error = 'Cancelled';
        run.completedAt = new Date().toISOString();
        runAbortControllers.delete(run.id);

        // Persist the cancelled run to session
        if (sessionFileService && run.sessionId) {
          try {
            await sessionFileService.addSubAgentRun(run.sessionId, { ...run });
            await sessionFileService.addMessage(run.sessionId, {
              id: crypto.randomUUID(),
              role: 'system',
              content: `[Sub-Agent Result] "${run.agentName || run.subAgentName}" was cancelled while working on: "${run.task}"`,
              timestamp: new Date().toISOString(),
            });
          } catch {
            console.debug('[subAgentRunner] Non-fatal: failed to persist cancelled run message');
            /* non-fatal */
          }
        }

        // Schedule cleanup after 5 minutes
        setTimeout(() => {
          activeRuns.delete(run.id);
          runAbortControllers.delete(run.id);
        }, 5 * 60 * 1000);

        return;
      }

      lastError = error.message || String(err);
      console.warn(
        `[SubAgent] Model ${modelAttempt.model} failed for run ${run.id}:`,
        lastError,
      );
      // Continue to next model in fallback chain
    }
  }

  // All models exhausted
  run.status = 'error';
  run.error = lastError || 'All model attempts failed';
  run.completedAt = new Date().toISOString();
  runAbortControllers.delete(run.id);

  // Persist the failed run to session
  if (sessionFileService && run.sessionId) {
    try {
      await sessionFileService.addSubAgentRun(run.sessionId, { ...run });
      await sessionFileService.addMessage(run.sessionId, {
        id: crypto.randomUUID(),
        role: 'system',
        content: `[Sub-Agent Result] "${run.agentName || run.subAgentName}" failed task: "${run.task}"\nError: ${run.error}`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.debug('[subAgentRunner] Non-fatal: failed to persist failure message');
      /* non-fatal */
    }
  }

  // Schedule cleanup after 5 minutes
  setTimeout(() => {
    activeRuns.delete(run.id);
    runAbortControllers.delete(run.id);
  }, 5 * 60 * 1000);
}
