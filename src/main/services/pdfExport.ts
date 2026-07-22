import { BrowserWindow } from 'electron';
import type { Book, BookSettings } from '../../shared/types.js';
import { DEFAULT_BOOK_SETTINGS } from '../../shared/constants.js';

interface ChapterContent {
  title: string;
  sections: Array<{ title: string; content: string }>;
}

/**
 * Build a complete HTML document for print/PDF rendering.
 */
function buildHtml(book: Book, chapters: ChapterContent[], coverImages?: { frontCover?: string; backCover?: string }): string {
  const s: BookSettings = book.settings ?? DEFAULT_BOOK_SETTINGS;

  const css = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: "${s.fontFamily}", serif;
      font-size: ${s.fontSize}pt;
      line-height: ${s.lineSpacing};
      color: #1a1a1a;
    }

    /* Title page */
    .title-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 80vh;
    }
    .title-page h1 {
      font-size: 2.5em;
      font-weight: bold;
      margin-bottom: 0.5em;
    }
    .title-page .author {
      font-size: 1.3em;
      font-style: italic;
      color: #444;
    }

    /* Chapter heading */
    .chapter {
      page-break-before: always;
    }
    .chapter-title {
      font-size: 1.8em;
      font-weight: bold;
      margin-bottom: 1em;
      text-align: center;
    }

    /* Section heading */
    .page-title {
      font-size: 1.2em;
      font-weight: bold;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    /* Body text - match editor styles */
    .page-content {
      font-family: "${s.fontFamily}", serif;
      font-size: ${s.fontSize}pt;
      line-height: ${s.lineSpacing};
    }

    .page-content p {
      margin: 0 0 0.85em;
    }

    .page-content h1 {
      font-size: 1.75em;
      font-weight: 700;
      line-height: 1.3;
      margin: 1.5em 0 0.5em;
      color: #111;
    }

    .page-content h2 {
      font-size: 1.35em;
      font-weight: 600;
      line-height: 1.35;
      margin: 1.3em 0 0.4em;
      color: #1a1a1a;
    }

    .page-content blockquote {
      border-left: 3px solid #d4cfc8;
      margin: 1em 0;
      padding: 0.25em 1em;
      color: #4a4a4a;
      font-style: italic;
      background: rgba(0,0,0,0.02);
      border-radius: 0 2px 2px 0;
    }

    .page-content ul,
    .page-content ol {
      padding-left: 1.5em;
      margin: 0.5em 0;
    }

    .page-content li {
      margin-bottom: 0.3em;
    }

    .page-content li p {
      margin: 0;
    }

    .page-content pre {
      background: #f0ede8;
      border: 1px solid #e2ddd6;
      border-radius: 4px;
      padding: 0.75em 1em;
      font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.85em;
      color: #2d2d2d;
      margin: 1em 0;
    }

    .page-content code {
      background: #f0ede8;
      border-radius: 3px;
      padding: 0.1em 0.3em;
      font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.85em;
      color: #c7254e;
    }

    .page-content hr {
      border: none;
      border-top: 1px solid #ddd9d2;
      margin: 2em 0;
    }

    .page-content hr.page-break,
    .page-content hr[data-page-break] {
      border: none;
      border-top: 2px dashed #ccc7be;
      margin: 3em 0;
      position: relative;
    }

    .page-content hr.page-break::after,
    .page-content hr[data-page-break]::after {
      content: '◆';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 0 0.6em;
      color: #c9c3b9;
      font-size: 0.55rem;
    }

    .page-content strong {
      font-weight: 700;
      color: #111;
    }

    .page-content em {
      font-style: italic;
    }

    .page-content s {
      color: #888;
    }

    .page-content u {
      text-decoration: underline;
    }

    /* Cover pages — full-bleed, no margins, image fills entire page */
    .cover-page {
      page-break-after: always;
      margin: 0;
      padding: 0;
      text-align: center;
      width: ${s.pageSize.width}mm;
      height: ${s.pageSize.height}mm;
      overflow: hidden;
    }
    .cover-page img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Content padding (since printToPDF margins are 0 for full-bleed covers) */
    body {
      padding: 0;
    }
    .title-page, .chapter, .separator {
      padding-left: ${s.margins.left}mm;
      padding-right: ${s.margins.right}mm;
    }
    .title-page {
      padding-top: ${s.margins.top}mm;
      padding-bottom: ${s.margins.bottom}mm;
    }
    .chapter {
      padding-top: ${s.margins.top}mm;
      padding-bottom: ${s.margins.bottom}mm;
    }

    /* Separator between covers and content */
    .separator {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2em 0;
    }
    .separator hr {
      border: none;
      border-top: 1px solid #ccc;
      width: 40%;
    }
  `;

  const titlePage = `
    <div class="title-page">
      <h1>${escapeHtml(book.title)}</h1>
      ${book.metadata.author ? `<div class="author">by ${escapeHtml(book.metadata.author)}</div>` : ''}
    </div>
  `;

  const chapterHtml = chapters
    .map(
      (ch) => {
        // Always render chapter/page headers
        const chapterHeader = `<h2 class="chapter-title">${escapeHtml(ch.title)}</h2>`;

        const sectionsHtml = ch.sections
          .map(
            (sec) => {
              const sectionHeader = `<h3 class="page-title">${escapeHtml(sec.title)}</h3>`;
              return `${sectionHeader}<div class="page-content">${sec.content}</div>`;
            }
          )
          .join('\n');

        return `
          <div class="chapter">
            ${chapterHeader}
            ${sectionsHtml}
          </div>
        `;
      }
    )
    .join('\n');

  const frontCoverHtml = coverImages?.frontCover
    ? `<div class="cover-page"><img src="${coverImages.frontCover}" alt="Front Cover" /></div>
       <div class="separator"><hr /></div>`
    : '';

  const backCoverHtml = coverImages?.backCover
    ? `<div class="separator"><hr /></div>
       <div class="cover-page" style="page-break-before: always;"><img src="${coverImages.backCover}" alt="Back Cover" /></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(book.title)}</title>
  <style>${css}</style>
