import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AiService } from '../../services/aiService';
import { maskApiKey } from '../utils';

export function aiRoutes(aiService?: AiService): Router {
  const router = Router();

  // AI status & configuration
  router.get('/api/ai/status', (_req: Request, res: Response) => {
    if (!aiService) {
      res.status(500).json({ success: false, error: 'AI service not available' });
      return;
    }
    const settings = aiService.getSettings();
    const currentProvider = settings.providers.find(p => p.id === settings.activeProviderId);
    res.json({
      success: true,
      configured: aiService.isConfigured(),
      config: aiService.getConfig(),
      settings,
      activeProvider: currentProvider
        ? { id: currentProvider.id, name: currentProvider.name }
        : null,
      activeModel: settings.activeModel,
    });
  });

  router.post('/api/ai/configure', (req: Request, res: Response) => {
    try {
      if (!aiService) {
        res.status(500).json({ success: false, error: 'AI service not available' });
        return;
      }
      if (req.body.providers !== undefined) {
        aiService.saveSettings(req.body);
      } else {
        aiService.configure(req.body);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Multi-provider CRUD
  router.get('/api/ai/providers', (_req: Request, res: Response) => {
    if (!aiService) {
      res.status(500).json({ success: false, error: 'AI service not available' });
      return;
    }
    const settings = aiService.getSettings();
    const masked = settings.providers.map(p => ({
      ...p,
      apiKey: maskApiKey(p.apiKey),
    }));
    res.json({ success: true, data: masked });
  });

  router.post('/api/ai/providers', (req: Request, res: Response) => {
    try {
      if (!aiService) {
        res.status(500).json({ success: false, error: 'AI service not available' });
        return;
      }
      const settings = aiService.getSettings();
      const provider = req.body;
      if (!provider.id) {
        provider.id = `provider-${Date.now()}`;
      }
      settings.providers.push(provider);
      aiService.saveSettings(settings);
      res.json({ success: true, data: { ...provider, apiKey: maskApiKey(provider.apiKey) } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/ai/providers/:id', (req: Request, res: Response) => {
    try {
      if (!aiService) {
        res.status(500).json({ success: false, error: 'AI service not available' });
        return;
      }
      const settings = aiService.getSettings();
      const index = settings.providers.findIndex(p => p.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'Provider not found' });
        return;
      }
      const updates = req.body;
      settings.providers[index] = { ...settings.providers[index], ...updates };
      aiService.saveSettings(settings);
      res.json({ success: true, data: { ...settings.providers[index], apiKey: maskApiKey(settings.providers[index].apiKey) } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/ai/providers/:id', (req: Request, res: Response) => {
    try {
      if (!aiService) {
        res.status(500).json({ success: false, error: 'AI service not available' });
        return;
      }
      const settings = aiService.getSettings();
      const index = settings.providers.findIndex(p => p.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'Provider not found' });
        return;
      }
      settings.providers.splice(index, 1);
      if (settings.activeProviderId === req.params.id) {
        settings.activeProviderId = settings.providers[0]?.id ?? '';
        settings.activeModel = settings.providers[0]?.models[0] ?? '';
      }
      aiService.saveSettings(settings);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/ai/active', (req: Request, res: Response) => {
    try {
      if (!aiService) {
        res.status(500).json({ success: false, error: 'AI service not available' });
        return;
      }
      const { providerId, model } = req.body as { providerId: string; model: string };
      aiService.setActiveProvider(providerId, model);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Update first-chunk timeout
  router.post('/api/ai/timeout', (req: Request, res: Response) => {
    try {
      if (!aiService) {
        res.status(500).json({ success: false, error: 'AI service not available' });
        return;
      }
      const { firstChunkTimeoutSec } = req.body as { firstChunkTimeoutSec: number };
      if (typeof firstChunkTimeoutSec !== 'number' || firstChunkTimeoutSec < 5 || firstChunkTimeoutSec > 3600) {
        res.status(400).json({ success: false, error: 'Timeout must be a number between 5 and 3600 seconds' });
        return;
      }
      const settings = aiService.getSettings();
      settings.firstChunkTimeoutSec = firstChunkTimeoutSec;
      aiService.saveSettings(settings);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Discover models from provider
  router.post('/api/ai/discover-models', async (req: Request, res: Response) => {
    try {
      const { baseUrl, apiKey } = req.body as { baseUrl: string; apiKey?: string };
      if (!baseUrl) {
        res.status(400).json({ success: false, error: 'baseUrl is required' });
        return;
      }

      const cleanBase = baseUrl.replace(/\/+$/, '');
      const candidates = [
        `${cleanBase}/v1/models`,
        `${cleanBase}/models`,
        `${cleanBase}/openai/v1/models`,
      ];

      let lastError = '';
      for (const url of candidates) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);

          const fetchRes = await fetch(url, { headers, signal: controller.signal });
          clearTimeout(timeout);

          if (!fetchRes.ok) {
            lastError = `HTTP ${fetchRes.status}`;
            continue;
          }

          const json: unknown = await fetchRes.json();

          let models: { id: string }[];
          if (Array.isArray(json)) {
            models = json as { id: string }[];
          } else if (json && typeof json === 'object' && 'data' in json && Array.isArray((json as { data: unknown }).data)) {
            models = (json as { data: { id: string }[] }).data;
          } else {
            lastError = 'Unrecognized response format';
            continue;
          }

          const ids = models
            .filter((m) => typeof m.id === 'string')
            .map((m) => m.id);

          const contextLengths: Record<string, number> = {};
          for (const m of models) {
            if (typeof m.id !== 'string') continue;
            const anyM = m as Record<string, unknown>;
            const ctx =
              (typeof anyM.context_length === 'number' ? anyM.context_length : undefined) ??
              (typeof anyM.max_model_len === 'number' ? anyM.max_model_len : undefined) ??
              (() => {
                const meta = anyM.meta;
                return (meta && typeof meta === 'object' && typeof (meta as Record<string, unknown>).n_ctx === 'number')
                  ? (meta as Record<string, unknown>).n_ctx as number
                  : undefined;
              })();
            if (typeof ctx === 'number' && ctx > 0) {
              contextLengths[m.id] = ctx;
            }
          }

          if (ids.length > 0) {
            res.json({ success: true, models: ids, contextLengths });
            return;
          }

          lastError = 'No models found in response';
        } catch (err) {
          lastError = String(err);
          continue;
        }
      }

      res.status(502).json({
        success: false,
        error: `Could not discover models: ${lastError}`,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
