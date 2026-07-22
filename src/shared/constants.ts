import type { BookSettings } from './types';

export const DEFAULT_BOOK_SETTINGS: BookSettings = {
  pageSize: { width: 210, height: 297 },  // A4
  margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },  // 1 inch
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 2.0,
};

// ── Book cover constants ──────────────────────────────────────────────

/** A4 at 300 DPI (print quality) */
export const COVER_DIMENSIONS = {
  frontCover: { width: 2480, height: 3508 },
  backCover:  { width: 2480, height: 3508 },
} as const;

export type CoverType = 'front-cover' | 'back-cover';

/** Allowed MIME types for cover images */
export const COVER_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

/** Tolerance in pixels for dimension validation (allows +-2%) */
export const COVER_DIMENSION_TOLERANCE = 0.02;
