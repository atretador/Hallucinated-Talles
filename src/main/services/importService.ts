import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

/**
 * Resolve the pdf.worker.mjs path.
 * In development: alongside the build output via import.meta.url
 * In packaged app: inside app.asar.unpacked (where the vite plugin + asarUnpacked puts it)
 */
function getPdfWorkerSrc(): string {
  // import.meta.url points to out/main/index.mjs, worker is out/main/pdf.worker.mjs
  // So the worker is a sibling (./pdf.worker.mjs), not one level up (../pdf.worker.mjs)
  try {
    const url = new URL('./pdf.worker.mjs', import.meta.url).href;
    // In packaged asar, import.meta.url resolves inside asar which import() can't read.
    // Check if we're inside an asar — if so, use the unpacked path.
    if (!url.includes('app.asar')) return url;
    const unpacked = url.replace('app.asar', 'app.asar.unpacked');
    return unpacked;
  } catch {
    return path.resolve(__dirname, 'pdf.worker.mjs');
  }
}
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import JSZip from 'jszip';
import { DEFAULT_BOOK_SETTINGS } from '../../shared/constants';
import type { BookSettings, ImportFormat } from '../../shared/types';

export interface ParsedPage {
  pageNumber: number;
  content: string; // markdown content
  isChapterStart?: boolean;
  chapterTitle?: string;
  chapterNumber?: number;
  images?: string[]; // Base64 data URLs of embedded images on this page
}

export interface ParsedBook {
  settings: BookSettings;
  pages: ParsedPage[];
  totalPages: number;
  format: ImportFormat;
  filename: string;
}

export class ImportService {
  constructor() {
    // Instance-based for future dependency injection
  }