</head>
<body>
  ${frontCoverHtml}
  ${titlePage}
  ${chapterHtml}
  ${backCoverHtml}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Export a book to PDF using Electron's printToPDF.
 * Creates a hidden BrowserWindow, renders the book HTML, and generates a PDF.
 */
export async function exportBookToPdf(
  book: Book,
  chapterContents: ChapterContent[],
  bookDir?: string,
): Promise<Buffer> {
  let coverImages: { frontCover?: string; backCover?: string } | undefined;
  if (bookDir) {
    const { readCoverImage } = await import('./coverService');
    const frontBuf = await readCoverImage(bookDir, 'front-cover');
    const backBuf = await readCoverImage(bookDir, 'back-cover');
    coverImages = {
      frontCover: frontBuf ? `data:image/png;base64,${frontBuf.toString('base64')}` : undefined,
      backCover: backBuf ? `data:image/png;base64,${backBuf.toString('base64')}` : undefined,
    };
  }

  const html = buildHtml(book, chapterContents, coverImages);

  // Create a hidden off-screen window
  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 1100,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    // Load HTML via data URL
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await win.loadURL(dataUrl);

    // Wait a moment for layout to settle
    await new Promise((r) => setTimeout(r, 200));

    const s: BookSettings = book.settings ?? DEFAULT_BOOK_SETTINGS;

    // Generate PDF with printToPDF
    // Margins are 0 — cover pages need full-bleed. Content sections apply their own padding via CSS.
    const pdfData = await win.webContents.printToPDF({
      pageSize: {
        width: s.pageSize.width / 25.4, // mm → inches
        height: s.pageSize.height / 25.4,
      },
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
      printBackground: !!(coverImages?.frontCover || coverImages?.backCover),
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfData);
  } finally {
    win.destroy();
  }
}
