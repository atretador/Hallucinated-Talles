import { Router } from 'express';
import type { Request, Response } from 'express';
import { FileService } from '../../services/fileService';
import type { SessionCommit, CommitChange } from '../../../shared/types';

export function sessionRoutes(): Router {
  const router = Router();

  // Sessions (project-level)
  router.post('/api/sessions/migrate', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const migratedSessionId = await fileService.migrateFromChatJson();
      res.json({ success: true, data: { migratedSessionId } });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sessions/migrate-to-project', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const result = await fileService.migrateSessionsToProjectLevel();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/sessions', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const filterBookId = (req.query.bookId as string) || undefined;
      const sessions = await fileService.listSessions(filterBookId);
      res.json({ success: true, data: sessions });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sessions', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const bookId = req.body.bookId || req.bookId || undefined;
      const session = await fileService.createSession(req.body.title, bookId);
      res.json({ success: true, data: session });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/sessions/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const sessionData = await fileService.getSession(req.params.id as string);
      if (!sessionData) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      res.json({ success: true, data: sessionData });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/sessions/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const session = await fileService.updateSession(req.params.id as string, req.body);
      if (!session) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      res.json({ success: true, data: session });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.delete('/api/sessions/:id', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const deleted = await fileService.deleteSession(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sessions/:id/messages', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      await fileService.addMessage(req.params.id as string, req.body.message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/sessions/:id/commits', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const sessionData = await fileService.getSession(req.params.id as string);
      if (!sessionData) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      res.json({ success: true, data: sessionData.commits });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sessions/:id/undo-change', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        res.status(400).json({ success: false, error: 'entityType and entityId are required' });
        return;
      }

      // Load session
      const sessionData = await fileService.getSession(req.params.id as string);
      if (!sessionData) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }

      // Find the most recent commit with a change for this entity that has a 'before' snapshot
      let targetChange: CommitChange | null = null;
      for (let i = sessionData.commits.length - 1; i >= 0; i--) {
        const commit = sessionData.commits[i];
        for (const change of commit.changes) {
          if (change.entityType === entityType && change.entityId === entityId && change.before) {
            targetChange = change;
            break;
          }
        }
        if (targetChange) break;
      }

      if (!targetChange) {
        res.status(404).json({ success: false, error: 'No undoable change found for this entity' });
        return;
      }

      // Restore the content based on entity type
      if (entityType === 'page' || entityType === 'chapter') {
        // Get current content to use as 'before' in the undo commit
        const currentContent = await fileService.getPageContent(entityId);
        await fileService.savePageContent(entityId, targetChange.before!);

        // Create undo commit
        const undoCommit: SessionCommit = {
          id: `undo-${Date.now()}`,
          sessionId: req.params.id as string,
          timestamp: new Date().toISOString(),
          message: `Undo: ${targetChange.entityName || entityId}`,
          changes: [{
            type: 'undo',
            entityType: entityType as CommitChange['entityType'],
            entityId,
            entityName: targetChange.entityName,
            before: currentContent || undefined,
            after: targetChange.before,
          }],
        };

        await fileService.addCommit(req.params.id as string, undoCommit);

        res.json({ success: true, data: { commit: undoCommit } });
        return;
      }

      res.status(400).json({ success: false, error: `Undo not supported for entity type: ${entityType}` });
    } catch (error) {
      console.error('Error undoing change:', error);
      res.status(500).json({ success: false, error: 'Failed to undo change' });
    }
  });

  router.get('/api/sessions/:id/tasks', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const sessionData = await fileService.getSession(req.params.id as string);
      if (!sessionData) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      res.json({ success: true, data: sessionData.tasks ?? [] });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.get('/api/sessions/:id/sub-agent-runs', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const sessionData = await fileService.getSession(req.params.id as string);
      if (!sessionData) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      res.json({ success: true, data: sessionData.subAgentRuns ?? [] });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sessions/:id/tasks', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      await fileService.addTask(req.params.id as string, req.body.task);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/sessions/:id/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      await fileService.updateTask(req.params.id as string, req.params.taskId as string, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sessions/:id/sub-agent-runs', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      await fileService.addSubAgentRun(req.params.id as string, req.body.run);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.put('/api/sessions/:id/sub-agent-runs/:runId', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      await fileService.updateSubAgentRun(req.params.id as string, req.params.runId as string, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  router.post('/api/sessions/:id/fork', async (req: Request, res: Response) => {
    try {
      const fileService = new FileService(req.projectId);
      const original = await fileService.getSession(req.params.id as string);
      if (!original) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      const newSession = await fileService.createSession(
        req.body.title || `Fork of ${original.session.title}`,
        original.session.bookId,
      );
      const forkData = await fileService.getSession(newSession.id);
      if (forkData) {
        forkData.messages = [...original.messages];
        forkData.commits = [...original.commits];
        forkData.tasks = [...(original.tasks ?? [])];
        forkData.subAgentRuns = [...(original.subAgentRuns ?? [])];
        await fileService.saveSession(forkData);
      }
      res.json({ success: true, data: newSession });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  return router;
}
