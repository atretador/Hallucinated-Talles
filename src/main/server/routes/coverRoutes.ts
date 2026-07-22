import { Router, raw } from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { FileService } from '../../services/fileService';
import { getEffectiveProjectsDir } from '../../services/settings';
import { readCoverImage, getCoverPaths, deleteCover } from '../../services/coverService';
import { isWithinDirectory } from '../../utils/pathValidation';
import type { CoverType } from '../../../shared/constants';

export function coverRoutes(): Router {
  const router = Router();

  // ── Book Covers ──

  router.get('/api/book/covers', async (req: Request, res: Response) => {
    try {
      const bookId = req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId is required' });
        return;
      }
      const bookDir = path.join(getEffectiveProjectsDir(), req.projectId, 'books', bookId);
      const covers = await getCoverPaths(bookDir);
      res.json({
        success: true,
        data: { frontCover: !!covers.frontCover, backCover: !!covers.backCover },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/book/covers/:type', async (req: Request, res: Response) => {
    try {
      const coverType = req.params.type as string;
      if (coverType !== 'front-cover' && coverType !== 'back-cover') {
        res.status(400).json({ success: false, error: 'Invalid cover type. Must be "front-cover" or "back-cover".' });
        return;
      }
      const projectId = (req.query.projectId as string) || req.projectId;
      const bookId = (req.query.bookId as string) || req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId is required' });
        return;
      }
      const bookDir = path.join(getEffectiveProjectsDir(), projectId, 'books', bookId);
      // Security: validate path stays within projects directory
      if (!isWithinDirectory(bookDir, getEffectiveProjectsDir())) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }
      const buffer = await readCoverImage(bookDir, coverType as CoverType);
      if (!buffer) {
        res.status(404).json({ success: false, error: 'Cover not found' });
        return;
      }
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/book/covers/:type', raw({ type: ['image/png', 'image/jpeg'], limit: '20mb' }), async (req: Request, res: Response) => {
    try {
      const coverType = req.params.type as string;
      if (coverType !== 'front-cover' && coverType !== 'back-cover') {
        res.status(400).json({ success: false, error: 'Invalid cover type. Must be "front-cover" or "back-cover".' });
        return;
      }
      const bookId = req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId is required' });
        return;
      }
      if (!req.body || !Buffer.isBuffer(req.body)) {
        res.status(400).json({ success: false, error: 'No image data provided' });
        return;
      }

      const sharp = (await import('sharp')).default;
      const metadata = await sharp(req.body).metadata();
      const ext = metadata.format === 'jpeg' ? 'jpg' : (metadata.format || 'png');

      const { COVER_DIMENSIONS, COVER_DIMENSION_TOLERANCE } = await import('../../../shared/constants.js');
      const expected = COVER_DIMENSIONS.frontCover;
      if (!metadata.width || !metadata.height) {
        res.status(400).json({ success: false, error: 'Could not read image dimensions' });
        return;
      }
      const widthOk = Math.abs(metadata.width - expected.width) / expected.width <= COVER_DIMENSION_TOLERANCE;
      const heightOk = Math.abs(metadata.height - expected.height) / expected.height <= COVER_DIMENSION_TOLERANCE;
      if (!widthOk || !heightOk) {
        res.status(400).json({ success: false, error: `Image is ${metadata.width}×${metadata.height}px but expected ${expected.width}×${expected.height}px (A4 @ 300 DPI)` });
        return;
      }

      const bookDir = path.join(getEffectiveProjectsDir(), req.projectId, 'books', bookId);
      // Security: validate path stays within projects directory
      if (!isWithinDirectory(bookDir, getEffectiveProjectsDir())) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }
      const coversDir = path.join(bookDir, 'covers');
      await fs.promises.mkdir(coversDir, { recursive: true });
      const filePath = path.join(coversDir, `${coverType}.${ext}`);
      await fs.promises.writeFile(filePath, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/book/covers/:type', async (req: Request, res: Response) => {
    try {
      const coverType = req.params.type as string;
      if (coverType !== 'front-cover' && coverType !== 'back-cover') {
        res.status(400).json({ success: false, error: 'Invalid cover type. Must be "front-cover" or "back-cover".' });
        return;
      }
      const bookId = req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId is required' });
        return;
      }
      const bookDir = path.join(getEffectiveProjectsDir(), req.projectId, 'books', bookId);
      // Security: validate path stays within projects directory
      if (!isWithinDirectory(bookDir, getEffectiveProjectsDir())) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }
      const deleted = await deleteCover(bookDir, coverType as CoverType);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Cover not found' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── Content Images ──

  router.get('/api/book/images/:chapterId/:filename', async (req: Request, res: Response) => {
    try {
      const bookId = req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId is required' });
        return;
      }

      const chapterId = req.params.chapterId as string;
      const filename = req.params.filename as string;

      if (chapterId.includes('..') || filename.includes('..')) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }

      const projectsDir = getEffectiveProjectsDir();
      const filePath = path.join(projectsDir, req.projectId, 'books', bookId, 'images', chapterId, filename);

      const bookDir = path.join(projectsDir, req.projectId, 'books', bookId);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(bookDir))) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }

      try {
        const data = await fs.promises.readFile(resolved);
        const ext = path.extname(filename).toLowerCase();
        const contentTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
        };
        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
        res.setHeader('Content-Length', data.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(data);
      } catch {
        res.status(404).json({ success: false, error: 'Image not found' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/book/images/:chapterId/:filename', async (req: Request, res: Response) => {
    try {
      const bookId = req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId is required' });
        return;
      }

      const chapterId = req.params.chapterId as string;
      const filename = req.params.filename as string;

      if (chapterId.includes('..') || filename.includes('..')) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }

      const projectsDir = getEffectiveProjectsDir();
      const filePath = path.join(projectsDir, req.projectId, 'books', bookId, 'images', chapterId, filename);

      const bookDir = path.join(projectsDir, req.projectId, 'books', bookId);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(bookDir))) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }

      try {
        await fs.promises.unlink(resolved);
        res.json({ success: true });
      } catch {
        res.status(404).json({ success: false, error: 'Image not found' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/book/images/cleanup', async (req: Request, res: Response) => {
    try {
      const bookId = req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId is required' });
        return;
      }

      const fileService = new FileService(req.projectId, bookId);
      const book = await fileService.getBookStructure();

      const htmlContents: string[] = [];
      for (const item of book.items) {
        if (item.type !== 'page') continue;
        const content = await fileService.getPageContent(item.id);
        if (content) htmlContents.push(content);
      }

      const deleted = await fileService.cleanupOrphanedImages(htmlContents);
      res.json({ success: true, data: { deleted } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/book/images/:chapterId', async (req: Request, res: Response) => {
    try {
      const bookId = req.bookId;
      if (!bookId) {
        res.status(400).json({ success: false, error: 'bookId is required' });
        return;
      }

      const chapterId = req.params.chapterId as string;
      if (chapterId.includes('..')) {
        res.status(400).json({ success: false, error: 'Invalid path' });
        return;
      }

      const projectsDir = getEffectiveProjectsDir();
      const imagesDir = path.join(projectsDir, req.projectId, 'books', bookId, 'images', chapterId);

      try {
        const entries = await fs.promises.readdir(imagesDir, { withFileTypes: true });
        const images = entries
          .filter(e => e.isFile())
          .map(e => ({
            filename: e.name,
            url: `/api/book/images/${chapterId}/${encodeURIComponent(e.name)}`,
          }));
        res.json({ success: true, data: images });
      } catch {
        res.json({ success: true, data: [] });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
