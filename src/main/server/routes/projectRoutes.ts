import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { FileService } from '../../services/fileService';
import { getEffectiveProjectsDir, isProjectsDirConfigured } from '../../services/settings';
import { getCoverPaths } from '../../services/coverService';
import { getProjectAiSelections, saveProjectAiSelections } from '../../services/projectAiSelections';
import type { AiService } from '../../services/aiService';
import type { Book } from '../../../shared/types';

export function projectRoutes(deps?: { aiService?: AiService }): Router {
  const router = Router();

  // App status — used by renderer on startup to determine which view to show
  router.get('/api/app-status', (_req: Request, res: Response) => {
    try {
      const llmConfigured = deps?.aiService ? deps.aiService.isConfigured() : false;
      const projectsDirConfigured = isProjectsDirConfigured();
      const projectsDir = getEffectiveProjectsDir();
      res.json({
        success: true,
        data: { llmConfigured, projectsDirConfigured, projectsDir },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Project routes (legacy — returns book structure for the active book)
  router.get('/api/project', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const book = await fileService.getBookStructure();
      res.json({ success: true, data: book });
    } catch (error) {
      console.error('[project] Failed to load project:', error);
      res.status(404).json({ success: false, error: 'Book not found. Select a book first.' });
    }
  });

  // Book structure
  router.get('/api/book', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const book = await fileService.getBookStructure();
      res.json({ success: true, data: book });
    } catch (error) {
      console.error('[book] Failed to load book:', error);
      res.json({ success: true, data: null });
    }
  });

  // Save full book content (single-document model)
  router.put('/api/book/content', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      await fileService.saveBookContent(req.body.content);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Load full book content (single-document model)
  router.get('/api/book/content', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const content = await fileService.getBookContent();
      res.json({ success: true, data: { content } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/book', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      await fileService.saveBookStructure(req.body as Book);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Book settings
  router.get('/api/book/settings', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const settings = await fileService.getBookSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/book/settings', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      await fileService.saveBookSettings(req.body.settings);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // List all books/projects
  router.get('/api/books', async (_req: Request, res: Response) => {
    try {
      const projects = await FileService.listProjects();
      const books = [];
      for (const name of projects) {
        try {
          const bookList = await FileService.listBooks(name);
          if (bookList.length > 0) {
            const fs = new FileService(name, bookList[0]);
            const structure = await fs.getBookStructure();
            let coverUrl: string | undefined;
            try {
              const bookDir = path.join(getEffectiveProjectsDir(), name, 'books', bookList[0]);
              const covers = await getCoverPaths(bookDir);
              if (covers.frontCover) {
                coverUrl = `/api/book/covers/front-cover?projectId=${encodeURIComponent(name)}&bookId=${encodeURIComponent(bookList[0])}`;
              }
            } catch {
              console.debug('[projectRoutes] No covers found');
              // No covers
            }
            books.push({ id: name, title: structure.title ?? name, description: structure.metadata?.description ?? '', bookCount: bookList.length, coverUrl });
          } else {
            books.push({ id: name, title: name, description: '', bookCount: 0 });
          }
        } catch {
          books.push({ id: name, title: name, description: '', bookCount: 0 });
        }
      }
      res.json({ success: true, data: books });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Per-project AI selections
  router.get('/api/project/ai-selections', async (req: Request, res: Response) => {
    try {
      const selections = await getProjectAiSelections(req.projectId);
      res.json({ success: true, data: selections });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/project/ai-selections', async (req: Request, res: Response) => {
    try {
      const { providerId, model, effort } = req.body;
      if (!providerId || !model) {
        res.status(400).json({ success: false, error: 'providerId and model are required' });
        return;
      }
      await saveProjectAiSelections(req.projectId, { providerId, model, effort: effort ?? 'medium' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // List books in a project
  router.get('/api/project/books', async (req: Request, res: Response) => {
    try {
      const books = await FileService.listBooks(req.projectId);
      const bookList = [];
      for (const bookId of books) {
        try {
          const fs = new FileService(req.projectId, bookId);
          const structure = await fs.getBookStructure();
          const bookDir = path.join(getEffectiveProjectsDir(), req.projectId, 'books', bookId);
          const covers = await getCoverPaths(bookDir);
          const coverUrl = covers.frontCover
            ? `/api/book/covers/front-cover?projectId=${encodeURIComponent(req.projectId)}&bookId=${encodeURIComponent(bookId)}`
            : undefined;
          bookList.push({
            id: bookId,
            title: structure.title ?? bookId,
            description: structure.metadata?.description ?? '',
            systemPrompt: structure.systemPrompt ?? '',
            coverUrl,
          });
        } catch {
          bookList.push({ id: bookId, title: bookId, description: '', systemPrompt: '' });
        }
      }
      res.json({ success: true, data: bookList });
    } catch (error) {
      res.json({ success: true, data: [] });
    }
  });

  // Create a new book in a project
  router.post('/api/project/books', async (req: Request, res: Response) => {
    try {
      const { title, description, systemPrompt } = req.body;
      if (!title || typeof title !== 'string') {
        res.status(400).json({ success: false, error: 'title is required' });
        return;
      }
      const bookId = title.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '-').toLowerCase();
      if (!bookId) {
        res.status(400).json({ success: false, error: 'Invalid title' });
        return;
      }
      const existingBooks = await FileService.listBooks(req.projectId);
      if (existingBooks.includes(bookId)) {
        res.status(409).json({ success: false, error: `A book with ID "${bookId}" already exists` });
        return;
      }
      await FileService.createBook(req.projectId, bookId, title.trim(), description ?? '', systemPrompt ?? '');
      res.json({ success: true, data: { id: bookId, title: title.trim() } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Update a book's metadata
  router.patch('/api/project/books/:bookId', async (req: Request, res: Response) => {
    try {
      const bookId = req.params.bookId as string;
      const { title, description, systemPrompt } = req.body;
      const fs = new FileService(req.projectId, bookId);
      const book = await fs.getBookStructure();
      if (title !== undefined) book.title = title;
      if (description !== undefined) book.metadata.description = description;
      if (systemPrompt !== undefined) book.systemPrompt = systemPrompt;
      await fs.saveBookStructure(book);
      res.json({ success: true, data: { id: bookId, title: book.title } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Rename a project
  router.patch('/api/books/:projectId', async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const { title, description } = req.body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ success: false, error: 'title is required' });
        return;
      }
      const fsp = await import('node:fs/promises');
      const projectDir = path.join(getEffectiveProjectsDir(), projectId);
      try {
        await fsp.access(projectDir);
      } catch {
        res.status(404).json({ success: false, error: 'Project not found' });
        return;
      }
      const bookList = await FileService.listBooks(projectId);
      const desc = typeof description === 'string' ? description.trim() : undefined;
      for (const bookId of bookList) {
        try {
          const bookJsonPath = path.join(projectDir, 'books', bookId, 'book.json');
          const data = JSON.parse(await fsp.readFile(bookJsonPath, 'utf-8'));
          data.title = title.trim();
          if (desc !== undefined) {
            data.metadata = data.metadata ?? {};
            data.metadata.description = desc;
          }
          await fsp.writeFile(bookJsonPath, JSON.stringify(data, null, 2));
        } catch {
          console.debug('[projectRoutes] Failed to read book, skipping');
          // Skip books that can't be read
        }
      }
      res.json({ success: true, data: { id: projectId, title: title.trim(), description: desc ?? '' } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Delete a project
  router.delete('/api/books/:projectId', async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId as string;
      const fsp = await import('node:fs/promises');
      const projectDir = path.join(getEffectiveProjectsDir(), projectId);
      try {
        await fsp.access(projectDir);
      } catch {
        res.status(404).json({ success: false, error: 'Project not found' });
        return;
      }
      await fsp.rm(projectDir, { recursive: true, force: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Delete a book from a project
  router.delete('/api/project/books/:bookId', async (req: Request, res: Response) => {
    try {
      const fs = await import('node:fs/promises');
      const bookDir = path.join(getEffectiveProjectsDir(), req.projectId, 'books', req.params.bookId as string);
      await fs.rm(bookDir, { recursive: true, force: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Create a new project
  router.post('/api/book', async (req: Request, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title || typeof title !== 'string') {
        res.status(400).json({ success: false, error: 'title is required' });
        return;
      }
      const name = title.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '-').toLowerCase();
      if (!name) {
        res.status(400).json({ success: false, error: 'Invalid title' });
        return;
      }
      await FileService.createProject(name);
      res.json({ success: true, data: { id: name, title: title.trim(), description: typeof description === 'string' ? description.trim() : '' } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Page content
  router.get('/api/pages/:pageId', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const pageId = req.params.pageId as string;
      const content = await fileService.getPageContent(pageId);
      res.json({ success: true, data: content });
    } catch (error) {
      console.error(`[pages] Failed to load page ${req.params.pageId}:`, error);
      res.json({ success: true, data: '' });
    }
  });

  router.put('/api/pages/:pageId', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const pageId = req.params.pageId as string;
      await fileService.savePageContent(pageId, req.body.content);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Create a new page (optionally after a specific page, with optional content)
  router.post('/api/pages', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const { title, chapterId, afterPageId, content } = req.body as {
        title?: string;
        chapterId?: string;
        afterPageId?: string;
        content?: string;
      };
      const newPage = await fileService.createPage(title, chapterId, afterPageId, content);
      // Reload book structure so the caller gets the updated items
      const book = await fileService.getBookStructure();
      res.json({ success: true, data: { page: newPage, book } });
    } catch (error) {
      console.error('[pages] Failed to create page:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Chapter image upload
  router.post('/api/chapters/:chapterId/images', async (req: Request, res: Response) => {
    try {
      const chapterId = req.params.chapterId as string;
      if (!chapterId || chapterId.includes('..') || chapterId.includes('/') || chapterId.includes('\\')) {
        res.status(400).json({ success: false, error: 'Invalid chapterId' });
        return;
      }
      const { dataUrl, filename } = req.body as { dataUrl?: string; filename?: string };
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.status(400).json({ success: false, error: 'dataUrl is required (data:image/...;base64,...)' });
        return;
      }
      const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ success: false, error: 'Invalid data URL format' });
        return;
      }
      const mime = match[1];
      const base64 = match[2];
      const buffer = Buffer.from(base64, 'base64');
      const ext = mime.replace('image/', '.');
      const safeFilename = (filename || `image${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const relativePath = await fileService.saveImage(chapterId, safeFilename, buffer);
      res.json({ success: true, data: { path: relativePath } });
    } catch (error) {
      console.error('[images] Failed to save chapter image:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Serve chapter images
  router.get('/api/chapters/:chapterId/images/:filename', async (req: Request, res: Response) => {
    try {
      const chapterId = req.params.chapterId as string;
      const filename = req.params.filename as string;
      if (!chapterId || chapterId.includes('..') || chapterId.includes('/') || chapterId.includes('\\')
          || !filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const relativePath = `images/${chapterId}/${filename}`;
      const absPath = fileService.getImagePath(relativePath);
      const fs = await import('node:fs/promises');
      const buffer = await fs.readFile(absPath);
      const ext = filename.split('.').pop()?.toLowerCase() || 'png';
      const contentTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      res.setHeader('Content-Type', contentTypes[ext] || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error) {
      res.status(404).json({ success: false, error: 'Image not found' });
    }
  });

  // Chapter content (all pages in chapter)
  router.get('/api/chapters/:chapterId/content', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const book = await fileService.getBookStructure();
      const chapterId = req.params.chapterId as string;
      const pagesUnderChapter: Array<{ id: string; title: string; content: string; order: number }> = [];
      let order = 0;
      for (const item of book.items) {
        if (item.type === 'chapter' && item.id === chapterId) {
          order++;
          continue;
        }
        if (item.type === 'page') {
          const content = await fileService.getPageContent(item.id);
          pagesUnderChapter.push({
            id: item.id,
            title: item.title || 'Untitled',
            content,
            order: order++,
          });
        }
      }
      res.json({
        success: true,
        data: { chapterId, pages: pagesUnderChapter },
      });
    } catch (error) {
      console.error(`[chapters] Failed to load chapter content ${req.params.chapterId}:`, error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Load all content of a book
  router.get('/api/books/:bookId/content', async (req: Request, res: Response) => {
    try {
      const bookId = req.params.bookId as string;
      const fileService = new FileService(req.projectId, bookId);
      const book = await fileService.getBookStructure();
      const pages: Array<{ id: string; title: string; content: string; order: number }> = [];
      let order = 0;
      for (const item of book.items) {
        if (item.type === 'page') {
          const content = await fileService.getPageContent(item.id);
          pages.push({
            id: item.id,
            title: item.title || 'Untitled',
            content,
            order: order++,
          });
        }
      }
      res.json({
        success: true,
        data: { bookId, bookTitle: book.title, pages },
      });
    } catch (error) {
      console.error(`[books] Failed to load book content ${req.params.bookId}:`, error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
