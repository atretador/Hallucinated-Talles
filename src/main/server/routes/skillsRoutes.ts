import { Router } from 'express';
import type { Request, Response } from 'express';
import * as skillsService from '../../services/skillsService';
import { getActiveSkillIds, setActiveSkillIds } from '../../services/settings';
import type { WritingSkill } from '../../../shared/types';

export function skillsRoutes(): Router {
  const router = Router();

  /** GET /api/skills — list all skills (global + project, project overrides global) */
  router.get('/api/skills', async (req: Request, res: Response) => {
    try {
      const skills = await skillsService.listSkills(req.projectId);
      res.json({ success: true, data: skills });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  /** GET /api/skills/active — get active skill IDs */
  router.get('/api/skills/active', (_req: Request, res: Response) => {
    try {
      const ids = getActiveSkillIds();
      res.json({ success: true, data: ids });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  /** POST /api/skills/active — set active skill IDs */
  router.post('/api/skills/active', (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids: string[] };
      setActiveSkillIds(ids ?? []);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  /** GET /api/skills/:id — get a single skill */
  router.get('/api/skills/:id', async (req: Request, res: Response) => {
    try {
      const skillId = req.params.id as string;
      const skill = await skillsService.getSkill(req.projectId, skillId);
      if (!skill) {
        res.status(404).json({ success: false, error: 'Skill not found' });
        return;
      }
      res.json({ success: true, data: skill });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  /** POST /api/skills — create a new skill */
  router.post('/api/skills', async (req: Request, res: Response) => {
    try {
      const { name, description, instructions, scope } = req.body as {
        name: string; description?: string; instructions: string; scope?: 'global' | 'project';
      };
      if (!name || !instructions) {
        res.status(400).json({ success: false, error: 'name and instructions are required' });
        return;
      }
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
      const skill: WritingSkill = {
        id,
        name,
        description: description ?? '',
        instructions,
        createdAt: '',
        updatedAt: '',
      };
      const saved = await skillsService.saveSkill(req.projectId, skill, scope ?? 'global');
      res.json({ success: true, data: saved });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  /** PUT /api/skills/:id — update an existing skill */
  router.put('/api/skills/:id', async (req: Request, res: Response) => {
    try {
      const skillId = req.params.id as string;
      const { name, description, instructions, scope } = req.body as {
        name?: string; description?: string; instructions?: string; scope?: 'global' | 'project';
      };
      const existing = await skillsService.getSkill(req.projectId, skillId);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Skill not found' });
        return;
      }
      const updated: WritingSkill = {
        ...existing,
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(instructions !== undefined && { instructions }),
      };
      const saved = await skillsService.saveSkill(req.projectId, updated, scope ?? 'global');
      res.json({ success: true, data: saved });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  /** DELETE /api/skills/:id — delete a skill */
  router.delete('/api/skills/:id', async (req: Request, res: Response) => {
    try {
      const skillId = req.params.id as string;
      const deleted = await skillsService.deleteSkill(req.projectId, skillId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Skill not found' });
        return;
      }
      const activeIds = getActiveSkillIds();
      if (activeIds.includes(skillId)) {
        setActiveSkillIds(activeIds.filter(id => id !== skillId));
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
