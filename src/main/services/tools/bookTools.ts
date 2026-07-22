import crypto from 'crypto';
import { FileService } from '../fileService';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService, normalizeEntityName } from './toolUtils';

export async function handleListBooks(
  _args: Record<string, unknown>,
  fileService: FileService,
  _bookId?: string,
): Promise<ToolExecutionResult> {
  const bookIds = await FileService.listBooks(fileService.projectName);
  const bookList: { id: string; title: string }[] = [];
  for (const id of bookIds) {
    try {
      const fs = new FileService(fileService.projectName, id);
      const structure = await fs.getBookStructure();
      bookList.push({ id, title: structure.title ?? id });
    } catch {
      bookList.push({ id, title: id });
    }
  }
  return { result: bookList };
}

export async function handleGetProjectStructure(
  _args: Record<string, unknown>,
  fileService: FileService,
  _bookId?: string,
): Promise<ToolExecutionResult> {
  const bookIds = await FileService.listBooks(fileService.projectName);
  const books: { id: string; title: string }[] = [];
  for (const id of bookIds) {
    try {
      const fs = new FileService(fileService.projectName, id);
      const structure = await fs.getBookStructure();
      books.push({ id, title: structure.title ?? id });
    } catch {
      books.push({ id, title: id });
    }
  }
  return {
    result: {
      projectName: fileService.projectName,
      books,
    },
  };
}

export async function handleCreateBook(
  args: Record<string, unknown>,
  fileService: FileService,
  _bookId?: string,
): Promise<ToolExecutionResult> {
  const title = args.title as string;
  const description = (args.description as string) ?? '';
  const requestedTitleKey = normalizeEntityName(title);
  const existingBookIds = await FileService.listBooks(fileService.projectName);
  for (const existingBookId of existingBookIds) {
    try {
      const existingFs = new FileService(fileService.projectName, existingBookId);
      const existingBook = await existingFs.getBookStructure();
      if (normalizeEntityName(existingBook.title) === requestedTitleKey) {
        return {
          result: {
            id: existingBook.id,
            title: existingBook.title,
            description: existingBook.metadata.description,
            existing: true,
            skipped: true,
            instruction: `Use existing book '${existingBook.title}' (ID: ${existingBook.id}). Do not call createBook for this title again; pass this bookId to book-scoped tools.`,
          },
        };
      }
    } catch {
      console.debug('[bookTools] Ignore malformed book directories and continue checking others');
      // Ignore malformed book directories and continue checking others.
    }
  }

  const newBookId = crypto.randomUUID();
  await FileService.createBook(fileService.projectName, newBookId, title, description);
  return {
    result: {
      id: newBookId,
      title,
      description,
      instruction: `Book created. Pass bookId '${newBookId}' to insertChapter, addPage, and planner tools for this book.`,
    },
    commitChange: {
      type: 'create',
      entityType: 'book',
      entityId: newBookId,
      entityName: title,
    },
  };
}

export async function handleGetBookStructure(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const book = await createScopedFileService(fileService, bookId, args).getBookStructure();
  if (!book) return { result: { error: 'Book not found' } };

  return {
    result: {
      id: book.id,
      title: book.title,
      description: book.metadata?.description || '',
      items: book.items.map(item => ({
        type: item.type,
        id: item.id,
        title: item.title || 'Untitled',
      })),
      // Compact summary for quick scanning
      summary: `${book.title}: ${book.items.filter(i => i.type === 'chapter').length} chapters, ${book.items.filter(i => i.type === 'page').length} pages`,
    },
  };
}

export async function handleCreateChapter(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const newTitle = (args.title as string).trim();
  const newTitleKey = normalizeEntityName(newTitle);
  const fs = createScopedFileService(fileService, bookId, args);
  const book = await fs.getBookStructure();
  const existingChapter = book.items.find(item =>
    item.type === 'chapter' && normalizeEntityName(item.title) === newTitleKey
  );

  if (existingChapter) {
    return {
      result: {
        ...existingChapter,
        existing: true,
        skipped: true,
        reason: `Chapter '${newTitle}' already exists`,
        instruction: `Use existing chapter '${existingChapter.title}' (ID: ${existingChapter.id}). Do not call createChapter for this title again.`,
      },
    };
  }

  const newChapter = await fs.createChapter(newTitle);
  return {
    result: newChapter,
    commitChange: {
      type: 'create',
      entityType: 'chapter',
      entityId: newChapter.id,
      entityName: newChapter.title,
      after: newChapter.title.slice(0, 500),
    },
  };
}

export async function handleDeleteChapter(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  // Capture chapter title before deletion
  const book = await fs.getBookStructure();
  const chapterItem = book.items.find(i => i.type === 'chapter' && i.id === args.chapterId) as { title: string } | undefined;
  const chapterTitle = chapterItem?.title ?? (args.chapterId as string);
  const deleted = await fs.deleteChapter(args.chapterId as string);
  if (!deleted) return { result: { error: 'Chapter not found' } };
  return {
    result: { success: true, deleted: args.chapterId },
    commitChange: {
      type: 'delete',
      entityType: 'chapter',
      entityId: args.chapterId as string,
      entityName: chapterTitle,
      before: chapterTitle.slice(0, 500),
    },
  };
}
