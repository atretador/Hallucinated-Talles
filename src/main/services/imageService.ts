import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { isWithinDirectory } from '../utils/pathValidation';

export class ImageService {
  private projectDir: string;
  private bookId: string;

  constructor(projectDir: string, bookId: string) {
    this.projectDir = projectDir;
    this.bookId = bookId;
  }

  private getBookDir(): string {
    return path.join(this.projectDir, 'books', this.bookId);
  }

  /**
   * Save an image buffer to the book's images directory.
   * Optimises with sharp (resize max 2000px width, JPEG quality 85)
   * and returns a relative path like "images/<chapterId>/<uuid>.jpg".
   */
  async saveImage(chapterId: string, filename: string, buffer: Buffer): Promise<string> {
    const imagesDir = path.join(this.getBookDir(), 'images', chapterId);
    await fs.mkdir(imagesDir, { recursive: true });

    // Determine output extension from the processed format
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    const outName = `${randomUUID()}${ext}`;
    const outPath = path.join(imagesDir, outName);

    // Optimise with sharp: resize max 2000px width, JPEG quality 85
    const sharpInstance = sharp(buffer).resize({ width: 2000, withoutEnlargement: true });

    if (ext === '.jpg' || ext === '.jpeg') {
      await sharpInstance.jpeg({ quality: 85 }).toFile(outPath);
    } else if (ext === '.png') {
      await sharpInstance.png().toFile(outPath);
    } else if (ext === '.webp') {
      await sharpInstance.webp({ quality: 85 }).toFile(outPath);
    } else {
      // Fallback: optimise as JPEG
      await sharpInstance.jpeg({ quality: 85 }).toFile(outPath);
    }

    return path.join('images', chapterId, outName);
  }

  /**
   * Get the absolute path for a relative image path.
   * Validates that the resolved path stays within the book directory.
   */
  getImagePath(relativePath: string): string {
    const bookDir = this.getBookDir();
    const absPath = path.join(bookDir, relativePath);
    // Security: prevent path traversal — resolved path must stay within bookDir
    if (!isWithinDirectory(absPath, bookDir)) {
      throw new Error('Image path escapes book directory');
    }
    return absPath;
  }

  /**
   * Delete an image file by relative path.
   */
  async deleteImage(relativePath: string): Promise<void> {
    try {
      await fs.unlink(this.getImagePath(relativePath));
    } catch {
      console.debug('[imageService] File does not exist or already deleted, ignoring');
      // File doesn't exist or already deleted — ignore
    }
  }

  /**
   * Scan HTML content for <img> tags, collect referenced image paths,
   * delete any image files not referenced.
   * Returns the count of deleted files.
   */
  async cleanupOrphanedImages(htmlContents: string[]): Promise<number> {
    // Collect all referenced image paths from HTML
    const referencedPaths = new Set<string>();
    for (const html of htmlContents) {
      const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
      let match: RegExpExecArray | null;
      while ((match = imgRegex.exec(html)) !== null) {
        const src = match[1];
        // Only track relative paths that start with "images/"
        if (src.startsWith('images/')) {
          referencedPaths.add(src);
        }
      }
    }

    // List all files in the images directory recursively
    const imagesDir = path.join(this.getBookDir(), 'images');
    const allFiles: string[] = [];
    try {
      const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else {
            // Store relative path from bookDir
            allFiles.push(path.relative(this.getBookDir(), full));
          }
        }
      };
      await walk(imagesDir);
    } catch {
      // No images directory — nothing to clean
      return 0;
    }

    // Delete files not referenced
    let deleted = 0;
    for (const filePath of allFiles) {
      if (!referencedPaths.has(filePath)) {
        try {
          await fs.unlink(path.join(this.getBookDir(), filePath));
          deleted++;
        } catch {
          console.debug('[imageService] Ignore per-file errors');
          // Ignore per-file errors
        }
      }
    }

    return deleted;
  }
}
