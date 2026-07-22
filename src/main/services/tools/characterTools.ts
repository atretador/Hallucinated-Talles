import { FileService } from '../fileService';
import type { Character } from '../../../shared/types';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService } from './toolUtils';

export async function handleGetCharacters(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const { characters } = await createScopedFileService(fileService, bookId, args).getMetadata();
  return {
    result: characters.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description.slice(0, 200) + (c.description.length > 200 ? '…' : ''),
      ...(c.aliases.length > 0 ? { aliases: c.aliases } : {}),
      ...(c.attributes.length > 0 ? { attributes: c.attributes.map(a => `${a.key}: ${a.values.join(', ')}`) } : {}),
    })),
    summary: `${characters.length} character${characters.length !== 1 ? 's' : ''}: ${characters.map(c => c.name).join(', ')}`,
  };
}

export async function handleAddCharacter(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const newName = (args.name as string).trim();
  const newNameLower = newName.toLowerCase();
  // Dedup: find existing character by name or aliases
  const existing = meta.characters.find(c =>
    c.name.toLowerCase() === newNameLower ||
    c.aliases.some(a => a.toLowerCase() === newNameLower)
  );
  if (existing) {
    // Merge: append new description info, merge attributes
    const beforeDesc = existing.description;
    const newDesc = args.description as string;
    if (newDesc && !existing.description.includes(newDesc)) {
      existing.description = existing.description
        ? `${existing.description}\n\n${newDesc}`
        : newDesc;
    }
    // Merge attributes: add new keys, append values to existing keys
    const newAttrs = (args.attributes as Array<{ key: string; values: string[] }>) ?? [];
    for (const na of newAttrs) {
      const existingAttr = existing.attributes.find(a => a.key.toLowerCase() === na.key.toLowerCase());
      if (existingAttr) {
        // Append new values that don't already exist
        for (const v of na.values) {
          if (!existingAttr.values.some(ev => ev.toLowerCase() === v.toLowerCase())) {
            existingAttr.values.push(v);
          }
        }
      } else {
        existing.attributes.push({
          id: `attr-${Date.now()}-${existing.attributes.length}`,
          key: na.key,
          values: na.values,
        });
      }
    }
    existing.updatedAt = new Date().toISOString();
    await fs.saveMetadata(meta);
    return {
      result: { id: existing.id, name: existing.name, description: existing.description.slice(0, 200) + (existing.description.length > 200 ? '…' : ''), merged: true, message: `Updated character '${existing.name}' — merged new details.` },
      commitChange: {
        type: 'edit',
        entityType: 'character',
        entityId: existing.id,
        entityName: existing.name,
        before: beforeDesc,
        after: existing.description,
      },
    };
  }
  const attrs = (args.attributes as Array<{ key: string; values: string[] }> | undefined)?.map((a, i) => ({
    id: `attr-${Date.now()}-${i}`,
    key: a.key,
    values: a.values,
  })) ?? [];
  const newChar: Character = {
    id: `char-${Date.now()}`,
    bookId: bookId || 'default',
    name: newName,
    description: args.description as string,
    aliases: [],
    attributes: attrs,
    entries: [],
    relations: [],
    storyPoints: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  meta.characters.push(newChar);
  await fs.saveMetadata(meta);
  return {
    result: { id: newChar.id, name: newChar.name, description: newChar.description.slice(0, 200) + (newChar.description.length > 200 ? '…' : ''), message: `Registered character '${newChar.name}'.` },
    commitChange: {
      type: 'create',
      entityType: 'character',
      entityId: newChar.id,
      entityName: newChar.name,
      after: newChar.description,
    },
  };
}

export async function handleEditCharacter(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const char = meta.characters.find(c => c.id === args.characterId);
  if (!char) return { result: { error: 'Character not found' } };
  const beforeDesc = char.description;
  if (args.name) char.name = args.name as string;
  if (args.description) char.description = args.description as string;
  if (args.attributes) {
    char.attributes = (args.attributes as Array<{ key: string; values: string[] }>).map((a, i) => ({
      id: `attr-${Date.now()}-${i}`,
      key: a.key,
      values: a.values,
    }));
  }
  char.updatedAt = new Date().toISOString();
  await fs.saveMetadata(meta);
  return {
    result: { id: char.id, name: char.name, description: char.description.slice(0, 200) + (char.description.length > 200 ? '…' : ''), message: `Updated character '${char.name}'.` },
    commitChange: {
      type: 'edit',
      entityType: 'character',
      entityId: char.id,
      entityName: char.name,
      before: beforeDesc,
      after: char.description,
    },
  };
}

export async function handleDeleteCharacter(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const idx = meta.characters.findIndex(c => c.id === args.characterId);
  if (idx === -1) return { result: { error: 'Character not found' } };
  const deleted = meta.characters.splice(idx, 1)[0];
  // Clean up orphaned relations
  meta.relations = meta.relations.filter(r =>
    !(r.from.type === 'character' && r.from.id === deleted.id) &&
    !(r.to.type === 'character' && r.to.id === deleted.id)
  );
  await fs.saveMetadata(meta);
  return {
    result: { success: true, deleted: deleted.id },
    commitChange: {
      type: 'delete',
      entityType: 'character',
      entityId: deleted.id,
      entityName: deleted.name,
      before: deleted.description,
    },
  };
}