  /**
   * Parse a file into pages with settings extraction
   */
  async parseFile(filePath: string): Promise<ParsedBook> {
    // Validate file exists and is readable
    try {
      const stat = await fs.stat(filePath);
      if (stat.size === 0) {
        throw new Error(`File is empty: ${filePath}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('File is empty')) {
        throw err;
      }
      throw new Error(`File not found or not readable: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);

    switch (ext) {
      case '.pdf':
        return this.parsePdf(filePath, filename);
      case '.docx':
        return this.parseDocx(filePath, filename);
      case '.odt':
        return this.parseOdt(filePath, filename);
      case '.txt':
        return this.parseTxt(filePath, filename);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  /**
   * Quick page count detection — much faster than full parseFile.
   * For PDFs, uses getInfo() which doesn't extract text.
   * For other formats, does a lightweight parse.
   */
  async getPageCount(filePath: string): Promise<number> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size === 0) throw new Error(`File is empty: ${filePath}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('File is empty')) throw err;
      throw new Error(`File not found or not readable: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      // Point pdfjs to the worker file bundled alongside the main process output
      PDFParse.setWorker(getPdfWorkerSrc());
      const parser = new PDFParse({ url: filePath });
      try {
        const info = await parser.getInfo();
        return info.total;
      } finally {
        await parser.destroy();
      }
    }

    // For non-PDF formats, do a full parse (they don't have native pages)
    const book = await this.parseFile(filePath);
    return book.totalPages;
  }

  // ---------------------------------------------------------------------------
  // PDF Parser
  // ---------------------------------------------------------------------------

  /**
   * Parse PDF file — uses native page boundaries via pdf-parse v2.x API.
   */
  private async parsePdf(filePath: string, filename: string): Promise<ParsedBook> {
    // Point pdfjs to the worker file bundled alongside the main process output
    // electron.vite copies pdf.worker.mjs into out/main/ at build time
    PDFParse.setWorker(getPdfWorkerSrc());

    const parser = new PDFParse({ url: filePath });
    try {
      // Get text content
      const textResult = await parser.getText();

      // Extract text only here. Embedded image extraction is intentionally lazy
      // per page during import processing; scanning all images in a large PDF can
      // block the import before page 1 completes.
      const pages: ParsedPage[] = textResult.pages.map((page) => {
        const content = page.text.trim();
        const chapterInfo = this.detectChapterStart(content);

        return {
          pageNumber: page.num,
          content,
          ...chapterInfo,
        };
      });

      return {
        pages,
        totalPages: pages.length,
        settings: { ...DEFAULT_BOOK_SETTINGS },
        format: 'pdf',
        filename,
      };
    } finally {
      await parser.destroy();
    }
  }

  /**
   * Extract embedded images from a single PDF page.
   * Bounded by a timeout so malformed/large image streams do not stall import.
   */
  async extractPdfPageImages(filePath: string, pageNumber: number, timeoutMs = 10000): Promise<string[]> {
    PDFParse.setWorker(getPdfWorkerSrc());

    const parser = new PDFParse({ url: filePath });
    let timedOut = false;

    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        parser.getImage({
          partial: [pageNumber],
          imageThreshold: 80,
          imageDataUrl: true,
          imageBuffer: false,
        }),
        timeout,
      ]);

      if (!result) return [];

      const page = result.pages.find(p => p.pageNumber === pageNumber) || result.pages[0];
      return (page?.images || [])
        .map(img => img.dataUrl)
        .filter(Boolean) as string[];
    } catch (error) {
      console.warn(`[ImportService] Failed to extract images from PDF page ${pageNumber}:`, error);
      return [];
    } finally {
      if (timedOut) {
        parser.destroy().catch(() => undefined);
      } else {
        await parser.destroy();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // DOCX Parser
  // ---------------------------------------------------------------------------

  /**
   * Parse DOCX file — extract settings from XML, convert HTML→markdown,
   * split pages heuristically.
   */
  private async parseDocx(filePath: string, filename: string): Promise<ParsedBook> {
    // Read file buffer for ZIP-based XML extraction
    const fileBuffer = await fs.readFile(filePath);

    // --- Extract settings from DOCX internals ---
    const zip = await JSZip.loadAsync(fileBuffer);
    const stylesXmlFile = zip.file('word/styles.xml');
    const documentXmlFile = zip.file('word/document.xml');

    const stylesXml = stylesXmlFile ? await stylesXmlFile.async('string') : '';
    const documentXml = documentXmlFile ? await documentXmlFile.async('string') : '';

    const extractedSettings = this.extractDocxSettings(documentXml, stylesXml);
    const settings: BookSettings = { ...DEFAULT_BOOK_SETTINGS, ...extractedSettings };

    // --- Convert to Markdown via mammoth + turndown ---
    let html: string;
    try {
      const result = await mammoth.convertToHtml({ path: filePath });
      html = result.value;
    } catch (err) {
      throw new Error(
        `Failed to parse DOCX: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    const markdown = turndownService.turndown(html);

    // --- Split into pages (approximate — DOCX has no natural page boundaries in HTML) ---
    const pages = this.splitMarkdownIntoPages(markdown);

    return {
      pages,
      totalPages: pages.length,
      settings,
      format: 'docx',
      filename,
    };
  }

  /**
   * Extract page settings from DOCX document.xml and styles.xml.
   *
   * Conversions:
   *   1 twip = 1/1440 inch ≈ 0.0176389 mm
   *   1 half-point = 0.5 pt
   *   Line spacing 240 = single, 360 = 1.5, 480 = double
   */
  private extractDocxSettings(documentXml: string, stylesXml: string): Partial<BookSettings> {
    const settings: Partial<BookSettings> = {};

    // Combine both XML documents so we search once over all relevant data.
    const combined = `${documentXml}\n${stylesXml}`;

    // Page size: <w:pgSz w:w="…" w:h="…"/>  (twips → mm)
    const pgSzMatch = combined.match(
      /<w:pgSz[^>]*\bw:w="(\d+)"[^>]*\bw:h="(\d+)"[^>]*\/>/,
    );
    if (pgSzMatch) {
      settings.pageSize = {
        width: round1(parseInt(pgSzMatch[1], 10) * 0.0176389),
        height: round1(parseInt(pgSzMatch[2], 10) * 0.0176389),
      };
    }

    // Margins: <w:pgMar w:top="…" w:bottom="…" w:left="…" w:right="…"/>  (twips → mm)
    const pgMarMatch = combined.match(
      /<w:pgMar[^>]*\bw:top="(\d+)"[^>]*\bw:bottom="(\d+)"[^>]*\bw:left="(\d+)"[^>]*\bw:right="(\d+)"[^>]*\/>/,
    );
    if (pgMarMatch) {
      settings.margins = {
        top: round1(parseInt(pgMarMatch[1], 10) * 0.0176389),
        bottom: round1(parseInt(pgMarMatch[2], 10) * 0.0176389),
        left: round1(parseInt(pgMarMatch[3], 10) * 0.0176389),
        right: round1(parseInt(pgMarMatch[4], 10) * 0.0176389),
      };
    }

    // Font family: <w:rFonts w:ascii="…"/>
    const rFontsMatch = combined.match(/<w:rFonts[^>]*\bw:ascii="([^"]+)"/);
    if (rFontsMatch) {
      settings.fontFamily = rFontsMatch[1];
    }

    // Font size: <w:sz w:val="…"/>  (half-points → pt)
    const szMatch = combined.match(/<w:sz[^>]*\bw:val="(\d+)"/);
    if (szMatch) {
      settings.fontSize = Math.round(parseInt(szMatch[1], 10) / 2);
    }

    // Line spacing: <w:spacing w:line="…"/>  (240ths of a line → multiplier)
    const spacingMatch = combined.match(/<w:spacing[^>]*\bw:line="(\d+)"/);
    if (spacingMatch) {
      const lineVal = parseInt(spacingMatch[1], 10);
      if (lineVal > 0) {
        settings.lineSpacing = Math.round((lineVal / 240) * 100) / 100;
      }
    }

    return settings;
  }

  // ---------------------------------------------------------------------------
  // ODT Parser
  // ---------------------------------------------------------------------------

  /**
   * Parse ODT file — extract settings from styles.xml, text from content.xml,
   * convert to markdown, split pages heuristically.
   */
  private async parseOdt(filePath: string, filename: string): Promise<ParsedBook> {
    const fileBuffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(fileBuffer);

    const contentXmlFile = zip.file('content.xml');
    const stylesXmlFile = zip.file('styles.xml');

    if (!contentXmlFile) {
      throw new Error('Invalid ODT file: missing content.xml');
    }

    const contentXml = await contentXmlFile.async('string');
    const stylesXml = stylesXmlFile ? await stylesXmlFile.async('string') : '';

    const extractedSettings = this.extractOdtSettings(stylesXml);
    const settings: BookSettings = { ...DEFAULT_BOOK_SETTINGS, ...extractedSettings };

    const markdown = this.parseOdtXmlToMarkdown(contentXml);

    // Split pages similarly to DOCX — approximate, since ODT has no natural
    // page boundaries in the extracted XML text.
    const pages = this.splitMarkdownIntoPages(markdown);

    return {
      pages,
      totalPages: pages.length,
      settings,
      format: 'odt',
      filename,
    };
  }

  /**
   * Parse ODT content.xml into a flat markdown string.
   *
   * - `<text:h>` elements become `# ` headings
   * - `<text:p>` elements become paragraphs separated by blank lines
   * - Nested `<text:span>` text is extracted inline
   */
  private parseOdtXmlToMarkdown(contentXml: string): string {
    // Extract the body inside <office:text>…</office:text>
    const bodyMatch = contentXml.match(/<office:text>([\s\S]*?)<\/office:text>/i);
    if (!bodyMatch) return '';
    let body = bodyMatch[1];

    // Convert headings: <text:h ...>text</text:h> → # text
    body = body.replace(/<text:h[^>]*>/gi, '# ');
    body = body.replace(/<\/text:h>/gi, '\n\n');

    // Convert paragraphs: strip <text:p> tags, keep as text blocks
    body = body.replace(/<text:p[^>]*>/gi, '');
    body = body.replace(/<\/text:p>/gi, '\n\n');

    // Handle line-breaks and tabs
    body = body.replace(/<text:line-break\s*\/>/gi, '\n');
    body = body.replace(/<text:tab\s*\/>/gi, '\t');

    // Strip all remaining XML tags
    body = body.replace(/<[^>]+>/g, '');

    // Decode common XML entities
    body = body.replace(/&lt;/g, '<');
    body = body.replace(/&gt;/g, '>');
    body = body.replace(/&amp;/g, '&');
    body = body.replace(/&quot;/g, '"');
    body = body.replace(/&apos;/g, "'");
    body = body.replace(/&#xA0;/g, ' ');

    // Collapse excessive blank lines
    body = body.replace(/\n{3,}/g, '\n\n');
    body = body.replace(/^\n+/, '');

    return body.trim();
  }

  /**
   * Extract page settings from ODT styles.xml.
   *
   * ODT uses FO (Formatting Objects) properties:
   *   - Page size: fo:page-width, fo:page-height  (typically in cm → ×10 for mm)
   *   - Margins: fo:margin-*                      (typically in cm → ×10 for mm)
   *   - Font: fo:font-family
   *   - Font size: fo:font-size                   (typically in pt)
   *   - Line height: fo:line-height               (typically in % or absolute)
   */
  private extractOdtSettings(stylesXml: string): Partial<BookSettings> {
    const settings: Partial<BookSettings> = {};

    if (!stylesXml) return settings;

    // Helper: convert a dimension value + unit to mm
    const toMm = (val: number, unit: string): number => {
      switch (unit) {
        case 'cm':
          return val * 10;
        case 'mm':
          return val;
        case 'in':
          return val * 25.4;
        case 'pt':
          return val * 0.352778;
        case 'pc':
          return val * 4.23333;
        default:
          return val;
      }
    };

    // --- Page size ---
    const pageWidthMatch = stylesXml.match(/fo:page-width="([\d.]+)\s*(cm|mm|in|pt|pc)"/);
    const pageHeightMatch = stylesXml.match(/fo:page-height="([\d.]+)\s*(cm|mm|in|pt|pc)"/);

    if (pageWidthMatch && pageHeightMatch) {
      settings.pageSize = {
        width: round1(toMm(parseFloat(pageWidthMatch[1]), pageWidthMatch[2])),
        height: round1(toMm(parseFloat(pageHeightMatch[1]), pageHeightMatch[2])),
      };
    }

    // --- Margins ---
    const marginProps = ['top', 'bottom', 'left', 'right'] as const;
    const margins: Record<string, { val: number; unit: string } | undefined> = {};

    for (const pos of marginProps) {
      const match = stylesXml.match(
        new RegExp(`fo:margin-${pos}="([\\d.]+)\\s*(cm|mm|in|pt|pc)"`),
      );
      if (match) {
        margins[pos] = { val: parseFloat(match[1]), unit: match[2] };
      }
    }

    if (margins.top && margins.bottom && margins.left && margins.right) {
      settings.margins = {
        top: round1(toMm(margins.top.val, margins.top.unit)),
        bottom: round1(toMm(margins.bottom.val, margins.bottom.unit)),
        left: round1(toMm(margins.left.val, margins.left.unit)),
        right: round1(toMm(margins.right.val, margins.right.unit)),
      };
    }

    // --- Font family ---
    const fontFamilyMatch = stylesXml.match(/fo:font-family="([^"]+)"/);
    if (fontFamilyMatch) {
      settings.fontFamily = fontFamilyMatch[1];
    }

    // --- Font size ---
    const fontSizeMatch = stylesXml.match(/fo:font-size="([\d.]+)\s*(pt|cm|mm)"/);
    if (fontSizeMatch) {
      const val = parseFloat(fontSizeMatch[1]);
      const unit = fontSizeMatch[2];
      settings.fontSize =
        unit === 'pt' ? Math.round(val) : Math.round(toMm(val, unit) / 0.352778);
    }

    return settings;
  }

  // ---------------------------------------------------------------------------
  // TXT Parser
  // ---------------------------------------------------------------------------

  /**
   * Parse TXT file — no settings, split by form-feed or paragraph groups.
   */
  private async parseTxt(filePath: string, filename: string): Promise<ParsedBook> {
    const content = await fs.readFile(filePath, 'utf-8');

    let pageTexts: string[];

    // Prefer form-feed characters as explicit page breaks
    if (content.includes('\f')) {
      pageTexts = content
        .split('\f')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    } else {
      // Otherwise split by approximate page size (~3500 characters)
      pageTexts = this.splitTextIntoPages(content, 3500);
    }

    const pages: ParsedPage[] = pageTexts.map((text, index) => {
      const chapterInfo = this.detectChapterStart(text);
      return {
        pageNumber: index + 1,
        content: text,
        ...chapterInfo,
      };
    });

    return {
      pages,
      totalPages: pages.length,
      settings: { ...DEFAULT_BOOK_SETTINGS },
      format: 'txt',
      filename,
    };
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  /**
   * Detect whether text starts a new chapter by examining the first meaningful
   * line for common chapter/part patterns.
   */
  private detectChapterStart(text: string): { isChapterStart?: boolean; chapterTitle?: string } {
    const lines = text.trim().split('\n');
    const firstLine = lines[0]?.trim().replace(/^#+\s*/, '') ?? '';

    if (!firstLine) return {};

    const chapterPatterns = [
      /^(chapter|CHAPTER|Ch\.)\s+[\dIVXLCDM]+[\s:.-]*(.*)$/,
      /^(part|PART)\s+[\dIVXLCDM]+[\s:.-]*(.*)$/,
      /^(prologue|Prologue|PROLOGUE)\s*/,
      /^(epilogue|Epilogue|EPILOGUE)\s*/,
      /^[\dIVXLCDM]+\.\s+/,
    ];

    for (const pattern of chapterPatterns) {
      if (pattern.test(firstLine)) {
        return {
          isChapterStart: true,
          chapterTitle: lines[0].trim(),
        };
      }
    }

    return {};
  }

  /**
   * Split markdown into pages heuristically.
   *
   * APPROXIMATION: Non-PDF formats don't have natural page boundaries.
   * This method splits at heading boundaries (# or ##) when content exceeds
   * a minimum threshold, falling back to character-count-based splits
   * (~3500 chars per page).
   */
  private splitMarkdownIntoPages(markdown: string): ParsedPage[] {
    const lines = markdown.split('\n');
    const pages: ParsedPage[] = [];
    let currentLines: string[] = [];
    let currentLength = 0;
    let pageNumber = 1;

    const flushPage = () => {
      const content = currentLines.join('\n').trim();
      if (content) {
        pages.push({
          pageNumber: pageNumber++,
          content,
        });
      }
      currentLines = [];
      currentLength = 0;
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Major heading — good page break candidate
      if (/^#{1,3}\s/.test(trimmed)) {
        // If we already have a meaningful amount of content, start a new page
        if (currentLength > 500) {
          flushPage();
        }
        currentLines.push(line);
        currentLength += line.length + 1;
      } else {
        currentLines.push(line);
        currentLength += line.length + 1;

        // Fallback: character-count threshold
        if (currentLength > 3500) {
          flushPage();
        }
      }
    }

    // Flush remaining content
    flushPage();

    if (pages.length === 0 && markdown.trim()) {
      pages.push({
        pageNumber: 1,
        content: markdown.trim(),
      });
    }

    // Detect chapter starts on each page
    return pages.map((page) => {
      const firstLines = page.content.split('\n').filter((l) => l.trim());
      const chapterInfo =
        firstLines.length > 0
          ? this.detectChapterStart(firstLines[0])
          : {};
      return { ...page, ...chapterInfo };
    });
  }

  /**
   * Split plain text into pages by paragraph boundaries, with a maximum
   * character count per page.
   */
  private splitTextIntoPages(text: string, maxChars: number): string[] {
    const pages: string[] = [];
    let current = '';

    const paragraphs = text.split(/\n\n+/);

    for (const para of paragraphs) {
      if (current.length + para.length > maxChars && current.length > 0) {
        pages.push(current.trim());
        current = '';
      }
      current += (current ? '\n\n' : '') + para;
    }

    const remaining = current.trim();
    if (remaining) {
      pages.push(remaining);
    }

    return pages.length > 0 ? pages : [text.trim()];
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Round to one decimal place (tenths of a mm). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
