import crypto from 'crypto';
import { FileService } from '../fileService';
import type { EntityRef, StoryRelation } from '../../../shared/types';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService } from './toolUtils';

export async function handleAddRelation(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const book = await fs.getBookStructure();
  const fromType = args.fromType as string;
  const fromId = args.fromId as string;
  const toType = args.toType as string;
  const toId = args.toId as string;
  const relType = (args.type as string).trim().toLowerCase();
  const description = (args.description as string).trim();

  if (!fromType || !fromId || !toType || !toId || !relType || !description) {
    return { result: { error: 'Missing required fields: fromType, fromId, toType, toId, type, description' } };
  }

  // Validate entities exist
  const validateEntity = (type: string, id: string): boolean => {
    if (type === 'character') return meta.characters.some(c => c.id === id);
    if (type === 'event') return meta.events.some(e => e.id === id);
    if (type === 'worldData') return meta.worldData.some(w => w.id === id);
    if (type === 'page') return book.items.some(i => i.type === 'page' && i.id === id);
    if (type === 'chapter') return book.items.some(i => i.type === 'chapter' && i.id === id);
    return false;
  };

  if (!validateEntity(fromType, fromId)) return { result: { error: `Source entity ${fromType}:${fromId} not found` } };
  if (!validateEntity(toType, toId)) return { result: { error: `Target entity ${toType}:${toId} not found` } };

  // Dedup: check for existing relation with same from/to/type
  const existing = meta.relations.find(r =>
    r.from.type === fromType && r.from.id === fromId &&
    r.to.type === toType && r.to.id === toId &&
    r.type === relType
  );
  if (existing) {
    // Update existing relation
    const oldDescription = existing.description;
    existing.description = description;
    if (args.label) existing.label = args.label as string;
    if (args.tags) existing.tags = args.tags as string[];
    existing.updatedAt = new Date().toISOString();
    await fs.saveMetadata(meta);
    return { result: { from: `${fromType}:${fromId}`, to: `${toType}:${toId}`, type: relType, description: description.slice(0, 150) + (description.length > 150 ? '…' : ''), merged: true, message: `Updated relation: ${fromType}→${toType} (${relType}).` }, commitChange: { type: 'edit', entityType: 'relation', entityId: existing.id, entityName: `relation:${relType}`, before: oldDescription.slice(0, 500), after: description.slice(0, 500) } };
  }

  const newRelation: StoryRelation = {
    id: `rel-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    bookId: bookId || 'default',
    from: { type: fromType as EntityRef['type'], id: fromId },
    to: { type: toType as EntityRef['type'], id: toId },
    type: relType,
    label: args.label as string | undefined,
    description,
    tags: args.tags as string[] | undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  meta.relations.push(newRelation);
  await fs.saveMetadata(meta);
  return {
    result: { from: `${fromType}:${fromId}`, to: `${toType}:${toId}`, type: relType, description: description.slice(0, 150) + (description.length > 150 ? '…' : ''), message: `Created relation: ${fromType}→${toType} (${relType}).` },
    commitChange: { type: 'create', entityType: 'relation', entityId: newRelation.id, entityName: `relation:${relType}`, after: `${fromType}:${fromId} → ${toType}:${toId} (${relType}): ${description.slice(0, 200)}`.slice(0, 500) },
  };
}

export async function handleEditRelation(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const idx = meta.relations.findIndex(r => r.id === args.relationId);
  if (idx === -1) return { result: { error: `Relation '${args.relationId}' not found` } };
  const rel = meta.relations[idx];
  const oldType = rel.type;
  const oldDescription = rel.description;
  if (args.type) rel.type = (args.type as string).trim().toLowerCase();
  if (args.label !== undefined) rel.label = args.label as string;
  if (args.description) rel.description = (args.description as string).trim();
  if (args.tags) rel.tags = args.tags as string[];
  rel.updatedAt = new Date().toISOString();
  await fs.saveMetadata(meta);
  return { result: { from: `${rel.from.type}:${rel.from.id}`, to: `${rel.to.type}:${rel.to.id}`, type: rel.type, description: rel.description.slice(0, 150) + (rel.description.length > 150 ? '…' : ''), message: `Updated relation (${rel.type}).` }, commitChange: { type: 'edit', entityType: 'relation', entityId: rel.id, entityName: `relation:${rel.type}`, before: `${oldType}: ${oldDescription.slice(0, 200)}`.slice(0, 500), after: `${rel.type}: ${rel.description.slice(0, 200)}`.slice(0, 500) } };
}

export async function handleDeleteRelation(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const idx = meta.relations.findIndex(r => r.id === args.relationId);
  if (idx === -1) return { result: { error: `Relation '${args.relationId}' not found` } };
  const deleted = meta.relations.splice(idx, 1)[0];
  await fs.saveMetadata(meta);
  return {
    result: { success: true, id: deleted.id },
    commitChange: { type: 'delete', entityType: 'relation', entityId: deleted.id, entityName: `relation:${deleted.type}`, before: `${deleted.from.type}:${deleted.from.id} → ${deleted.to.type}:${deleted.to.id} (${deleted.type}): ${deleted.description.slice(0, 200)}`.slice(0, 500) },
  };
}

export async function handleGetRelations(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const { relations } = await createScopedFileService(fileService, bookId, args).getMetadata();
  return {
    result: relations.map(r => ({
      from: `${r.from.type}:${r.from.id}`,
      to: `${r.to.type}:${r.to.id}`,
      type: r.type,
      description: r.description.slice(0, 150) + (r.description.length > 150 ? '…' : ''),
      ...(r.label ? { label: r.label } : {}),
    })),
    summary: `${relations.length} relation${relations.length !== 1 ? 's' : ''}`,
  };
}

export async function handleGetEntityRelations(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const entityType = args.entityType as string;
  const entityId = args.entityId as string;
  const { relations } = await createScopedFileService(fileService, bookId, args).getMetadata();
  const filtered = relations.filter(r =>
    (r.from.type === entityType && r.from.id === entityId) ||
    (r.to.type === entityType && r.to.id === entityId)
  );
  return {
    result: filtered.map(r => ({
      from: `${r.from.type}:${r.from.id}`,
      to: `${r.to.type}:${r.to.id}`,
      type: r.type,
      description: r.description.slice(0, 150) + (r.description.length > 150 ? '…' : ''),
      ...(r.label ? { label: r.label } : {}),
    })),
    summary: `${filtered.length} relation${filtered.length !== 1 ? 's' : ''} for ${entityType}:${entityId}`,
  };
}
