/**
 * Export book content to PDF by opening a print-friendly view.
 * Uses the browser's native print dialog with A4 CSS styling.
 */
export async function exportToPdf(content: string, bookTitle: string): Promise<void> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Could not open print window');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(bookTitle)}</title>
      <style>
        @page { size: A4; margin: 25.4mm; }
        * { box-sizing: border-box; }
        body {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 0;
        }
        h1 {
          page-break-before: always;
          margin-top: 0;
          padding-top: 0;
        }
        h1:first-of-type { page-break-before: avoid; }
        h2, h3 { page-break-after: avoid; }
        p { margin: 0 0 0.5em; orphans: 3; widows: 3; }
        img { max-width: 100%; height: auto; }
        blockquote {
          margin: 1em 0;
          padding: 0.5em 1em;
          border-left: 3px solid #ccc;
          color: #555;
        }
        pre, code { font-family: 'Courier New', monospace; font-size: 9pt; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
        .page-break { page-break-before: always; }
        hr { border: none; border-top: 1px solid #ccc; margin: 1em 0; }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `);
  printWindow.document.close();

  // Wait for fonts and images to load before printing
  await new Promise<void>((resolve) => {
    printWindow.onload = () => resolve();
    // Fallback: resolve after 3 seconds even if onload didn't fire
    setTimeout(resolve, 3000);
  });

  printWindow.print();
}

/** Minimal HTML entity escaping for the title */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
