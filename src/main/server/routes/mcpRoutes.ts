import { Router } from 'express';
import type { Request, Response } from 'express';
import { McpClientManager } from '../../mcp/clientManager';
import { getMcpServers, setMcpServers, getActiveMcpServerIds, setActiveMcpServerIds } from '../../services/settings';
import type { McpServerConfig } from '../../../shared/types';

export function mcpRoutes(mcpClientManager: McpClientManager): Router {
  const router = Router();

  router.get('/api/mcp/servers', (_req: Request, res: Response) => {
    try {
      const servers = mcpClientManager.getServers();
      res.json({ success: true, data: servers });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/mcp/servers/active', (_req: Request, res: Response) => {
    try {
      const ids = getActiveMcpServerIds();
      res.json({ success: true, data: ids });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/mcp/servers/active', (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids: string[] };
      setActiveMcpServerIds(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/mcp/servers/:id', (req: Request, res: Response) => {
    try {
      const servers = mcpClientManager.getServers();
      const server = servers.find(s => s.config.id === req.params.id);
      if (!server) {
        res.status(404).json({ success: false, error: 'Server not found' });
        return;
      }
      res.json({ success: true, data: server });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/mcp/servers', async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<McpServerConfig>;
      if (!body.id || !body.name || !body.command) {
        res.status(400).json({ success: false, error: 'id, name, and command are required' });
        return;
      }
      const now = new Date().toISOString();
      const config: McpServerConfig = {
        id: body.id,
        name: body.name,
        command: body.command,
        args: body.args,
        env: body.env,
        enabled: body.enabled ?? true,
        timeoutMs: body.timeoutMs,
        createdAt: now,
        updatedAt: now,
      };
      const existing = getMcpServers();
      if (existing.some(s => s.id === config.id)) {
        res.status(409).json({ success: false, error: 'Server with this ID already exists' });
        return;
      }
      setMcpServers([...existing, config]);
      if (config.enabled) {
        await mcpClientManager.addServer(config);
      }
      const servers = mcpClientManager.getServers();
      const info = servers.find(s => s.config.id === config.id) ?? { config, status: 'disconnected' as const, toolCount: 0, toolNames: [] };
      res.json({ success: true, data: info });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/mcp/servers/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const updates = req.body as Partial<McpServerConfig>;
      const existing = getMcpServers();
      const idx = existing.findIndex(s => s.id === id);
      if (idx === -1) {
        res.status(404).json({ success: false, error: 'Server not found' });
        return;
      }
      const updated: McpServerConfig = { ...existing[idx], ...updates, id, updatedAt: new Date().toISOString() };
      existing[idx] = updated;
      setMcpServers(existing);
      await mcpClientManager.updateServer(updated);
      const servers = mcpClientManager.getServers();
      const info = servers.find(s => s.config.id === id) ?? { config: updated, status: 'disconnected' as const, toolCount: 0, toolNames: [] };
      res.json({ success: true, data: info });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/mcp/servers/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = getMcpServers();
      setMcpServers(existing.filter(s => s.id !== id));
      const activeIds = getActiveMcpServerIds();
      setActiveMcpServerIds(activeIds.filter(aid => aid !== id));
      await mcpClientManager.removeServer(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
