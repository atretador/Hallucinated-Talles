import { FileService } from '../fileService';
import type { EventType, TextLocation } from '../../../shared/types';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService } from './toolUtils';

export async function handleGetEvents(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const { events } = await createScopedFileService(fileService, bookId, args).getMetadata();
  const filtered = args.filter ? events.filter(e => e.type === args.filter) : events;
  return {
    result: filtered.map(e => ({
      id: e.id,
      title: e.title,
      type: e.type,
      description: e.description.slice(0, 200) + (e.description.length > 200 ? '…' : ''),
      ...(e.characters.length > 0 ? { characters: e.characters } : {}),
    })),
    summary: `${filtered.length} event${filtered.length !== 1 ? 's' : ''}: ${filtered.map(e => `${e.title} (${e.type})`).join(', ')}`,
  };
}

export async function handleAddEvent(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const newTitle = (args.title as string).trim();
  const newTitleLower = newTitle.toLowerCase();
  // Dedup: find existing event by title (case-insensitive)
  const existingEvt = meta.events.find(e => e.title.toLowerCase() === newTitleLower);
  if (existingEvt) {
    // Merge: append description, merge character lists, upgrade type if needed
    const beforeDesc = existingEvt.description;
    const newDesc = args.description as string;
    if (newDesc && !existingEvt.description.includes(newDesc)) {
      existingEvt.description = existingEvt.description
        ? `${existingEvt.description}\n\n${newDesc}`
        : newDesc;
    }
    // Merge character lists
    const newChars = (args.characters as string[]) ?? [];
    for (const c of newChars) {
      if (!existingEvt.characters.includes(c)) {
        existingEvt.characters.push(c);
      }
    }
    // Merge locations
    const newLocations = (args.locations as TextLocation[]) ?? [];
    for (const loc of newLocations) {
      if (!existingEvt.locations.some(el => el.pageId === loc.pageId && el.startLine === loc.startLine)) {
        existingEvt.locations.push(loc);
      }
    }
    // Upgrade type if new one is more significant
    const typeOrder: Record<string, number> = { background: 0, minor: 1, major: 2 };
    if (typeOrder[(args.eventType as string)] > typeOrder[existingEvt.type]) {
      existingEvt.type = args.eventType as EventType;
    }
    await fs.saveMetadata(meta);
    return {
      result: { id: existingEvt.id, title: existingEvt.title, type: existingEvt.type, description: existingEvt.description.slice(0, 200) + (existingEvt.description.length > 200 ? '…' : ''), merged: true, message: `Updated event '${existingEvt.title}' — merged new details.` },
      commitChange: {
        type: 'edit',
        entityType: 'event',
        entityId: existingEvt.id,
        entityName: existingEvt.title,
        before: beforeDesc,
        after: existingEvt.description,
      },
    };
  }
  const newEvent = {
    id: `event-${Date.now()}`,
    bookId: bookId || 'default',
    title: newTitle,
    description: args.description as string,
    type: args.eventType as EventType,
    timestamp: (args.timestamp as string) ?? new Date().toISOString(),
    characters: (args.characters as string[]) ?? [],
    consequences: [],
    sortOrder: meta.events.length,
    locations: (args.locations as TextLocation[]) ?? [],
  };
  meta.events.push(newEvent);
  await fs.saveMetadata(meta);
  return {
    result: { id: newEvent.id, title: newEvent.title, type: newEvent.type, description: newEvent.description.slice(0, 200) + (newEvent.description.length > 200 ? '…' : ''), message: `Registered event '${newEvent.title}'.` },
    commitChange: {
      type: 'create',
      entityType: 'event',
      entityId: newEvent.id,
      entityName: newEvent.title,
      after: newEvent.description,
    },
  };
}

export async function handleEditEvent(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const evt = meta.events.find(e => e.id === args.eventId);
  if (!evt) return { result: { error: 'Event not found' } };
  const beforeDesc = evt.description;
  if (args.title) evt.title = args.title as string;
  if (args.description) evt.description = args.description as string;
  if (args.eventType) evt.type = args.eventType as EventType;
  if (args.locations) evt.locations = args.locations as TextLocation[];
  await fs.saveMetadata(meta);
  return {
    result: { id: evt.id, title: evt.title, type: evt.type, description: evt.description.slice(0, 200) + (evt.description.length > 200 ? '…' : ''), message: `Updated event '${evt.title}'.` },
    commitChange: {
      type: 'edit',
      entityType: 'event',
      entityId: evt.id,
      entityName: evt.title,
      before: beforeDesc,
      after: evt.description,
    },
  };
}

export async function handleDeleteEvent(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const meta = await fs.getMetadata();
  const eidx = meta.events.findIndex(e => e.id === args.eventId);
  if (eidx === -1) return { result: { error: 'Event not found' } };
  const deletedEvt = meta.events.splice(eidx, 1)[0];
  // Clean up orphaned relations
  meta.relations = meta.relations.filter(r =>
    !(r.from.type === 'event' && r.from.id === deletedEvt.id) &&
    !(r.to.type === 'event' && r.to.id === deletedEvt.id)
  );
  await fs.saveMetadata(meta);
  return {
    result: { success: true, deleted: deletedEvt.id },
    commitChange: {
      type: 'delete',
      entityType: 'event',
      entityId: deletedEvt.id,
      entityName: deletedEvt.title,
      before: deletedEvt.description,
    },
  };
}
