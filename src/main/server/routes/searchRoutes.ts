import { Router } from 'express';
import type { Request, Response } from 'express';
import { FileService } from '../../services/fileService';

export function searchRoutes(): Router {
  const router = Router();

  router.get('/api/search', async (req: Request, res: Response) => {
    try {
      const rawQuery = req.query.q;
      const query = typeof rawQuery === 'string' ? rawQuery : '';
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const book = await fileService.getBookStructure();
      const results: { pageId: string; title: string; preview: string }[] = [];

      for (const item of book.items) {
        if (item.type !== 'page') continue;
        const content = await fileService.getPageContent(item.id);
        if (content.toLowerCase().includes(query.toLowerCase())) {
          const index = content.toLowerCase().indexOf(query.toLowerCase());
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + query.length + 50);
          results.push({
            pageId: item.id,
            title: item.title || 'Untitled',
            preview: content.slice(start, end),
          });
        }
      }

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('[search] Search failed:', error);
      res.json({ success: true, data: [] });
    }
  });

  return router;
}
