import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AiService } from '../../services/aiService';
import { FileService } from '../../services/fileService';
import { activeChatControllers, pendingEdits } from '../serverState';
import { handleChatStream } from '../chatStream';
import { normalizeHtml } from '../../services/tools/pageTools';

export function chatRoutes(aiService?: AiService): Router {
  const router = Router();

  // Chat SSE streaming — delegates to chatStream handler
  router.post('/api/chat', async (req: Request, res: Response) => {
    if (!aiService) {
      res.status(500).json({ success: false, error: 'AI service not available' });
      return;
    }
    await handleChatStream(req, res, aiService);
  });

  // Accept a pending edit — applies it to the book
  router.post('/api/chat/accept-edit', async (req: Request, res: Response) => {
    const { editId } = req.body as { editId: string };
    const pendingEdit = pendingEdits.get(editId);

    if (!pendingEdit) {
      res.status(404).json({ success: false, error: 'Pending edit not found' });
      return;
    }

    try {
      const { tool, args } = pendingEdit;
      const fs = new FileService(req.projectId, (args.bookId as string) || req.bookId || undefined);
      let finalContent: string;

      if (tool === 'editContent') {
        finalContent = normalizeHtml(args.content as string);
        await fs.saveBookContent(finalContent);
      } else if (tool === 'appendToContent') {
        const existing = await fs.getBookContent();
        finalContent = existing + '\n\n' + normalizeHtml(args.content as string);
        await fs.saveBookContent(finalContent);
      } else if (tool === 'editRange') {
        const existing = await fs.getBookContent();
        const find = args.find as string;
        const replacement = normalizeHtml(args.replace as string);
        if (find) {
          finalContent = existing.replace(find, replacement);
        } else {
          // Empty find: insert at end
          finalContent = existing + replacement;
        }
        await fs.saveBookContent(finalContent);
      } else if (tool === 'insertChapter') {
        const existing = await fs.getBookContent();
        const title = args.title as string;
        const chapterId = `ch-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const heading = `<h1 data-chapter-id="${chapterId}">${title}</h1>`;
        finalContent = existing ? existing + '\n\n' + heading : heading;
        await fs.saveBookContent(finalContent);
      } else if (tool === 'deleteChapter') {
        const existing = await fs.getBookContent();
        const chapterTitle = args.chapterTitle as string;
        const escapedTitle = chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          `<h[12][^>]*>\\s*${escapedTitle}\\s*<\\/h[12]>\\s*`,
          'i',
        );
        finalContent = existing.replace(pattern, '');
        await fs.saveBookContent(finalContent);
      } else {
        finalContent = '';
      }

      pendingEdits.delete(editId);
      res.json({ success: true, content: finalContent });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Reject a pending edit — discards it
  router.post('/api/chat/reject-edit', (req: Request, res: Response) => {
    const { editId } = req.body as { editId: string };
    if (!pendingEdits.has(editId)) {
      res.status(404).json({ success: false, error: 'Pending edit not found' });
      return;
    }
    pendingEdits.delete(editId);
    res.json({ success: true });
  });

  // Cancel in-flight chat request(s)
  router.post('/api/chat/cancel', (req: Request, res: Response) => {
    const { requestId } = req.body as { requestId?: string };

    if (requestId) {
      const controller = activeChatControllers.get(requestId);
      if (controller) {
        controller.abort();
        activeChatControllers.delete(requestId);
        res.json({ success: true });
      } else {
        res.json({ success: false, error: 'Request not found' });
      }
    } else if (activeChatControllers.size > 0) {
      for (const [id, controller] of activeChatControllers) {
        controller.abort();
        activeChatControllers.delete(id);
      }
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'No active chat requests' });
    }
  });

  // Chat history
  router.get('/api/chat/history', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const messages = await fileService.getChatHistory();
      res.json({ success: true, data: messages });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/chat/history', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      await fileService.saveChatHistory(req.body.messages ?? []);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
