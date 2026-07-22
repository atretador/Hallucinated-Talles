import { Router } from 'express';
import type { Request, Response } from 'express';
import { FileService } from '../../services/fileService';

export function planRoutes(): Router {
  const router = Router();

  router.get('/api/plan', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const plan = await fileService.getPlan();
      res.json({ success: true, data: plan });
    } catch (error) {
      console.error('[plan] Failed to load plan:', error);
      res.json({ success: true, data: null });
    }
  });

  router.put('/api/plan', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      await fileService.savePlan(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
