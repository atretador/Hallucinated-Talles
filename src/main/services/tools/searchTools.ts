import { FileService } from '../fileService';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService } from './toolUtils';

export async function handleSearchContent(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const book = await fs.getBookStructure();
  const results: {
    pageId: string;
    title: string;
    preview: string;
    matchCount: number;
  }[] = [];
  const query = (args.query as string).toLowerCase();
  const maxResults = 10;
  let totalMatches = 0;
  for (const item of book.items) {
    if (item.type !== 'page') continue;
    const content = await fs.getPageContent(item.id);
    const lowerContent = content.toLowerCase();
    let matchCount = 0;
    let searchFrom = 0;
    while (true) {
      const foundIdx = lowerContent.indexOf(query, searchFrom);
      if (foundIdx === -1) break;
      matchCount++;
      searchFrom = foundIdx + query.length;
    }
    if (matchCount > 0) {
      totalMatches += matchCount;
      const idx = lowerContent.indexOf(query);
      const start = Math.max(0, idx - 50);
      const end = Math.min(content.length, idx + query.length + 50);
      results.push({
        pageId: item.id,
        title: item.title || 'Untitled',
        preview: content.slice(start, end),
        matchCount,
      });
    }
  }
  const truncated = results.length > maxResults;
  const returned = truncated ? results.slice(0, maxResults) : results;
  return {
    result: {
      results: returned,
      totalPages: results.length,
      totalMatches,
      truncated,
      ...(truncated && { message: `Showing first ${maxResults} of ${results.length} matching pages. Use a more specific query to narrow results.` }),
    },
  };
}

export async function handleSearchRelations(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const query = (args.query as string).toLowerCase();
  const { relations } = await createScopedFileService(fileService, bookId, args).getMetadata();
  const filtered = relations.filter(r =>
    r.type.toLowerCase().includes(query) ||
    r.description.toLowerCase().includes(query) ||
    (r.label && r.label.toLowerCase().includes(query)) ||
    (r.tags && r.tags.some(t => t.toLowerCase().includes(query)))
  );
  return {
    result: filtered.map(r => ({
      from: `${r.from.type}:${r.from.id}`,
      to: `${r.to.type}:${r.to.id}`,
      type: r.type,
      description: r.description.slice(0, 150) + (r.description.length > 150 ? '…' : ''),
      ...(r.label ? { label: r.label } : {}),
    })),
    summary: `${filtered.length} relation${filtered.length !== 1 ? 's' : ''} matching '${args.query}'`,
  };
}
