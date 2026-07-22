import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { FileService } from '../../services/fileService';
import { ImportService } from '../../services/importService';
import { StoryFormat } from '../../services/storyFormat';
import { exportBookToPdf } from '../../services/pdfExport';
import { getEffectiveProjectsDir } from '../../services/settings';
import type { AiService } from '../../services/aiService';
import { handleImportStream } from '../importStream';

export function importExportRoutes(aiService?: AiService): Router {
  const router = Router();

  // ── Import ──

  // Import endpoint — SSE streaming
  router.post('/api/import', async (req: Request, res: Response) => {
    if (!aiService) {
      res.status(500).json({ success: false, error: 'AI service not available' });
      return;
    }
    await handleImportStream(req, res, aiService);
  });

  // Page count endpoint
  router.get('/api/import/page-count', async (req: Request, res: Response) => {
    const filePath = req.query.filePath as string;
    if (!filePath) {
      res.status(400).json({ success: false, error: 'filePath query parameter is required' });
      return;
    }
    const resolvedPath = path.resolve(filePath);
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!['.pdf', '.docx', '.odt', '.txt'].includes(ext)) {
      res.status(400).json({ success: false, error: `Unsupported file extension: ${ext}` });
      return;
    }
    try {
      const importService = new ImportService();
      const totalPages = await importService.getPageCount(resolvedPath);
      res.json({ success: true, totalPages });
    } catch (err: any) {
      console.error('[page-count] Error:', err?.message);
      res.status(500).json({ success: false, error: err?.message || 'Failed to get page count' });
    }
  });

  // Import state (resume support)
  router.get('/api/import/state', async (req: Request, res: Response) => {
    try {
      const bookId = (req.query.bookId as string) || req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId query parameter is required' });
        return;
      }
      const fileService = new FileService(req.projectId, bookId);
      const importState = await fileService.getImportState();
      res.json({ success: true, data: importState || null });
    } catch {
      res.json({ success: true, data: null });
    }
  });

  // ── Export ──

  // Export book as plain text
  router.get('/api/export/text', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const book = await fileService.getBookStructure();
      const parts: string[] = [];

      parts.push(book.title);
      if (book.metadata.author) {
        parts.push(`by ${book.metadata.author}`);
      }
      parts.push('');
      parts.push('='.repeat(60));
      parts.push('');

      for (const item of book.items) {
        if (item.type === 'chapter') {
          parts.push(`# ${item.title}`);
          parts.push('');
        } else if (item.type === 'page') {
          const content = await fileService.getPageContent(item.id);
          if (content) {
            if (item.title) {
              parts.push(`## ${item.title}`);
              parts.push('');
            }
            parts.push(content);
            parts.push('');
          }
        }
      }

      const text = parts.join('\n');
      res.type('text/plain').send(text);
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Export book as PDF
  router.get('/api/export/pdf', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const book = await fileService.getBookStructure();

      const chapterContents: Array<{ title: string; sections: Array<{ title: string; content: string }> }> = [];
      let currentChapter: { title: string; sections: Array<{ title: string; content: string }> } | null = null;
      let firstChapterIdx = book.items.findIndex((i) => i.type === 'chapter');
      if (firstChapterIdx === -1) firstChapterIdx = book.items.length;

      for (let i = 0; i < firstChapterIdx; i++) {
        const item = book.items[i];
        if (item.type === 'page') {
          const content = await fileService.getPageContent(item.id);
          if (content) {
            if (!currentChapter) currentChapter = { title: '', sections: [] };
            currentChapter.sections.push({ title: item.title || 'Untitled', content });
          }
        }
      }
      if (currentChapter && currentChapter.sections.length > 0) {
        chapterContents.push(currentChapter);
        currentChapter = null;
      }

      for (const item of book.items) {
        if (item.type === 'chapter') {
          if (currentChapter && currentChapter.sections.length > 0) {
            chapterContents.push(currentChapter);
          }
          currentChapter = { title: item.title, sections: [] };
        } else if (item.type === 'page') {
          const content = await fileService.getPageContent(item.id);
          if (content && currentChapter) {
            currentChapter.sections.push({ title: item.title || 'Untitled', content });
          }
        }
      }
      if (currentChapter && currentChapter.sections.length > 0) {
        chapterContents.push(currentChapter);
      }

      const pdfBuffer = await exportBookToPdf(book, chapterContents, path.join(getEffectiveProjectsDir(), req.projectId, 'books', req.bookId || ''));

      const safeName = (book.title ?? 'book').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[export/pdf] Export failed:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Export book as .story ZIP archive
  router.get('/api/export/story', async (req: Request, res: Response) => {
    try {
      const bookId = (req.query.bookId as string) || req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId query parameter is required' });
        return;
      }
      if (bookId.includes('..') || path.isAbsolute(bookId)) {
        res.status(400).json({ success: false, error: 'Invalid bookId' });
        return;
      }

      const projectsDir = getEffectiveProjectsDir();
      const fileService = new FileService(req.projectId, bookId);
      const book = await fileService.getBookStructure();

      const bookDir = path.join(projectsDir, req.projectId, 'books', bookId);
      const buffer = await StoryFormat.exportToStory(bookDir, book);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${bookId}.story"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error('[export/story] Export failed:', error);
      if (error instanceof Error && (error.message.includes('ENOENT') || error.message.includes('not found'))) {
        res.status(400).json({ success: false, error: 'Book not found. Ensure the book exists.' });
      } else {
        res.status(500).json({ success: false, error: String(error) });
      }
    }
  });

  return router;
}
