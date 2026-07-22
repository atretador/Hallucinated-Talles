import crypto from 'crypto';
import { FileService } from '../fileService';
import type { WorldData } from '../../../shared/types';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService, normalizeEntityName } from './toolUtils';

export async function handleGetWorldData(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const { worldData } = await createScopedFileService(fileService, bookId, args).getMetadata();
  return {
    result: worldData.map(w => ({
      id: w.id,
      name: w.name,
      category: w.category || 'other',
      shortDescription: w.shortDescription.slice(0, 150) + (w.shortDescription.length > 150 ? '…' : ''),
      ...(w.aliases && w.aliases.length > 0 ? { aliases: w.aliases } : {}),
      ...(w.tags && w.tags.length > 0 ? { tags: w.tags } : {}),
    })),
    summary: `${worldData.length} entries: ${worldData.map(w => `${w.name} (${w.category || 'other'})`).join(', ')}`,
  };
}

export async function handleGetWorldDataEntry(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const { worldData } = await createScopedFileService(fileService, bookId, args).getMetadata();
  const entry = worldData.find(w => w.id === args.worldDataId);
  if (!entry) return { result: { error: `World data entry '${args.worldDataId}' not found` } };
  return {
    result: {
      id: entry.id,
      name: entry.name,
      category: entry.category || 'other',
      shortDescription: entry.shortDescription,
      content: entry.content.slice(0, 500) + (entry.content.length > 500 ? '…' : ''),
      ...(entry.attributes && entry.attributes.length > 0 ? { attributes: entry.attributes } : {}),
      ...(entry.aliases && entry.aliases.length > 0 ? { aliases: entry.aliases } : {}),
    },
  };
}

