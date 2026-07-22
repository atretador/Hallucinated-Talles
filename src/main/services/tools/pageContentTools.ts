import { FileService } from '../fileService';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService } from './toolUtils';

export async function handleGetCharacter(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const { characters } = await createScopedFileService(fileService, bookId, args).getMetadata();
  return { result: characters.find(c => c.id === args.characterId) ?? null };
}
