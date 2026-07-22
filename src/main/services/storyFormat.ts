import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import type { Book, Character, StoryEvent, WorldData, StoryRelation, ImportState } from '../../shared/types';

interface StoryManifest {
  version: string;
  format: 'story';
  createdAt: string;
  bookId: string;
  bookTitle: string;
}

interface StoryArchive {
  manifest: StoryManifest;
  book: Book;
  metadata: { characters: Character[]; events: StoryEvent[]; worldData: WorldData[]; relations: StoryRelation[] };
  importState?: ImportState;
  contentFiles: { path: string; content: string }[];
  sessionFiles: { path: string; content: string }[];
  coverFiles: { path: string; content: Buffer }[];
}

export class StoryFormat {
  /**
   * Export a book to .story format (ZIP archive)
   */
  static async exportToStory(bookDir: string, book: Book): Promise<Buffer> {
    const zip = new JSZip();

    // Create manifest
    const manifest: StoryManifest = {
      version: '1.0.0',
      format: 'story',
      createdAt: new Date().toISOString(),
      bookId: book.id,
      bookTitle: book.title,
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('book.json', JSON.stringify(book, null, 2));

    // Read metadata
    try {
      const metadataData = await fs.readFile(path.join(bookDir, 'metadata.json'), 'utf-8');
      zip.file('metadata.json', metadataData);
    } catch {
      zip.file('metadata.json', JSON.stringify({ characters: [], events: [], worldData: [], relations: [] }, null, 2));
    }

    // Read import state if exists
    try {
      const importData = await fs.readFile(path.join(bookDir, 'import.json'), 'utf-8');
      zip.file('import.json', importData);
    } catch {
      console.debug('[storyFormat] No import state, skipping');
      // No import state, skip
    }

    // Read content files
    const contentDir = path.join(bookDir, 'content');
    try {
      await this.addDirectoryToZip(zip, contentDir, 'content');
    } catch {
      console.debug('[storyFormat] No content directory, skipping');
      // No content directory
    }

    // Read session files
    const sessionsDir = path.join(bookDir, 'sessions');
    try {
      await this.addDirectoryToZip(zip, sessionsDir, 'sessions');
    } catch {
      console.debug('[storyFormat] No sessions directory, skipping');
      // No sessions directory
    }

    // Read cover images
    const coversDir = path.join(bookDir, 'covers');
    try {
      await this.addDirectoryToZip(zip, coversDir, 'covers');
    } catch {
      console.debug('[storyFormat] No covers directory, skipping');
      // No covers directory
    }

    return zip.generateAsync({ type: 'nodebuffer' });
  }

  /**
   * Import a .story file and extract to book directory
   */
  static async importFromStory(storyBuffer: Buffer, targetDir: string): Promise<StoryArchive> {
    const zip = await JSZip.loadAsync(storyBuffer);

    // Read manifest
    const manifestData = await zip.file('manifest.json')?.async('string');
    if (!manifestData) throw new Error('Invalid .story file: missing manifest.json');
    let manifest: StoryManifest;
    try {
      manifest = JSON.parse(manifestData) as StoryManifest;
    } catch {
      throw new Error('Corrupt manifest.json in .story file');
    }

    // Read book structure
    const bookData = await zip.file('book.json')?.async('string');
    if (!bookData) throw new Error('Invalid .story file: missing book.json');
    let book: Book;
    try {
      book = JSON.parse(bookData) as Book;
    } catch {
      throw new Error('Corrupt book.json in .story file');
    }

    // Read metadata
    const metadataData = await zip.file('metadata.json')?.async('string');
    let metadata: { characters: Character[]; events: StoryEvent[]; worldData: WorldData[]; relations: StoryRelation[] };
    if (metadataData) {
      try {
        metadata = JSON.parse(metadataData);
        // Ensure relations array exists for old .story files
        if (!metadata.relations) metadata.relations = [];
      } catch {
        throw new Error('Corrupt metadata.json in .story file');
      }
    } else {
      metadata = { characters: [], events: [], worldData: [], relations: [] };
    }

    // Read import state
    const importData = await zip.file('import.json')?.async('string');
    let importState: ImportState | undefined;
    if (importData) {
      try {
        importState = JSON.parse(importData) as ImportState;
      } catch {
        throw new Error('Corrupt import.json in .story file');
      }
    }

    // Extract content files
    const contentFiles: { path: string; content: string }[] = [];
    const contentPrefix = 'content/';
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (relativePath.startsWith(contentPrefix) && zipEntry.name.endsWith('.html')) {
        const content = await zipEntry.async('string');
        contentFiles.push({ path: relativePath, content });
      }
    }

    // Extract session files
    const sessionFiles: { path: string; content: string }[] = [];
    const sessionsPrefix = 'sessions/';
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (relativePath.startsWith(sessionsPrefix) && zipEntry.name.endsWith('.json')) {
        const content = await zipEntry.async('string');
        sessionFiles.push({ path: relativePath, content });
      }
    }

    // Extract cover files
    const coverFiles: { path: string; content: Buffer }[] = [];
    const coversPrefix = 'covers/';
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (relativePath.startsWith(coversPrefix) && !zipEntry.dir) {
        const content = await zipEntry.async('nodebuffer');
        coverFiles.push({ path: relativePath, content });
      }
    }

    // Write to target directory
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, 'book.json'), bookData);
    await fs.writeFile(path.join(targetDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    if (importData) {
      await fs.writeFile(path.join(targetDir, 'import.json'), importData);
    }

    // Write content files
    for (const file of contentFiles) {
      const filePath = path.join(targetDir, file.path);
      if (!filePath.startsWith(targetDir + path.sep)) {
        throw new Error(`Invalid path in .story file: ${file.path}`);
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }

    // Write session files
    for (const file of sessionFiles) {
      const filePath = path.join(targetDir, file.path);
      if (!filePath.startsWith(targetDir + path.sep)) {
        throw new Error(`Invalid path in .story file: ${file.path}`);
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }

    // Write cover files
    for (const file of coverFiles) {
      const filePath = path.join(targetDir, file.path);
      if (!filePath.startsWith(targetDir + path.sep)) {
        throw new Error(`Invalid path in .story file: ${file.path}`);
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }

    return { manifest, book, metadata, importState, contentFiles, sessionFiles, coverFiles };
  }

  /**
   * Helper: recursively add directory contents to ZIP
   */
  private static async addDirectoryToZip(zip: JSZip, dirPath: string, zipPrefix: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const zipPath = `${zipPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await this.addDirectoryToZip(zip, fullPath, zipPath);
      } else {
        const content = await fs.readFile(fullPath);
        zip.file(zipPath, content);
      }
    }
  }
}
