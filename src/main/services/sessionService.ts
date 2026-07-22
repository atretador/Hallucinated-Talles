import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite } from '../utils/atomicWrite';
import type { AgentSession, SessionData, SessionCommit, AgentTask, SubAgentRun, ChatMessage } from '../../shared/types';

export class SessionService {
  private projectDir: string;
  // Per-session write lock: serializes all read-modify-write operations on a
  // given session file so that concurrent addMessage, addCommit, updateSession,
  // addTask, addSubAgentRun, etc. cannot interleave reads and writes.
  private sessionLocks = new Map<string, Promise<void>>();

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /**
   * Serialize an async operation for a given session ID.
   * Each session gets its own lock chain so operations on different sessions
   * remain fully parallel.
   */
  private async withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.sessionLocks.get(sessionId) ?? Promise.resolve();
    const next = prev.then(fn, fn); // run fn regardless of whether prev succeeded
    this.sessionLocks.set(sessionId, next.then(() => {}, () => {}));
    return next;
  }

  private getSessionsDir(): string {
    return path.join(this.projectDir, 'sessions');
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.getSessionsDir(), `${sessionId}.json`);
  }

  private getIndexPath(): string {
    return path.join(this.getSessionsDir(), 'index.json');
  }

  async listSessions(bookId?: string): Promise<AgentSession[]> {
    try {
      const data = await fs.readFile(this.getIndexPath(), 'utf-8');
      const sessions = JSON.parse(data) as AgentSession[];
      if (bookId) {
        return sessions.filter(s => s.bookId === bookId);
      }
      return sessions;
    } catch {
      // Rebuild index from session files
      return this.rebuildSessionIndex(bookId);
    }
  }

  private async rebuildSessionIndex(bookId?: string): Promise<AgentSession[]> {
    const sessionDir = this.getSessionsDir();
    try {
      await fs.mkdir(sessionDir, { recursive: true });
      const files = await fs.readdir(sessionDir);
      const jsonFiles = files.filter(f => f.startsWith('ses-') && f.endsWith('.json'));
      const sessions: AgentSession[] = [];
      for (const file of jsonFiles) {
        try {
          const data = await fs.readFile(path.join(sessionDir, file), 'utf-8');
          const sessionData = JSON.parse(data) as SessionData;
          sessions.push(sessionData.session);
        } catch (err) {
          console.warn('[sessionService] Skip corrupted files:', err);
          // Skip corrupted files
        }
      }
      sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      await atomicWrite(this.getIndexPath(), JSON.stringify(sessions, null, 2));
      if (bookId) {
        return sessions.filter(s => s.bookId === bookId);
      }
      return sessions;
    } catch {
      return [];
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const data = await fs.readFile(this.getSessionFilePath(sessionId), 'utf-8');
      return JSON.parse(data) as SessionData;
    } catch {
      return null;
    }
  }

  async createSession(title?: string, bookId?: string): Promise<AgentSession> {
    const sessionDir = this.getSessionsDir();
    await fs.mkdir(sessionDir, { recursive: true });

    const id = `ses-${Date.now()}`;
    const now = new Date().toISOString();
    const session: AgentSession = {
      id,
      title: title || 'New Session',
      bookId,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      messageCount: 0,
      commitCount: 0,
    };

    const sessionData: SessionData = {
      session,
      messages: [],
      commits: [],
      tasks: [],
      subAgentRuns: [],
    };

    await atomicWrite(this.getSessionFilePath(id), JSON.stringify(sessionData, null, 2));

    // Update index
    const sessions = await this.listSessions();
    sessions.unshift(session);
    await atomicWrite(this.getIndexPath(), JSON.stringify(sessions, null, 2));

    return session;
  }

  async saveSession(sessionData: SessionData): Promise<void> {
    sessionData.session.updatedAt = new Date().toISOString();
    sessionData.session.messageCount = sessionData.messages.length;
    sessionData.session.commitCount = sessionData.commits.length;
    sessionData.session.taskCount = sessionData.tasks?.length ?? 0;
    sessionData.session.subAgentRunCount = sessionData.subAgentRuns?.length ?? 0;

    await atomicWrite(
      this.getSessionFilePath(sessionData.session.id),
      JSON.stringify(sessionData, null, 2),
    );

    // Update index
    const sessions = await this.listSessions();
    const idx = sessions.findIndex(s => s.id === sessionData.session.id);
    if (idx >= 0) {
      sessions[idx] = sessionData.session;
    } else {
      sessions.unshift(sessionData.session);
    }
    await atomicWrite(this.getIndexPath(), JSON.stringify(sessions, null, 2));
  }

  async updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<AgentSession | null> {
    return this.withSessionLock(sessionId, async () => {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) return null;

      Object.assign(sessionData.session, updates);
      await this.saveSession(sessionData);
      return sessionData.session;
    });
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await fs.unlink(this.getSessionFilePath(sessionId));
      const sessions = await this.listSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      await atomicWrite(this.getIndexPath(), JSON.stringify(filtered, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    await this.withSessionLock(sessionId, async () => {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) return;

      sessionData.messages.push(message);
      await this.saveSession(sessionData);
    });
  }

  async addCommit(sessionId: string, commit: SessionCommit): Promise<void> {
    await this.withSessionLock(sessionId, async () => {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) return;

      sessionData.commits.push(commit);
      await this.saveSession(sessionData);
    });
  }

  async addTask(sessionId: string, task: AgentTask): Promise<void> {
    await this.withSessionLock(sessionId, async () => {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) return;

      if (!sessionData.tasks) sessionData.tasks = [];
      sessionData.tasks.push(task);
      await this.saveSession(sessionData);
    });
  }

  async updateTask(sessionId: string, taskId: string, updates: Partial<AgentTask>): Promise<void> {
    await this.withSessionLock(sessionId, async () => {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) return;

      if (!sessionData.tasks) sessionData.tasks = [];
      const idx = sessionData.tasks.findIndex(t => t.id === taskId);
      if (idx >= 0) {
        Object.assign(sessionData.tasks[idx], updates);
      }
      await this.saveSession(sessionData);
    });
  }

  async addSubAgentRun(sessionId: string, run: SubAgentRun): Promise<void> {
    await this.withSessionLock(sessionId, async () => {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) return;

      if (!sessionData.subAgentRuns) sessionData.subAgentRuns = [];
      sessionData.subAgentRuns.push(run);
      await this.saveSession(sessionData);
    });
  }

  async updateSubAgentRun(sessionId: string, runId: string, updates: Partial<SubAgentRun>): Promise<void> {
    await this.withSessionLock(sessionId, async () => {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) return;

      if (!sessionData.subAgentRuns) sessionData.subAgentRuns = [];
      const idx = sessionData.subAgentRuns.findIndex(r => r.id === runId);
      if (idx >= 0) {
        Object.assign(sessionData.subAgentRuns[idx], updates);
      }
      await this.saveSession(sessionData);
    });
  }

  // Migrate from legacy chat.json to sessions
  async migrateFromChatJson(): Promise<string | null> {
    const sessionsDir = this.getSessionsDir();
    const indexPath = this.getIndexPath();

    // Check if already migrated
    try {
      await fs.access(indexPath);
      return null; // Already migrated
    } catch {
      // Not migrated yet, proceed
    }

    // Read existing chat history — this method is now needed here.
    // We read chat.json from the project dir via a file path.
    // Note: chat.json was per-book, but migration to sessions is project-level.
    // The caller (FileService facade) will handle this if needed.
    // For now, legacy path: read from first book's chat.json
    const booksDir = path.join(this.projectDir, 'books');
    let messages: ChatMessage[] = [];
    try {
      const entries = await fs.readdir(booksDir, { withFileTypes: true });
      const bookDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      for (const bookId of bookDirs) {
        try {
          const data = await fs.readFile(path.join(booksDir, bookId, 'chat.json'), 'utf-8');
          messages = JSON.parse(data) as ChatMessage[];
          if (messages.length > 0) break;
        } catch {
          // No chat.json in this book
        }
      }
    } catch {
      // No books directory
    }

    if (messages.length === 0) return null;

    // Create migration session
    const id = 'ses-migration';
    const session: AgentSession = {
      id,
      title: 'Previous Conversation',
      bookId: undefined,
      createdAt: messages[0]?.timestamp || new Date().toISOString(),
      updatedAt: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
      status: 'active',
      messageCount: messages.length,
      commitCount: 0,
    };

    const sessionData: SessionData = {
      session,
      messages,
      commits: [],
    };

    await fs.mkdir(sessionsDir, { recursive: true });
    await atomicWrite(this.getSessionFilePath(id), JSON.stringify(sessionData, null, 2));
    await atomicWrite(indexPath, JSON.stringify([session], null, 2));

    return id;
  }

  /**
   * Migrate sessions from per-book directories to project-level sessions directory.
   * Scans all books in the project, moves their sessions to `<projectDir>/sessions/`,
   * and stamps each session with the bookId it came from.
   * Idempotent: skips sessions that already exist at the project level.
   */
  async migrateSessionsToProjectLevel(): Promise<{ migrated: number; skipped: number }> {
    const projectSessionsDir = this.getSessionsDir();
    const projectIndexPath = this.getIndexPath();
    const result = { migrated: 0, skipped: 0 };

    // Ensure project-level sessions dir exists
    await fs.mkdir(projectSessionsDir, { recursive: true });

    // Load existing project-level sessions index to know what's already migrated
    let existingSessions: AgentSession[] = [];
    try {
      const data = await fs.readFile(projectIndexPath, 'utf-8');
      existingSessions = JSON.parse(data) as AgentSession[];
    } catch {
      // No index yet
    }
    const existingIds = new Set(existingSessions.map(s => s.id));

    // Scan all books
    const booksDir = path.join(this.projectDir, 'books');
    let bookDirs: string[] = [];
    try {
      const entries = await fs.readdir(booksDir, { withFileTypes: true });
      bookDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return result; // No books directory
    }

    for (const bookId of bookDirs) {
      const bookSessionsDir = path.join(booksDir, bookId, 'sessions');
      try {
        await fs.access(bookSessionsDir);
      } catch {
        continue; // No sessions for this book
      }

      let files: string[];
      try {
        files = await fs.readdir(bookSessionsDir);
      } catch {
        continue;
      }

      const jsonFiles = files.filter(f => f.startsWith('ses-') && f.endsWith('.json'));

      for (const file of jsonFiles) {
        const sessionId = file.replace('.json', '');
        if (existingIds.has(sessionId)) {
          result.skipped++;
          continue;
        }

        try {
          const data = await fs.readFile(path.join(bookSessionsDir, file), 'utf-8');
          const sessionData = JSON.parse(data) as SessionData;

          // Stamp with bookId if not already set
          if (!sessionData.session.bookId) {
            sessionData.session.bookId = bookId;
          }

          // Write to project-level directory
          await atomicWrite(
            path.join(projectSessionsDir, file),
            JSON.stringify(sessionData, null, 2),
          );

          existingSessions.push(sessionData.session);
          existingIds.add(sessionId);
          result.migrated++;
        } catch (err) {
          console.warn('[sessionService] Skip corrupted files:', err);
          // Skip corrupted files
        }
      }

      // Also migrate the book-level index.json entries
      try {
        const indexData = await fs.readFile(path.join(bookSessionsDir, 'index.json'), 'utf-8');
        const bookSessions = JSON.parse(indexData) as AgentSession[];
        for (const s of bookSessions) {
          if (!existingIds.has(s.id)) {
            if (!s.bookId) s.bookId = bookId;
            existingSessions.push(s);
            existingIds.add(s.id);
          }
        }
      } catch {
        // No index file
      }
    }

    // Sort and write the merged index
    existingSessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    await atomicWrite(projectIndexPath, JSON.stringify(existingSessions, null, 2));

    return result;
  }
}
