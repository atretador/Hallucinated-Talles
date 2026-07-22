import { Router } from 'express';
import type { Request, Response } from 'express';
import { settingsStore, getEffectiveProjectsDir, isProjectsDirConfigured } from '../../services/settings';
import { TokenUsageService } from '../../services/tokenUsageService';
import { getEffortConfig, setEffortConfig, resolveEffortOptions } from '../../services/effortConfigService';

export function settingsRoutes(tokenUsageService: TokenUsageService): Router {
  const router = Router();

  // ── Projects directory settings ──

  router.get('/api/settings/projects-dir', (_req: Request, res: Response) => {
    try {
      const configured = isProjectsDirConfigured();
      const path = getEffectiveProjectsDir();
      res.json({ success: true, data: { configured, path } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/settings/projects-dir', async (req: Request, res: Response) => {
    try {
      const { dir } = req.body as { dir: string };
      if (!dir || typeof dir !== 'string') {
        res.status(400).json({ success: false, error: 'dir is required' });
        return;
      }
      const fs = await import('node:fs/promises');
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
      settingsStore.set('projectsDir', dir);
      res.json({ success: true, data: { path: dir } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── Token usage endpoints ──

  router.get('/api/token-usage', async (req: Request, res: Response) => {
    try {
      const { from, to, model, source: rawSource, project, limit: rawLimit, offset: rawOffset } = req.query;

      const source = rawSource && ['chat', 'import'].includes(rawSource as string)
        ? (rawSource as 'chat' | 'import')
        : undefined;

      const limit = rawLimit ? parseInt(rawLimit as string, 10) : undefined;
      if (limit !== undefined && (isNaN(limit) || limit < 0 || limit > 10000)) {
        res.status(400).json({ success: false, error: 'limit must be a number between 0 and 10000' });
        return;
      }

      const offset = rawOffset ? parseInt(rawOffset as string, 10) : undefined;
      if (offset !== undefined && (isNaN(offset) || offset < 0)) {
        res.status(400).json({ success: false, error: 'offset must be a non-negative number' });
        return;
      }

      const result = await tokenUsageService.getRecords({
        from: from as string | undefined,
        to: to as string | undefined,
        model: model as string | undefined,
        source,
        project: project as string | undefined,
        limit,
        offset,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/token-usage/summary', async (req: Request, res: Response) => {
    try {
      const { from, to, model, source: rawSource, project } = req.query;
      const source = rawSource && ['chat', 'import'].includes(rawSource as string)
        ? (rawSource as 'chat' | 'import')
        : undefined;

      const summary = await tokenUsageService.getSummary({
        from: from as string | undefined,
        to: to as string | undefined,
        model: model as string | undefined,
        source,
        project: project as string | undefined,
      });

      res.json({ success: true, data: summary });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/token-usage/models', async (_req: Request, res: Response) => {
    try {
      const models = await tokenUsageService.getModels();
      res.json({ success: true, data: models });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/token-usage/projects', async (_req: Request, res: Response) => {
    try {
      const projects = await tokenUsageService.getProjects();
      res.json({ success: true, data: projects });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/token-usage/retention', async (_req: Request, res: Response) => {
    try {
      const days = settingsStore.get('tokenUsageRetentionDays', 90);
      res.json({ success: true, data: { days } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/token-usage/retention', async (req: Request, res: Response) => {
    try {
      const { days } = req.body;
      if (typeof days !== 'number' || days < 1 || days > 365) {
        res.status(400).json({ success: false, error: 'days must be a number between 1 and 365' });
        return;
      }
      settingsStore.set('tokenUsageRetentionDays', days);
      res.json({ success: true, data: { days } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── Effort Config ──

  // ── Compaction settings ──

  router.get('/api/settings/compaction', (_req: Request, res: Response) => {
    try {
      const compaction = settingsStore.get('compaction');
      res.json({ success: true, data: compaction });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/settings/compaction', (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
        return;
      }

      const errors: string[] = [];

      if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
        errors.push('enabled must be a boolean');
      }
      if (body.thresholdPercent !== undefined) {
        if (typeof body.thresholdPercent !== 'number' || body.thresholdPercent < 50 || body.thresholdPercent > 90) {
          errors.push('thresholdPercent must be a number between 50 and 90');
        }
      }
      const validStrategies = ['summarize', 'truncate', 'sliding-window'];
      if (body.strategy !== undefined && !validStrategies.includes(body.strategy)) {
        errors.push(`strategy must be one of: ${validStrategies.join(', ')}`);
      }
      if (body.keepRecent !== undefined) {
        if (typeof body.keepRecent !== 'number' || body.keepRecent < 1 || body.keepRecent > 20) {
          errors.push('keepRecent must be a number between 1 and 20');
        }
      }
      if (body.useCustomModel !== undefined && typeof body.useCustomModel !== 'boolean') {
        errors.push('useCustomModel must be a boolean');
      }
      if (body.compactorProviderId !== undefined && typeof body.compactorProviderId !== 'string') {
        errors.push('compactorProviderId must be a string');
      }
      if (body.compactorModel !== undefined && typeof body.compactorModel !== 'string') {
        errors.push('compactorModel must be a string');
      }

      if (errors.length > 0) {
        res.status(400).json({ success: false, error: errors.join('; ') });
        return;
      }

      // Merge with existing settings instead of blindly overwriting
      const existing = settingsStore.get('compaction') || {};
      const merged = { ...existing, ...body };
      settingsStore.set('compaction', merged);
      res.json({ success: true, data: settingsStore.get('compaction') });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/effort-config', async (_req: Request, res: Response) => {
    try {
      const config = await getEffortConfig();
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/effort-options', async (req: Request, res: Response) => {
    try {
      const model = req.query.model as string;
      if (!model || typeof model !== 'string') {
        res.status(400).json({ success: false, error: 'model query parameter is required' });
        return;
      }
      const providerUrl = req.query.providerUrl as string | undefined;
      const providerApiKey = req.query.providerApiKey as string | undefined;
      const result = await resolveEffortOptions(model, providerUrl, providerApiKey);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/effort-config', async (req: Request, res: Response) => {
    try {
      const config = req.body;
      if (!config || typeof config !== 'object' || !Array.isArray(config.modelFamilies)) {
        res.status(400).json({ success: false, error: 'Invalid effort config: must include modelFamilies array' });
        return;
      }
      const validMechanisms = ['reasoning_effort', 'enable_thinking', 'thinking_type', 'always_on'];
      const isValid = config.modelFamilies.every(
        (e: any) => typeof e.pattern === 'string' && Array.isArray(e.efforts) && typeof e.default === 'string'
          && (e.mechanism === undefined || validMechanisms.includes(e.mechanism))
          && (e.thinkingBudgets === undefined || (typeof e.thinkingBudgets === 'object' && Object.values(e.thinkingBudgets).every((v: any) => v === null || typeof v === 'number')))
          && (e.alsoReasoningEffort === undefined || typeof e.alsoReasoningEffort === 'boolean')
      );
      if (!isValid) {
        res.status(400).json({ success: false, error: 'Invalid effort config: each modelFamily must have pattern (string), efforts (string[]), default (string), and optional mechanism, thinkingBudgets, alsoReasoningEffort' });
        return;
      }
      if (!config.fallback || typeof config.fallback !== 'object' || !Array.isArray(config.fallback.efforts) || typeof config.fallback.default !== 'string') {
        res.status(400).json({ success: false, error: 'Invalid effort config: fallback must have efforts (string[]) and default (string)' });
        return;
      }
      await setEffortConfig(config);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
