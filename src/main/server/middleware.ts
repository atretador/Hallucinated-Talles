import type { Request, Response, NextFunction } from 'express';
import { isValidProjectId } from '../utils/pathValidation';

/**
 * Project ID middleware — future-proof for multi-book support.
 * Routes can use req.projectId instead of hardcoding 'default'.
 * Validates projectId to prevent path traversal attacks.
 */
export function projectIdMiddleware(req: Request & { projectId?: string }, res: Response, next: NextFunction): void {
  const raw = (req.headers['x-project-id'] as string) || 'default';
  if (!isValidProjectId(raw)) {
    res.status(400).json({ success: false, error: 'Invalid project ID' });
    return;
  }
  req.projectId = raw;
  next();
}

/**
 * Book ID middleware — reads from x-book-id header
 */
export function bookIdMiddleware(req: Request & { bookId?: string }, _res: Response, next: NextFunction): void {
  const header = req.headers['x-book-id'] as string | undefined;
  req.bookId = header || undefined;
  next();
}
