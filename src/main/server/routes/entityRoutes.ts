import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { FileService } from '../../services/fileService';
import type { Character, StoryEvent, WorldData, StoryRelation } from '../../../shared/types';

export function entityRoutes(): Router {
  const router = Router();

  // ── Characters ──

  router.get('/api/characters', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const { characters } = await fileService.getMetadata();
      res.json({ success: true, data: characters });
    } catch (error) {
      console.error('[characters] Failed to load characters:', error);
      res.json({ success: true, data: [] });
    }
  });

  router.post('/api/characters', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const newCharacter: Character = {
        ...(req.body as Partial<Character>),
        id: `char-${Date.now()}`,
        bookId: req.bookId || req.projectId,
        aliases: (req.body as Partial<Character>).aliases ?? [],
        attributes: (req.body as Partial<Character>).attributes ?? [],
        entries: (req.body as Partial<Character>).entries ?? [],
        relations: (req.body as Partial<Character>).relations ?? [],
        storyPoints: (req.body as Partial<Character>).storyPoints ?? [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Character;
      meta.characters.push(newCharacter);
      await fileService.saveMetadata(meta);
      res.json({ success: true, data: newCharacter });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/characters/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const index = meta.characters.findIndex(c => c.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'Character not found' });
        return;
      }
      meta.characters[index] = {
        ...meta.characters[index],
        ...(req.body as Partial<Character>),
        updatedAt: new Date().toISOString(),
      } as Character;
      await fileService.saveMetadata(meta);
      res.json({ success: true, data: meta.characters[index] });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/characters/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const index = meta.characters.findIndex(c => c.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'Character not found' });
        return;
      }
      const deletedId = meta.characters[index].id;
      meta.characters.splice(index, 1);
      meta.relations = meta.relations.filter(r =>
        !(r.from.type === 'character' && r.from.id === deletedId) &&
        !(r.to.type === 'character' && r.to.id === deletedId)
      );
      await fileService.saveMetadata(meta);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── Events ──

  router.get('/api/events', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const { events } = await fileService.getMetadata();
      res.json({ success: true, data: events });
    } catch (error) {
      console.error('[events] Failed to load events:', error);
      res.json({ success: true, data: [] });
    }
  });

  router.post('/api/events', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const newEvent: StoryEvent = {
        ...(req.body as Partial<StoryEvent>),
        id: `event-${Date.now()}`,
        bookId: req.bookId || req.projectId,
        characters: (req.body as Partial<StoryEvent>).characters ?? [],
        consequences: (req.body as Partial<StoryEvent>).consequences ?? [],
        locations: (req.body as Partial<StoryEvent>).locations ?? [],
      } as StoryEvent;
      meta.events.push(newEvent);
      await fileService.saveMetadata(meta);
      res.json({ success: true, data: newEvent });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/events/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const index = meta.events.findIndex(e => e.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'Event not found' });
        return;
      }
      meta.events[index] = {
        ...meta.events[index],
        ...(req.body as Partial<StoryEvent>),
      } as StoryEvent;
      await fileService.saveMetadata(meta);
      res.json({ success: true, data: meta.events[index] });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/events/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const index = meta.events.findIndex(e => e.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'Event not found' });
        return;
      }
      const deletedId = meta.events[index].id;
      meta.events.splice(index, 1);
      meta.relations = meta.relations.filter(r =>
        !(r.from.type === 'event' && r.from.id === deletedId) &&
        !(r.to.type === 'event' && r.to.id === deletedId)
      );
      await fileService.saveMetadata(meta);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── World Data ──

  router.get('/api/world-data', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const { worldData } = await fileService.getMetadata();
      res.json({ success: true, data: worldData });
    } catch (error) {
      console.error('[world-data] Failed to load world data:', error);
      res.status(500).json({ success: false, error: 'Failed to load world data' });
    }
  });

  router.post('/api/world-data', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const { name, shortDescription, content, category, attributes, aliases, tags } = req.body as Partial<WorldData>;
      if (!name?.trim() || !shortDescription?.trim() || !content?.trim()) {
        res.status(400).json({ success: false, error: 'name, shortDescription, and content are required' });
        return;
      }
      const meta = await fileService.getMetadata();
      const id = `world-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const newEntry: WorldData = {
        id,
        bookId: req.bookId || req.projectId,
        name: name.trim(),
        shortDescription: shortDescription.trim(),
        content: content.trim(),
        category: category || undefined,
        attributes: attributes || undefined,
        aliases: aliases || undefined,
        tags: tags || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      meta.worldData.push(newEntry);
      await fileService.saveMetadata(meta);
      res.json({ success: true, data: newEntry });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/world-data/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const index = meta.worldData.findIndex(w => w.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'World data entry not found' });
        return;
      }
      const body = req.body as Partial<WorldData>;
      if (body.name) meta.worldData[index].name = body.name;
      if (body.shortDescription) meta.worldData[index].shortDescription = body.shortDescription;
      if (body.content) meta.worldData[index].content = body.content;
      if (body.category !== undefined) meta.worldData[index].category = body.category;
      if (body.attributes !== undefined) meta.worldData[index].attributes = body.attributes;
      if (body.aliases !== undefined) meta.worldData[index].aliases = body.aliases;
      if (body.tags !== undefined) meta.worldData[index].tags = body.tags;
      meta.worldData[index].updatedAt = new Date().toISOString();
      await fileService.saveMetadata(meta);
      res.json({ success: true, data: meta.worldData[index] });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/world-data/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const index = meta.worldData.findIndex(w => w.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'World data entry not found' });
        return;
      }
      const deletedId = meta.worldData[index].id;
      meta.worldData.splice(index, 1);
      meta.relations = meta.relations.filter(r =>
        !(r.from.type === 'worldData' && r.from.id === deletedId) &&
        !(r.to.type === 'worldData' && r.to.id === deletedId)
      );
      await fileService.saveMetadata(meta);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── Relations ──

  router.get('/api/relations', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const { relations } = await fileService.getMetadata();
      res.json({ success: true, data: relations });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/relations', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const { from, to, type, label, description, tags } = req.body as Partial<StoryRelation>;
      if (!from || !to || !type?.trim() || !description?.trim()) {
        res.status(400).json({ success: false, error: 'from, to, type, and description are required' });
        return;
      }
      const meta = await fileService.getMetadata();
      const id = `rel-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const newRelation: StoryRelation = {
        id,
        bookId: req.bookId || req.projectId,
        from: from,
        to: to,
        type: type.trim(),
        label: label || undefined,
        description: description.trim(),
        tags: tags || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      meta.relations.push(newRelation);
      await fileService.saveMetadata(meta);
      res.json({ success: true, data: newRelation });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/relations/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const index = meta.relations.findIndex(r => r.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'Relation not found' });
        return;
      }
      const body = req.body as Partial<StoryRelation>;
      if (body.type) meta.relations[index].type = body.type;
      if (body.label !== undefined) meta.relations[index].label = body.label;
      if (body.description) meta.relations[index].description = body.description;
      if (body.tags !== undefined) meta.relations[index].tags = body.tags;
      meta.relations[index].updatedAt = new Date().toISOString();
      await fileService.saveMetadata(meta);
      res.json({ success: true, data: meta.relations[index] });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/relations/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const meta = await fileService.getMetadata();
      const index = meta.relations.findIndex(r => r.id === req.params.id);
      if (index === -1) {
        res.status(404).json({ success: false, error: 'Relation not found' });
        return;
      }
      meta.relations.splice(index, 1);
      await fileService.saveMetadata(meta);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/relations/entity/:entityType/:entityId', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId, req.bookId || undefined);
      const { relations } = await fileService.getMetadata();
      const { entityType, entityId } = req.params;
      const filtered = relations.filter(r =>
        (r.from.type === entityType && r.from.id === entityId) ||
        (r.to.type === entityType && r.to.id === entityId)
      );
      res.json({ success: true, data: filtered });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
