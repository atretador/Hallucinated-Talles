import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { getEffectiveProjectsDir } from './settings';
import { generateId } from '../utils/idGenerator';
import { generatePlaceholderCovers, getCoverPaths } from './coverService';
import { DEFAULT_BOOK_SETTINGS } from '../../shared/constants';
import { SessionService } from './sessionService';
import { ImageService } from './imageService';
import type { Book, ChapterItem, PageItem, Character, StoryEvent, WorldData, StoryRelation, ChatMessage, AgentSession, SessionData, SessionCommit, ImportState, BookSettings, PlanModel, AgentTask, SubAgentRun } from '../../shared/types';

function getProjectsDir(): string {
  if (!app.isReady()) {
    throw new Error('FileService: app is not ready yet — cannot resolve projects directory');
  }
  return getEffectiveProjectsDir();
}

export class FileService {
  public readonly projectName: string;
  private projectDir: string;
  private bookId: string | undefined;

  public readonly sessions: SessionService;
  public readonly images: ImageService;

  constructor(projectName: string, bookId?: string) {
    this.projectName = projectName;
    this.projectDir = path.join(getProjectsDir(), projectName);
    this.bookId = bookId;
    this.sessions = new SessionService(this.projectDir);
    this.images = bookId ? new ImageService(this.projectDir, bookId) : null as any;
  }

  private getBookDir(): string {
    if (!this.bookId) {
      throw new Error('FileService: bookId is required');
    }
    return path.join(this.projectDir, 'books', this.bookId);
  }

