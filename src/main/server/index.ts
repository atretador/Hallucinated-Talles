import express from 'express';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { AiService } from '../services/aiService';
import { getMcpServers, getActiveMcpServerIds } from '../services/settings';
import { mcpClientManager, tokenUsageService } from './serverState';
import { projectIdMiddleware, bookIdMiddleware } from './middleware';
import { projectRoutes } from './routes/projectRoutes';
import { entityRoutes } from './routes/entityRoutes';
import { planRoutes } from './routes/planRoutes';
import { chatRoutes } from './routes/chatRoutes';
import { importExportRoutes } from './routes/importExportRoutes';
import { searchRoutes } from './routes/searchRoutes';
import { aiRoutes } from './routes/aiRoutes';
import { settingsRoutes } from './routes/settingsRoutes';
import { mcpRoutes } from './routes/mcpRoutes';
import { subAgentRoutes } from './routes/subAgentRoutes';
import { coverRoutes } from './routes/coverRoutes';
import { skillsRoutes } from './routes/skillsRoutes';
import { sessionRoutes } from './routes/sessionRoutes';
import { handlePlanGenerateStream } from './planGenerateStream';

// Augment Express Request so req.projectId is available on all routes
declare global {
  namespace Express {
    interface Request {
      projectId: string;
      bookId?: string;
    }
  }
}

export function createServer(aiService?: AiService) {
  const app = express();

  // Global middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(projectIdMiddleware);
  app.use(bookIdMiddleware);

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Mount all route modules
  app.use(projectRoutes(aiService ? { aiService } : undefined));
  app.use(entityRoutes());
  app.use(planRoutes());
  app.use(chatRoutes(aiService));
  app.use(importExportRoutes(aiService));
  app.use(searchRoutes());
  app.use(aiRoutes(aiService));
  app.use(settingsRoutes(tokenUsageService));
  app.use(mcpRoutes(mcpClientManager));
  app.use(subAgentRoutes(mcpClientManager));
  app.use(coverRoutes());
  app.use(skillsRoutes());
  app.use(sessionRoutes());

  // Generate from plan (SSE streaming) — needs aiService
  app.post('/api/generate-from-plan', async (req: Request, res: Response) => {
    if (!aiService) {
      res.status(500).json({ success: false, error: 'AI service not available' });
      return;
    }
    await handlePlanGenerateStream(req, res, aiService);
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: err.message });
  });

  // Initialize MCP client manager with saved servers
  const savedMcpServers = getMcpServers();
  const activeMcpIds = getActiveMcpServerIds();
  const enabledServers = savedMcpServers.filter(s => s.enabled && activeMcpIds.includes(s.id));
  mcpClientManager.initialize(enabledServers).catch(err => {
    console.error('[MCP] Failed to initialize MCP servers:', err);
  });

  return app;
}

/** Shutdown all MCP server connections (call on app quit) */
export async function shutdownMcpServers(): Promise<void> {
  await mcpClientManager.shutdown();
}
