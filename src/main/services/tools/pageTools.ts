import { FileService } from '../fileService';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService } from './toolUtils';

/**
 * Normalize AI-generated HTML to ensure proper paragraph spacing.
 * If the text is plain text (no <p> or block-level tags), wraps paragraphs in <p> tags.
 * Always ensures blank-line separation between block elements.
 */
export function normalizeHtml(html: string): string {
  if (!html) return html;

  // Check if the text already has block-level HTML tags
  const hasBlockTags = /<(p|div|h[1-6]|ul|ol|li|blockquote|pre|table|hr)\b/i.test(html);

  if (!hasBlockTags) {
    // Plain text — wrap each paragraph in <p> tags
    // Split on double newlines (paragraph breaks) or single newlines (line breaks)
    const paragraphs = html.split(/\n{2,}/);
    html = paragraphs
      .map((para) => {
        const trimmed = para.trim();
        if (!trimmed) return '';
        // Within a paragraph, convert single newlines to <br>
        const withBreaks = trimmed.replace(/\n/g, '<br>');
        return `<p>${withBreaks}</p>`;
      })
      .filter(Boolean)
      .join('\n\n');
  } else {
    // Has block tags — ensure there are blank lines between block elements
    // Add newlines around block tags for readability
    html = html.replace(/>\s*</g, '>\n<');
    // Collapse triple+ newlines to double
    html = html.replace(/\n{3,}/g, '\n\n');
  }

  return html;
}

export async function handleReadContent(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const content = await fs.getBookContent();
  return { result: content };
}

export async function handleEditRange(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const find = args.find as string;
  const replace = args.replace as string;

  const content = await fs.getBookContent();
  if (!find) {
    // Empty find string: insert content at end
    const newContent = content + normalizeHtml(replace);
    await fs.saveBookContent(newContent);
    return {
      result: { success: true, inserted: true },
      commitChange: {
        type: 'edit',
        entityType: 'book',
        entityId: fs['bookId'] || bookId || '',
        entityName: 'Document',
        before: content,
        after: newContent,
      },
    };
  }

  if (!content.includes(find)) {
    return { result: { error: `Text not found in document. The 'find' string must match content exactly (including HTML tags).` } };
  }

  // Replace only the first occurrence
  const newContent = content.replace(find, normalizeHtml(replace));
  await fs.saveBookContent(newContent);

  return {
    result: { success: true, replaced: true },
    commitChange: {
      type: 'edit',
      entityType: 'book',
      entityId: fs['bookId'] || bookId || '',
      entityName: 'Document',
      before: content,
      after: newContent,
    },
  };
}

export async function handleEditContent(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const before = await fs.getBookContent();
  const normalized = normalizeHtml(args.content as string);
  await fs.saveBookContent(normalized);
  return {
    result: { success: true },
    commitChange: {
      type: 'edit',
      entityType: 'book',
      entityId: fs['bookId'] || bookId || '',
      entityName: 'Document',
      before,
      after: normalized,
    },
  };
}

export async function handleAppendToContent(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const existing = await fs.getBookContent();
  const separator = existing && !existing.endsWith('\n') ? '\n\n' : '';
  const newContent = existing + separator + normalizeHtml(args.content as string);
  await fs.saveBookContent(newContent);
  return {
    result: { success: true, wordCount: newContent.split(/\s+/).length },
    commitChange: {
      type: 'edit',
      entityType: 'book',
      entityId: fs['bookId'] || bookId || '',
      entityName: 'Document',
      before: existing,
      after: newContent,
    },
  };
}

export async function handleInsertChapter(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const title = args.title as string;

  // Create ChapterItem in book.items first (generates the ID)
  const newChapter = await fs.createChapter(title);
  const chapterId = newChapter.id;

  // Insert heading into content
  const heading = `<h1 data-chapter-id="${chapterId}">${title}</h1>`;
  const existing = await fs.getBookContent();
  const newContent = existing
    ? existing + '\n\n' + heading
    : heading;
  await fs.saveBookContent(newContent);

  return {
    result: { success: true, chapterId, title },
    commitChange: {
      type: 'create',
      entityType: 'chapter',
      entityId: chapterId,
      entityName: title,
      after: title.slice(0, 500),
    },
  };
}

export async function handleDeleteChapter(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const chapterTitle = args.chapterTitle as string;
  const content = await fs.getBookContent();

  if (!content) {
    return { result: { error: 'Document is empty' } };
  }

  // Match h1 or h2 chapter headings with the given title
  const escapedTitle = chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<h[12][^>]*>\\s*${escapedTitle}\\s*<\\/h[12]>\\s*`,
    'i',
  );

  if (!pattern.test(content)) {
    return { result: { error: `Chapter heading "${chapterTitle}" not found in document.` } };
  }

  const newContent = content.replace(pattern, '');
  await fs.saveBookContent(newContent);

  // Also remove the ChapterItem from book.items
  try {
    const book = await fs.getBookStructure();
    const chapterItem = book.items.find(
      i => i.type === 'chapter' && i.title === chapterTitle
    );
    if (chapterItem) {
      await fs.deleteChapter(chapterItem.id);
    }
  } catch (err) {
    console.debug('[pageTools] Failed to sync chapter deletion to book items', err);
  }

  return {
    result: { success: true, removed: chapterTitle },
    commitChange: {
      type: 'edit',
      entityType: 'book',
      entityId: fs['bookId'] || bookId || '',
      entityName: 'Document',
      before: content,
      after: newContent,
    },
  };
}
