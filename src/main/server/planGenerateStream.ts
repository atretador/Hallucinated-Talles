import type { Request, Response } from 'express';
import type { AiService } from '../services/aiService';
import { FileService } from '../services/fileService';
import { mcpClientManager } from './serverState';
import { topologicalSort } from './utils';
import { getActiveMcpServerIds } from '../services/settings';
import { mergeTools } from '../mcp/toolMerger';
import { toolDefinitions } from '../services/toolDefinitions';
import { setMcpToolCaller, executeToolCall } from '../services/toolExecutor';
import type { AiEffort, GenerationProgress, PlanNodeType } from '../../shared/types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * SSE streaming endpoint for /api/generate-from-plan.
 * Generates content from each plan node using the AI, creating chapters and pages.
 */
export async function handlePlanGenerateStream(
  req: Request,
  res: Response,
  aiService: AiService,
): Promise<void> {
  const { effort } = req.body as { effort?: AiEffort };

  // AI-configured guard
  if (!aiService.isConfigured()) {
    res.status(400).json({ success: false, error: 'AI service is not configured' });
    return;
  }

  if (!req.bookId) {
    res.status(400).json({ success: false, error: 'bookId is required' });
    return;
  }

  const fileService = new FileService(req.projectId, req.bookId);

  // Load plan
  const plan = await fileService.getPlan();
  if (!plan || !plan.nodes || plan.nodes.length === 0) {
    res.status(400).json({ success: false, error: 'No plan found for this book' });
    return;
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send SSE keepalive pings every 15s
  const keepAliveInterval = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch { console.debug('[planGenerateStream] Connection closed'); /* connection closed */ }
  }, 15000);

  const abortController = new AbortController();
  const cleanup = () => {
    clearInterval(keepAliveInterval);
  };
  res.on('close', () => {
    abortController.abort();
    cleanup();
  });
  res.on('error', () => {
    // Socket errors (ECONNRESET) — cleanup silently
  });

  try {
    // Pre-flight: verify model server is reachable
    res.write(`event: status\ndata: ${JSON.stringify({ status: 'connecting' })}\n\n`);

    const probe = await aiService.checkConnection();
    if (!probe.ok) {
      cleanup();
      res.write(`event: error\ndata: ${JSON.stringify({ error: probe.error })}\n\n`);
      res.end();
      return;
    }
    res.write(`event: status\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

    const sortedNodes = topologicalSort(plan);
    const total = sortedNodes.length;

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];

      // Skip 'note' nodes — they're not story content
      if (node.type === 'note') continue;

      // Send progress event
      const progress: GenerationProgress = {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.type as PlanNodeType,
        status: 'generating' as const,
        current: i + 1,
        total,
      };
      res.write(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`);

      try {
        // Build context from previously generated chapters
        const bookStructure = await fileService.getBookStructure();
        const existingChapters = bookStructure.items.filter(i => i.type === 'chapter').map(ch =>
          `- ${ch.title} (ID: ${ch.id})`
        ).join('\n');

        // Get characters for context
        const metadata = await fileService.getMetadata();
        const characterSummary = metadata.characters.map(c =>
          `- ${c.name}: ${c.description}`
        ).join('\n');

        const systemPrompt = `You are generating content for a story based on a plan node.

BOOK CONTEXT:
Book: "${bookStructure.title || 'Untitled'}"
Existing chapters:
${existingChapters || 'None yet'}

CHARACTERS:
${characterSummary || 'None specified'}

PLAN NODE:
- Label: "${node.data.label}"
- Type: ${node.type}
- Description: ${node.data.description || 'No description provided'}
${node.data.characters?.length ? `- Characters involved: ${node.data.characters.join(', ')}` : ''}
${node.data.notes ? `- Notes: ${node.data.notes}` : ''}

YOUR TASK:
1. Create a chapter heading using insertChapter with the node title as the chapter title
2. Write the chapter content using editRange (preferred, lower risk) or editContent (full rewrite, higher risk) — create compelling, well-structured narrative prose
3. If the node description mentions specific scenes or beats, include them all
4. Use the existing characters and their descriptions for consistency
5. Write at least 2-3 paragraphs of quality prose

METADATA MANAGEMENT (mandatory):
- When you write a named character not in the character list, register them with addCharacter.
- When a character experiences something significant in this chapter, add a CharacterEntry to their record with editCharacter (include chapterId, description, and impact).
- When characters form or change relationships, add CharacterRelation entries via editCharacter.
- When significant events happen in the story, register them with addEvent — include chapterId, text locations, involved characters, type, and consequences.
- When world-building elements are introduced, use addWorldData. PROHIBITED: Do NOT register book titles, chapter titles, character names, or paraphrases of them as world data — even as "the setting" or "the world".

IMPORTANT:
- Use insertChapter FIRST to add the chapter heading
- Then use editRange (preferred, targeted) or editContent (full rewrite) to write the actual content
- Write substantial prose, not outlines or summaries`;

        const messages: ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate the content for plan node "${node.data.label}" (${node.type}).` },
        ];

        // Tool-calling loop (same as import, max 5 iterations)
        let iterations = 0;
        const maxIterations = 5;
        let generatedChapterId: string | undefined;

        while (iterations < maxIterations) {
          iterations++;

          const activeMcpIds = new Set(getActiveMcpServerIds());
          const externalMcpTools = mcpClientManager.getAllTools(activeMcpIds);
          const { tools: mergedTools, lookup: mcpLookup } = mergeTools(toolDefinitions, externalMcpTools);
          setMcpToolCaller((name, args) => mcpClientManager.callTool(name, args), mcpLookup);
          const stream = aiService.chatStream(
            messages,
            mergedTools,
            abortController.signal,
            effort || 'medium',
          );

          let content = '';
          const toolCallsAcc = new Map<number, { id: string; name: string; args: string }>();

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) content += delta.content;
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCallsAcc.has(idx)) toolCallsAcc.set(idx, { id: '', name: '', args: '' });
                const existing = toolCallsAcc.get(idx)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.args += tc.function.arguments;
              }
            }
          }

          if (toolCallsAcc.size === 0) break;

          // Build assistant message
          messages.push({
            role: 'assistant',
            content: content || null,
            tool_calls: Array.from(toolCallsAcc.entries()).map(([, call]) => ({
              id: call.id,
              type: 'function' as const,
              function: { name: call.name, arguments: call.args },
            })),
          });

          // Execute tool calls
          for (const [, tc] of toolCallsAcc) {
            let args: Record<string, unknown>;
            try { args = JSON.parse(tc.args); } catch { args = {}; }

            const execResult = await executeToolCall(tc.name, args, fileService, req.bookId);

            // Track the chapter ID from insertChapter
            if (tc.name === 'insertChapter') {
              const result = execResult.result as { chapterId?: string } | null;
              if (result?.chapterId) {
                generatedChapterId = result.chapterId;
              }
            }

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(execResult.result),
            });
          }
        }

        // Update plan node with generatedChapterId
        if (generatedChapterId) {
          const nodeIndex = plan.nodes.findIndex(n => n.id === node.id);
          if (nodeIndex >= 0) {
            plan.nodes[nodeIndex].data.generatedChapterId = generatedChapterId;
            plan.nodes[nodeIndex].data.status = 'complete';
          }
        }

        // Save updated plan
        await fileService.savePlan(plan);

        // Send node_complete event
        res.write(`event: node_complete\ndata: ${JSON.stringify({
          nodeId: node.id,
          chapterId: generatedChapterId,
          label: node.data.label,
        })}\n\n`);

      } catch (error) {
        // Send node_error event but continue to next node
        console.error(`[GenerateFromPlan] Node ${node.id} error:`, error);
        res.write(`event: node_error\ndata: ${JSON.stringify({
          nodeId: node.id,
          error: error instanceof Error ? error.message : String(error),
        })}\n\n`);
      }
    }

    // Complete
    res.write(`event: complete\ndata: ${JSON.stringify({
      summary: `Generated content for ${total} plan nodes`,
      nodesProcessed: total,
    })}\n\n`);

  } catch (error) {
    console.error('[GenerateFromPlan] Error:', error);
    if (!res.destroyed) {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      })}\n\n`);
    }
  } finally {
    cleanup();
    res.end();
  }
}
