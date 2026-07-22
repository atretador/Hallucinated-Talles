import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { COVER_DIMENSIONS, COVER_DIMENSION_TOLERANCE, COVER_MIME_TYPES } from '../../shared/constants';
import type { CoverType } from '../../shared/constants';
import type { BookCover } from '../../shared/types';

/** Solid placeholder color — warm neutral gray */
const PLACEHOLDER_COLOR = { r: 200, g: 195, b: 188 };

const COVER_FILENAMES: Record<CoverType, string> = {
  'front-cover': 'front-cover.png',
  'back-cover': 'back-cover.png',
};

/**
 * Generate placeholder cover images for a new book.
 * Creates solid-color A4-sized PNGs in `<bookDir>/covers/`.
 */
export async function generatePlaceholderCovers(bookDir: string): Promise<BookCover> {
  const coversDir = path.join(bookDir, 'covers');
  await fs.mkdir(coversDir, { recursive: true });

  const frontPath = path.join(coversDir, COVER_FILENAMES['front-cover']);
  const backPath = path.join(coversDir, COVER_FILENAMES['back-cover']);

  const { width, height } = COVER_DIMENSIONS.frontCover;

  // Generate both covers in parallel
  await Promise.all([
    sharp({
      create: {
        width,
        height,
        channels: 3,
        background: PLACEHOLDER_COLOR,
      },
    })
      .png()
      .toFile(frontPath),

    sharp({
      create: {
        width,
        height,
        channels: 3,
        background: PLACEHOLDER_COLOR,
      },
    })
      .png()
      .toFile(backPath),
  ]);

  return {
    frontCover: COVER_FILENAMES['front-cover'],
    backCover: COVER_FILENAMES['back-cover'],
  };
}

/**
 * Validate that an image file matches the expected A4 cover dimensions.
 * Returns `{ valid: true }` or `{ valid: false, message }`.
 */
export async function validateCoverDimensions(
  imagePath: string,
): Promise<{ valid: true } | { valid: false; message: string }> {
  try {
    const metadata = await sharp(imagePath).metadata();
    const { width, height, format } = metadata;

    if (!width || !height) {
      return { valid: false, message: 'Could not read image dimensions' };
    }

    // Check format
    if (format && !COVER_MIME_TYPES.some((m) => m.endsWith(format))) {
      return {
        valid: false,
        message: `Unsupported format: ${format}. Use PNG or JPEG.`,
      };
    }

    // Check dimensions with tolerance
    const expected = COVER_DIMENSIONS.frontCover;
    const widthOk = Math.abs(width - expected.width) / expected.width <= COVER_DIMENSION_TOLERANCE;
    const heightOk = Math.abs(height - expected.height) / expected.height <= COVER_DIMENSION_TOLERANCE;

    if (!widthOk || !heightOk) {
      return {
        valid: false,
        message: `Image is ${width}×${height}px but expected ${expected.width}×${expected.height}px (A4 @ 300 DPI)`,
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      message: `Cannot read image: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Get cover file paths for a book. Returns paths only if files exist.
 */
export async function getCoverPaths(
  bookDir: string,
): Promise<{ frontCover?: string; backCover?: string }> {
  const coversDir = path.join(bookDir, 'covers');
  const result: { frontCover?: string; backCover?: string } = {};

  try {
    const frontPath = path.join(coversDir, COVER_FILENAMES['front-cover']);
    await fs.access(frontPath);
    result.frontCover = frontPath;
  } catch {
    console.debug('[coverService] No front cover');
    // No front cover
  }

  try {
    const backPath = path.join(coversDir, COVER_FILENAMES['back-cover']);
    await fs.access(backPath);
    result.backCover = backPath;
  } catch {
    console.debug('[coverService] No back cover');
    // No back cover
  }

  return result;
}

/**
 * Get cover as a Buffer for serving via API.
 */
export async function readCoverImage(
  bookDir: string,
  coverType: CoverType,
): Promise<Buffer | null> {
  const filePath = path.join(bookDir, 'covers', COVER_FILENAMES[coverType]);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Delete a cover image.
 */
export async function deleteCover(
  bookDir: string,
  coverType: CoverType,
): Promise<boolean> {
  const filePath = path.join(bookDir, 'covers', COVER_FILENAMES[coverType]);
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