  // Static methods for multi-project management
  static async listProjects(): Promise<string[]> {
    const dir = getProjectsDir();
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return [];
    }
  }

  static async createProject(name: string): Promise<void> {
    const fs2 = await import('node:fs/promises');
    const dir = path.join(getProjectsDir(), name);
    await fs2.mkdir(dir, { recursive: true });
  }

  static async listBooks(projectName: string): Promise<string[]> {
    const projectDir = path.join(getProjectsDir(), projectName);
    const booksDir = path.join(projectDir, 'books');
    try {
      const entries = await fs.readdir(booksDir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return []; // No books/ directory yet
    }
  }

  static async createBook(projectName: string, bookId: string, title: string, description = '', systemPrompt = ''): Promise<void> {
    const booksDir = path.join(getProjectsDir(), projectName, 'books', bookId);
    await fs.mkdir(path.join(booksDir, 'content', 'pages'), { recursive: true });
    const book: Book = {
      id: bookId,
      title,
      items: [],
      metadata: {
        author: '',
        description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...(systemPrompt ? { systemPrompt } : {}),
    };
    const covers = await generatePlaceholderCovers(booksDir);
    book.covers = covers;
    await fs.writeFile(path.join(booksDir, 'book.json'), JSON.stringify(book, null, 2));
    await fs.writeFile(path.join(booksDir, 'metadata.json'), JSON.stringify({ characters: [], events: [], worldData: [], relations: [] }, null, 2));
    await fs.writeFile(path.join(booksDir, 'content', 'content.html'), '<p></p>');
  }

  async ensureProjectDir(): Promise<void> {
    await fs.mkdir(this.projectDir, { recursive: true });
    const bookDir = this.getBookDir();
    await fs.mkdir(path.join(bookDir, 'content'), { recursive: true });
  }

  // Book structure
  async getBookStructure(): Promise<Book> {
    const bookDir = this.getBookDir();
    const data = await fs.readFile(path.join(bookDir, 'book.json'), 'utf-8');
    return JSON.parse(data) as Book;
  }

  async saveBookStructure(book: Book): Promise<void> {
    const tmpPath = `${path.join(this.getBookDir(), 'book.json')}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(book, null, 2));
    await fs.rename(tmpPath, path.join(this.getBookDir(), 'book.json'));
  }

  async getCovers(): Promise<{ frontCover?: string; backCover?: string }> {
    return getCoverPaths(this.getBookDir());
  }

  // Characters & Events (metadata)
  async getMetadata(): Promise<{ characters: Character[]; events: StoryEvent[]; worldData: WorldData[]; relations: StoryRelation[] }> {
    try {
      const data = await fs.readFile(path.join(this.getBookDir(), 'metadata.json'), 'utf-8');
      const parsed = JSON.parse(data);
      return {
        characters: parsed.characters ?? [],
        events: parsed.events ?? [],
        worldData: parsed.worldData ?? [],
        relations: parsed.relations ?? [],
      };
    } catch {
      return { characters: [], events: [], worldData: [], relations: [] };
    }
  }

  async saveMetadata(metadata: { characters: Character[]; events: StoryEvent[]; worldData: WorldData[]; relations: StoryRelation[] }): Promise<void> {
    const filePath = path.join(this.getBookDir(), 'metadata.json');
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(metadata, null, 2));
    await fs.rename(tmpPath, filePath);
  }

  // Page content (HTML files)
  async getPageContent(pageId: string): Promise<string> {
    const filePath = path.join(this.getBookDir(), 'content', 'pages', `${pageId}.html`);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  /** Look up a page or chapter title from the book structure. Falls back to the ID. */
  async getItemTitle(itemId: string): Promise<string> {
    try {
      const book = await this.getBookStructure();
      const item = book.items.find(i => i.id === itemId);
      return item?.title || itemId;
    } catch {
      return itemId;
    }
  }

  /** Strip dangerous HTML elements and attributes to prevent XSS from imported content */
  private sanitizeHtml(html: string): { html: string; warnings: string[] } {
    let result = html;
    const warnings: string[] = [];

    let count: number;

    count = (result.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []).length;
    if (count > 0) warnings.push(`Removed ${count} <script> tag${count !== 1 ? 's' : ''}`);
    result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

    count = (result.match(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi) || []).length;
    if (count > 0) warnings.push(`Removed ${count} <iframe> tag${count !== 1 ? 's' : ''}`);
    result = result.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');

    count = (result.match(/<object\b[^>]*>[\s\S]*?<\/object>/gi) || []).length;
    if (count > 0) warnings.push(`Removed ${count} <object> tag${count !== 1 ? 's' : ''}`);
    result = result.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');

    count = (result.match(/<embed\b[^>]*\/?>/gi) || []).length;
    if (count > 0) warnings.push(`Removed ${count} <embed> tag${count !== 1 ? 's' : ''}`);
    result = result.replace(/<embed\b[^>]*\/?>/gi, '');

    count = (result.match(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi) || []).length;
    if (count > 0) warnings.push(`Neutralized ${count} on* event handler${count !== 1 ? 's' : ''}`);
    result = result.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '');

    count = (result.match(/((?:href|src|action)\s*=\s*)(["'])javascript:[^"']*["']/gi) || []).length;
    if (count > 0) warnings.push(`Neutralized ${count} javascript: URL${count !== 1 ? 's' : ''} in href/src/action`);
    result = result.replace(/((?:href|src|action)\s*=\s*)(["'])javascript:[^"']*["']/gi, '$1$2$2');

    count = (result.match(/((?:href|src|action)\s*=\s*)(["'])data:text\/html[^"']*["']/gi) || []).length;
    if (count > 0) warnings.push(`Neutralized ${count} data:text/html URL${count !== 1 ? 's' : ''} in href/src/action`);
    result = result.replace(/((?:href|src|action)\s*=\s*)(["'])data:text\/html[^"']*["']/gi, '$1$2$2');

    return { html: result, warnings };
  }

  async savePageContent(pageId: string, content: string, warnings?: string[]): Promise<void> {
    const dir = path.join(this.getBookDir(), 'content', 'pages');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${pageId}.html`);
    const tmpPath = `${filePath}.tmp`;
    const { html, warnings: sanitizationWarnings } = this.sanitizeHtml(content);
    if (warnings) {
      warnings.push(...sanitizationWarnings);
    }
    await fs.writeFile(tmpPath, html);
    await fs.rename(tmpPath, filePath);
  }

  /** Save full book content (single HTML string) */
  async saveBookContent(content: string): Promise<void> {
    const bookDir = this.getBookDir();
    const dir = path.join(bookDir, 'content');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'content.html');
    const tmpPath = `${filePath}.tmp`;
    const { html } = this.sanitizeHtml(content);
    await fs.writeFile(tmpPath, html);
    await fs.rename(tmpPath, filePath);
  }

  /** Load full book content (single HTML string) */
  async getBookContent(): Promise<string> {
    try {
      const bookDir = this.getBookDir();
      const filePath = path.join(bookDir, 'content', 'content.html');
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return ''; // No content file yet — new book
    }
  }

  /** Write a sanitization report to the book directory and return its path */
  async writeSanitizationReport(warnings: string[]): Promise<string> {
    const bookDir = this.getBookDir();
    const reportPath = path.join(bookDir, 'sanitization-report.md');
    const timestamp = new Date().toISOString();
    const lines = [
      '# Sanitization Report',
      '',
      `Generated: ${timestamp}`,
      '',
      'The following HTML elements were stripped or neutralized during import for security:',
      '',
      ...warnings.map(w => `- ${w}`),
      '',
    ];
    await fs.writeFile(reportPath, lines.join('\n'));
    return reportPath;
  }

  async deletePageFile(pageId: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.getBookDir(), 'content', 'pages', `${pageId}.html`));
    } catch {
      console.debug('[fileService] File does not exist, ignoring');
      // File doesn't exist, ignore
    }
  }

  // Book item management (chapters and pages)
  async createPage(title?: string, chapterId?: string, afterPageId?: string, content?: string): Promise<PageItem> {
    const book = await this.getBookStructure();
    const pageId = generateId('page');
    const newItem: PageItem = { type: 'page', id: pageId, title };

    // Find insertion point
    if (afterPageId) {
      // Insert immediately after the specified page
      const afterIdx = book.items.findIndex(i => i.type === 'page' && i.id === afterPageId);
      if (afterIdx >= 0) {
        book.items.splice(afterIdx + 1, 0, newItem);
      } else {
        book.items.push(newItem);
      }
    } else if (chapterId) {
      // Insert after the last page belonging to this chapter
      const chapterIdx = book.items.findIndex(i => i.type === 'chapter' && i.id === chapterId);
      if (chapterIdx >= 0) {
        let insertIdx = chapterIdx + 1;
        while (insertIdx < book.items.length && book.items[insertIdx].type === 'page') {
          insertIdx++;
        }
        book.items.splice(insertIdx, 0, newItem);
      } else {
        book.items.push(newItem);
      }
    } else {
      book.items.push(newItem);
    }

    await this.saveBookStructure(book);
    // Create file with content (or empty)
    await this.savePageContent(pageId, content || '');
    return newItem;
  }

  async deletePage(pageId: string): Promise<boolean> {
    const book = await this.getBookStructure();
    const idx = book.items.findIndex(i => i.type === 'page' && i.id === pageId);
    if (idx < 0) return false;

    book.items.splice(idx, 1);
    await this.saveBookStructure(book);
    await this.deletePageFile(pageId);
    return true;
  }

  async createChapter(title: string): Promise<ChapterItem> {
    const book = await this.getBookStructure();
    const chapterId = generateId('chapter');
    const newItem: ChapterItem = { type: 'chapter', id: chapterId, title };
    book.items.push(newItem);
    await this.saveBookStructure(book);
    return newItem;
  }

  async deleteChapter(chapterId: string): Promise<boolean> {
    const book = await this.getBookStructure();
    const idx = book.items.findIndex(i => i.type === 'chapter' && i.id === chapterId);
    if (idx < 0) return false;

    // Remove chapter marker but keep its pages (they become loose)
    book.items.splice(idx, 1);
    await this.saveBookStructure(book);
    return true;
  }

  async moveItem(itemId: string, newIndex: number, chapterId?: string): Promise<boolean> {
    const book = await this.getBookStructure();

    // Find and remove the item from wherever it currently lives (root or a chapter's items)
    let item: PageItem | undefined;

    const rootIdx = book.items.findIndex(i => i.id === itemId);
    if (rootIdx >= 0) {
      [item] = book.items.splice(rootIdx, 1) as PageItem[];
    } else {
      // Search inside each chapter's items
      for (const chapter of book.items) {
        if (chapter.type === 'chapter') {
          const chapItems = (chapter as any).items as PageItem[] | undefined;
          if (chapItems) {
            const idx = chapItems.findIndex(i => i.id === itemId);
            if (idx >= 0) {
              [item] = chapItems.splice(idx, 1);
              break;
            }
          }
        }
      }
    }

    if (!item) return false;

    if (chapterId) {
      // Move into a chapter using the FLAT model:
      // Pages live sequentially after their chapter marker in book.items[].
      const chapterIdx = book.items.findIndex(i => i.type === 'chapter' && i.id === chapterId);
      if (chapterIdx < 0) return false;

      // Find the end of this chapter's range (next chapter marker or end of array)
      let insertIdx = chapterIdx + 1;
      while (insertIdx < book.items.length && book.items[insertIdx].type !== 'chapter') {
        insertIdx++;
      }
      // Clamp to valid range within the chapter's pages
      insertIdx = Math.max(chapterIdx + 1, Math.min(chapterIdx + 1 + newIndex, insertIdx));
      book.items.splice(insertIdx, 0, item);
    } else {
      // Reorder within root (existing behavior)
      const clampedIdx = Math.max(0, Math.min(newIndex, book.items.length));
      book.items.splice(clampedIdx, 0, item);
    }

    await this.saveBookStructure(book);
    return true;
  }

  async renameItem(itemId: string, newTitle: string): Promise<boolean> {
    const book = await this.getBookStructure();
    const item = book.items.find(i => i.id === itemId);
    if (!item) return false;

    if (item.type === 'chapter') {
      item.title = newTitle;
    } else {
      item.title = newTitle || undefined;
    }
    await this.saveBookStructure(book);
    return true;
  }

  // Chat history
  async getChatHistory(): Promise<ChatMessage[]> {
    try {
      const data = await fs.readFile(path.join(this.getBookDir(), 'chat.json'), 'utf-8');
      return JSON.parse(data) as ChatMessage[];
    } catch {
      return [];
    }
  }

  async saveChatHistory(messages: ChatMessage[]): Promise<void> {
    // Cap at 200 messages to prevent unbounded growth
    const capped = messages.slice(-200);
    const filePath = path.join(this.getBookDir(), 'chat.json');
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(capped, null, 2));
    await fs.rename(tmpPath, filePath);
  }

  // Import state
  async getImportState(): Promise<ImportState | null> {
    try {
      const data = await fs.readFile(path.join(this.getBookDir(), 'import.json'), 'utf-8');
      return JSON.parse(data) as ImportState;
    } catch {
      return null;
    }
  }

  async saveImportState(state: ImportState): Promise<void> {
    const filePath = path.join(this.getBookDir(), 'import.json');
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2));
    await fs.rename(tmpPath, filePath);
  }

  async deleteImportState(): Promise<void> {
    try {
      await fs.unlink(path.join(this.getBookDir(), 'import.json'));
    } catch {
      console.debug('[fileService] File does not exist, ignoring');
      // File doesn't exist, ignore
    }
  }

  // Book settings
  async getBookSettings(): Promise<BookSettings> {
    const book = await this.getBookStructure();
    return book.settings ?? DEFAULT_BOOK_SETTINGS;
  }

  async saveBookSettings(settings: BookSettings): Promise<void> {
    const book = await this.getBookStructure();
    book.settings = settings;
    await this.saveBookStructure(book);
  }

  // Story Planner (plan.json per book)
  async getPlan(): Promise<PlanModel | null> {
    try {
      const data = await fs.readFile(path.join(this.getBookDir(), 'plan.json'), 'utf-8');
      return JSON.parse(data) as PlanModel;
    } catch {
      return null;
    }
  }

  async savePlan(plan: PlanModel): Promise<void> {
    const filePath = path.join(this.getBookDir(), 'plan.json');
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(plan, null, 2));
    await fs.rename(tmpPath, filePath);
  }

  // ── Session delegates ──────────────────────────────────────────────

  listSessions(bookId?: string): Promise<AgentSession[]> {
    return this.sessions.listSessions(bookId);
  }

  getSession(sessionId: string): Promise<SessionData | null> {
    return this.sessions.getSession(sessionId);
  }

  createSession(title?: string, bookId?: string): Promise<AgentSession> {
    return this.sessions.createSession(title, bookId);
  }

  saveSession(sessionData: SessionData): Promise<void> {
    return this.sessions.saveSession(sessionData);
  }

  updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<AgentSession | null> {
    return this.sessions.updateSession(sessionId, updates);
  }

  deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.deleteSession(sessionId);
  }

  addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    return this.sessions.addMessage(sessionId, message);
  }

  addCommit(sessionId: string, commit: SessionCommit): Promise<void> {
    return this.sessions.addCommit(sessionId, commit);
  }

  addTask(sessionId: string, task: AgentTask): Promise<void> {
    return this.sessions.addTask(sessionId, task);
  }

  updateTask(sessionId: string, taskId: string, updates: Partial<AgentTask>): Promise<void> {
    return this.sessions.updateTask(sessionId, taskId, updates);
  }

  addSubAgentRun(sessionId: string, run: SubAgentRun): Promise<void> {
    return this.sessions.addSubAgentRun(sessionId, run);
  }

  updateSubAgentRun(sessionId: string, runId: string, updates: Partial<SubAgentRun>): Promise<void> {
    return this.sessions.updateSubAgentRun(sessionId, runId, updates);
  }

  migrateFromChatJson(): Promise<string | null> {
    return this.sessions.migrateFromChatJson();
  }

  migrateSessionsToProjectLevel(): Promise<{ migrated: number; skipped: number }> {
    return this.sessions.migrateSessionsToProjectLevel();
  }

  // ── Image delegates ────────────────────────────────────────────────

  saveImage(chapterId: string, filename: string, buffer: Buffer): Promise<string> {
    return this.images.saveImage(chapterId, filename, buffer);
  }

  getImagePath(relativePath: string): string {
    return this.images.getImagePath(relativePath);
  }

  deleteImage(relativePath: string): Promise<void> {
    return this.images.deleteImage(relativePath);
  }

  cleanupOrphanedImages(htmlContents: string[]): Promise<number> {
    return this.images.cleanupOrphanedImages(htmlContents);
  }
}