export async function handleAddWorldData(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  if (typeof args.name !== 'string' || typeof args.shortDescription !== 'string' || typeof args.content !== 'string') {
    return { result: { error: 'Missing required fields: name, shortDescription, content' } };
  }
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const newName = (args.name as string).trim();
  const newNameLower = newName.toLowerCase();

  const characterConflict = meta.characters.find(c =>
    normalizeEntityName(c.name) === normalizeEntityName(newName) ||
    c.aliases.some(alias => normalizeEntityName(alias) === normalizeEntityName(newName))
  );
  if (characterConflict) {
    const beforeDesc = characterConflict.description;
    const worldShortDescription = (args.shortDescription as string).trim();
    const worldContent = (args.content as string).trim();
    const redirectedDescription = [worldShortDescription, worldContent]
      .filter(Boolean)
      .join('\n\n');

    if (redirectedDescription && !characterConflict.description.includes(redirectedDescription)) {
      characterConflict.description = characterConflict.description
        ? `${characterConflict.description}\n\n${redirectedDescription}`
        : redirectedDescription;
      characterConflict.updatedAt = new Date().toISOString();
      await fs.saveMetadata(meta);
    }

    return {
      result: {
        redirected: true,
        redirectedFrom: 'addWorldData',
        redirectedTo: 'addCharacter',
        reason: `'${newName}' is already a character and should not be stored as world data`,
        instruction: `These details were merged into existing character '${characterConflict.name}'. Do not call addWorldData for this name again.`,
        characterId: characterConflict.id,
        characterName: characterConflict.name,
        character: characterConflict,
      },
      commitChange: {
        type: 'edit',
        entityType: 'character',
        entityId: characterConflict.id,
        entityName: characterConflict.name,
        before: beforeDesc,
        after: characterConflict.description,
      },
    };
  }

  const book = await fs.getBookStructure();
  const newNameKey = normalizeEntityName(newName);
  if (normalizeEntityName(book.title) === newNameKey) {
    return {
      result: {
        skipped: true,
        reason: `'${newName}' is the book title and should not be stored as world data`,
        instruction: `Do not add '${newName}' as world data. If the page contains actual setting/lore details, extract those under their in-universe names instead.`,
      },
    };
  }
  const chapterConflict = book.items.find(item =>
    item.type === 'chapter' && normalizeEntityName(item.title) === newNameKey
  );
  if (chapterConflict) {
    return {
      result: {
        skipped: true,
        reason: `'${newName}' is a chapter title and should not be stored as world data`,
        instruction: `Do not add '${newName}' as world data. If the chapter introduces a real place, faction, artifact, system, or lore item, add that specific in-universe entity instead.`,
        chapterId: chapterConflict.id,
        chapterTitle: chapterConflict.title,
      },
    };
  }

  // Dedup: find existing world data entry by name (case-insensitive)
  const existingWd = meta.worldData.find(w => w.name.toLowerCase() === newNameLower);
  if (existingWd) {
    // Update: replace description and content with new values
    existingWd.shortDescription = (args.shortDescription as string);
    existingWd.content = (args.content as string);
    if (args.category !== undefined) existingWd.category = args.category as string;
    if (args.attributes !== undefined) existingWd.attributes = args.attributes as Array<{ key: string; value: string }>;
    if (args.aliases !== undefined) existingWd.aliases = args.aliases as string[];
    if (args.tags !== undefined) existingWd.tags = args.tags as string[];
    existingWd.updatedAt = new Date().toISOString();
    await fs.saveMetadata(meta);
    return {
      result: { id: existingWd.id, name: existingWd.name, category: existingWd.category || 'other', shortDescription: existingWd.shortDescription, merged: true, message: `Updated world data '${existingWd.name}'.` },
      commitChange: {
        type: 'edit',
        entityType: 'worldData',
        entityId: existingWd.id,
        entityName: existingWd.name,
        before: existingWd.shortDescription,
        after: existingWd.shortDescription,
      },
    };
  }
  const newEntry: WorldData = {
    id: `world-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    bookId: bookId || 'default',
    name: newName,
    shortDescription: (args.shortDescription as string),
    content: (args.content as string),
    category: args.category as string | undefined,
    attributes: args.attributes as Array<{ key: string; value: string }> | undefined,
    aliases: args.aliases as string[] | undefined,
    tags: args.tags as string[] | undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  meta.worldData.push(newEntry);
  await fs.saveMetadata(meta);
  return {
    result: { id: newEntry.id, name: newEntry.name, category: newEntry.category || 'other', shortDescription: newEntry.shortDescription, message: `Registered world data '${newEntry.name}'.` },
    commitChange: {
      type: 'create',
      entityType: 'worldData',
      entityId: newEntry.id,
      entityName: newEntry.name,
      after: newEntry.shortDescription,
    },
  };
}

export async function handleEditWorldData(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const hasName = args.name !== undefined;
  const hasShortDescription = args.shortDescription !== undefined;
  const hasContent = args.content !== undefined;
  const hasCategory = args.category !== undefined;
  const hasAttributes = args.attributes !== undefined;
  const hasAliases = args.aliases !== undefined;
  const hasTags = args.tags !== undefined;
  if (!hasName && !hasShortDescription && !hasContent && !hasCategory && !hasAttributes && !hasAliases && !hasTags) {
    return { result: { error: 'At least one field must be provided to update' } };
  }
  if ((hasName && typeof args.name !== 'string') || (hasShortDescription && typeof args.shortDescription !== 'string') || (hasContent && typeof args.content !== 'string')) {
    return { result: { error: 'name, shortDescription, and content must be strings' } };
  }
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const idx = meta.worldData.findIndex(w => w.id === args.worldDataId);
  if (idx === -1) return { result: { error: `World data entry '${args.worldDataId}' not found` } };
  const existing = meta.worldData[idx];
  if (hasName) existing.name = (args.name as string);
  if (hasShortDescription) existing.shortDescription = (args.shortDescription as string);
  if (hasContent) existing.content = (args.content as string);
  if (hasCategory) existing.category = args.category as string;
  if (hasAttributes) existing.attributes = args.attributes as Array<{ key: string; value: string }>;
  if (hasAliases) existing.aliases = args.aliases as string[];
  if (hasTags) existing.tags = args.tags as string[];
  existing.updatedAt = new Date().toISOString();
  await fs.saveMetadata(meta);
  return {
    result: { id: existing.id, name: existing.name, category: existing.category || 'other', shortDescription: existing.shortDescription, message: `Updated world data '${existing.name}'.` },
    commitChange: {
      type: 'edit',
      entityType: 'worldData',
      entityId: existing.id,
      entityName: existing.name,
    },
  };
}

export async function handleDeleteWorldData(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const idx = meta.worldData.findIndex(w => w.id === args.worldDataId);
  if (idx === -1) return { result: { error: `World data entry '${args.worldDataId}' not found` } };
  const deleted = meta.worldData.splice(idx, 1)[0];
  // Clean up orphaned relations
  meta.relations = meta.relations.filter(r =>
    !(r.from.type === 'worldData' && r.from.id === deleted.id) &&
    !(r.to.type === 'worldData' && r.to.id === deleted.id)
  );
  await fs.saveMetadata(meta);
  return {
    result: { success: true, id: deleted.id, name: deleted.name },
    commitChange: {
      type: 'delete',
      entityType: 'worldData',
      entityId: deleted.id,
      entityName: deleted.name,
    },
  };
}
