import { Router } from 'express';
import type { Request, Response } from 'express';
import { FileService } from '../../services/fileService';
import * as subAgentService from '../../services/subAgentService';
import { delegateToSubAgent } from '../../services/subAgentRunner';
import { getActiveSubAgentIds, setActiveSubAgentIds, getActiveMcpServerIds } from '../../services/settings';
import { McpClientManager } from '../../mcp/clientManager';
import type { SubAgent, ChatMessagePart } from '../../../shared/types';

export function subAgentRoutes(mcpClientManager: McpClientManager): Router {
  const router = Router();

  // Active sub-aget IDs
  router.get('/api/sub-agents/active', (_req: Request, res: Response) => {
    try {
      const ids = getActiveSubAgentIds();
      res.json({ success: true, data: ids });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sub-agents/active', (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids: string[] };
      setActiveSubAgentIds(ids ?? []);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Sub-agent CRUD
  router.get('/api/sub-agents', async (_req: Request, res: Response) => {
    try {
      const agents = await subAgentService.listSubAgents();
      res.json({ success: true, data: agents });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sub-agents', async (req: Request, res: Response) => {
    try {
      const agent = req.body as SubAgent;
      const saved = await subAgentService.saveSubAgent(agent);
      res.json({ success: true, data: saved });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/sub-agents/:id', async (req: Request, res: Response) => {
    try {
      const agent = { ...req.body, id: req.params.id as string } as SubAgent;
      const saved = await subAgentService.saveSubAgent(agent);
      res.json({ success: true, data: saved });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/sub-agents/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await subAgentService.deleteSubAgent(req.params.id as string);
      res.json({ success: true, data: { deleted } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Delegate to sub-agent
  router.post('/api/sub-agents/delegate', async (req: Request, res: Response) => {
    try {
      const { subAgentId, task, sessionId, agentName, context } = req.body;
      if (!subAgentId || !task || !sessionId) {
        return res.status(400).json({ success: false, error: 'subAgentId, task, and sessionId are required' });
      }
      const delegateFileService = new FileService(req.projectId);
      const delegateMcpIds = new Set(getActiveMcpServerIds());
      const delegateMcpTools = mcpClientManager.getAllTools(delegateMcpIds);
      const delegateMcpCaller = (name: string, args: Record<string, unknown>) => mcpClientManager.callTool(name, args);
      const runId = await delegateToSubAgent(
        subAgentId, task, sessionId, req.projectId, req.bookId, delegateFileService, agentName, context,
        delegateMcpTools, delegateMcpCaller,
      );
      res.json({ success: true, data: { runId } });
    } catch (err) {
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  // Sub-agent runs
  router.get('/api/sub-agents/runs/:runId', async (req: Request, res: Response) => {
    try {
      const run = subAgentService.getSubAgentRun(req.params.runId as string);
      if (!run) {
        res.status(404).json({ success: false, error: 'Run not found' });
        return;
      }
      res.json({ success: true, data: run });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/sub-agents/runs', async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      const runs = subAgentService.listSubAgentRuns(sessionId);
      res.json({ success: true, data: runs });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sub-agents/runs/:runId/cancel', async (req: Request, res: Response) => {
    try {
      const cancelled = subAgentService.cancelSubAgentRun(req.params.runId as string);
      res.json({ success: true, data: { cancelled } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Sub-agent run stream (SSE)
  router.get('/api/sub-agents/runs/:runId/stream', async (req: Request, res: Response) => {
    const runId = req.params.runId as string;
    const run = subAgentService.getSubAgentRun(runId);
    if (!run) {
      res.status(404).json({ success: false, error: 'Run not found' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    res.write(`event: status\ndata: ${JSON.stringify({ status: run.status, modelUsed: run.modelUsed })}\n\n`);

    if (run.status !== 'running') {
      for (const msg of run.messages) {
        const toolParts = (msg.parts ?? []).filter((part): part is Extract<ChatMessagePart, { type: 'tool_call' }> => part.type === 'tool_call');
        if (msg.role === 'assistant' && toolParts.length > 0) {
          for (const { toolCall: tc } of toolParts) {
            res.write(`event: tool_call\ndata: ${JSON.stringify({ id: tc.id, name: tc.name, args: tc.args })}\n\n`);
            if (tc.result !== undefined) {
              res.write(`event: tool_result\ndata: ${JSON.stringify({ id: tc.id, result: tc.result })}\n\n`);
            }
          }
        }
        if (msg.role === 'tool' && msg.toolCallId) {
          let parsedResult: unknown = msg.content;
          try { parsedResult = JSON.parse(msg.content); } catch { console.debug('[subAgentRoutes] Failed to parse tool result JSON, keeping as string'); /* keep as string */ }
          res.write(`event: tool_result\ndata: ${JSON.stringify({ id: msg.toolCallId, result: parsedResult, name: msg.toolCallName })}\n\n`);
        }
      }
      if (run.result) {
        res.write(`event: token\ndata: ${JSON.stringify({ content: run.result })}\n\n`);
      }
      if (run.error) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: run.error })}\n\n`);
      }
      res.write(`event: done\ndata: ${JSON.stringify({ modelUsed: run.modelUsed })}\n\n`);
      res.end();
      return;
    }

    let lastMsgIndex = 0;
    let lastStreamedContentLen = 0;
    let lastStreamedReasoningLen = 0;

    const interval = setInterval(() => {
      const current = subAgentService.getSubAgentRun(runId);
      if (!current) {
        clearInterval(interval);
        res.end();
        return;
      }

      if (current.streamingContent != null) {
        if (current.streamingContent.length > lastStreamedContentLen) {
          const delta = current.streamingContent.slice(lastStreamedContentLen);
          lastStreamedContentLen = current.streamingContent.length;
          res.write(`event: token\ndata: ${JSON.stringify({ content: delta })}\n\n`);
        }
      } else {
        lastStreamedContentLen = 0;
      }

      if (current.streamingReasoning != null) {
        if (current.streamingReasoning.length > lastStreamedReasoningLen) {
          const delta = current.streamingReasoning.slice(lastStreamedReasoningLen);
          lastStreamedReasoningLen = current.streamingReasoning.length;
          res.write(`event: thinking\ndata: ${JSON.stringify({ content: delta })}\n\n`);
        }
      } else {
        lastStreamedReasoningLen = 0;
      }

      while (lastMsgIndex < current.messages.length) {
        const msg = current.messages[lastMsgIndex];
        lastMsgIndex++;

        const toolParts = (msg.parts ?? []).filter((part): part is Extract<ChatMessagePart, { type: 'tool_call' }> => part.type === 'tool_call');
        if (msg.role === 'assistant' && toolParts.length > 0) {
          for (const { toolCall: tc } of toolParts) {
            res.write(`event: tool_call\ndata: ${JSON.stringify({ id: tc.id, name: tc.name, args: tc.args })}\n\n`);
            if (tc.result !== undefined) {
              res.write(`event: tool_result\ndata: ${JSON.stringify({ id: tc.id, result: tc.result })}\n\n`);
            }
          }
        }

        if (msg.role === 'tool' && msg.toolCallId) {
          let parsedResult: unknown = msg.content;
          try { parsedResult = JSON.parse(msg.content); } catch { console.debug('[subAgentRoutes] Failed to parse tool result JSON, keeping as string'); /* keep as string */ }
          res.write(`event: tool_result\ndata: ${JSON.stringify({ id: msg.toolCallId, result: parsedResult, name: msg.toolCallName })}\n\n`);
        }
      }

      if (current.status !== 'running') {
        clearInterval(interval);
        if (current.error) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: current.error })}\n\n`);
        }
        res.write(`event: done\ndata: ${JSON.stringify({ modelUsed: current.modelUsed })}\n\n`);
        res.end();
      }
    }, 200);

    res.on('close', () => clearInterval(interval));
  });

  return router;
}
