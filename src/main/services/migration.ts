import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Move a file or directory from src to dst.
 * Uses fs.rename (atomic on same filesystem). Falls back to copy+delete for cross-device moves.
 * Preserves timestamps in the fallback path.
 */
async function move(src: string, dst: string): Promise<void> {
  try {
    await fs.rename(src, dst);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      // Cross-device link: fall back to copy+delete
      const stat = await fs.stat(src);
      if (stat.isDirectory()) {
        await fs.cp(src, dst, { recursive: true, preserveTimestamps: true });
        await fs.rm(src, { recursive: true, force: true });
      } else {
        await fs.copyFile(src, dst);
        const srcStat = await fs.stat(src);
        await fs.utimes(dst, srcStat.atime, srcStat.mtime);
        await fs.unlink(src);
      }
    } else {
      throw err;
    }
  }
}

/**
 * Migrate a single project from legacy (single-book at root) to multi-book structure.
 * Idempotent: safe to call multiple times.
 *
 * Steps:
 * 1. Check if project has `book.json` at root (legacy marker)
 * 2. Check if `books/` directory already exists and contains at least one book directory (already migrated)
 * 3. If legacy and not migrated:
 *    a. Create `books/{projectName}/` directory
 *    b. Move `book.json` → `books/{projectName}/book.json`
 *    c. Move `metadata.json` → `books/{projectName}/metadata.json`
 *    d. Move `content/` → `books/{projectName}/content/`
 *    e. Keep `sessions/` at project level (project-level sessions)
 *    f. Move `chat.json` → `books/{projectName}/chat.json` (if exists)
 * 4. Return true if migration was performed, false if already migrated or not applicable
 */
export async function migrateProjectToMultiBook(projectDir: string, projectName: string): Promise<boolean> {
  const bookJsonPath = path.join(projectDir, 'book.json');
  const booksDir = path.join(projectDir, 'books');
  const targetBookDir = path.join(booksDir, projectName);

  // 1. Check if project has book.json at root (legacy marker)
  try {
    await fs.access(bookJsonPath);
  } catch {
    return false; // Not a legacy project — nothing to migrate
  }

  // 2. Check if books/ directory already exists and has at least one book directory
  try {
    const entries = await fs.readdir(booksDir, { withFileTypes: true });
    if (entries.some(e => e.isDirectory())) {
      return false; // Already migrated
    }
  } catch {
    console.debug('[migration] booksDir does not exist yet, proceeding with migration');
    // booksDir doesn't exist yet — proceed with migration
  }

  // 3. Perform migration
  try {
    await fs.mkdir(targetBookDir, { recursive: true });

    // b. Move book.json
    await move(bookJsonPath, path.join(targetBookDir, 'book.json'));

    // c. Move metadata.json (if exists)
    const metadataPath = path.join(projectDir, 'metadata.json');
    try {
      await fs.access(metadataPath);
      await move(metadataPath, path.join(targetBookDir, 'metadata.json'));
    } catch {
      console.debug('[migration] Optional metadata.json not found, skipping');
      // Optional file — skip
    }

    // d. Move content/ (if exists)
    const contentPath = path.join(projectDir, 'content');
    try {
      await fs.access(contentPath);
      await move(contentPath, path.join(targetBookDir, 'content'));
    } catch {
      console.debug('[migration] Optional content directory not found, skipping');
      // Optional directory — skip
    }

    // e. Keep sessions/ at project level (project-level sessions)
    // Sessions remain at <projectDir>/sessions/ - no migration needed

    // f. Move chat.json (if exists)
    const chatPath = path.join(projectDir, 'chat.json');
    try {
      await fs.access(chatPath);
      await move(chatPath, path.join(targetBookDir, 'chat.json'));
    } catch {
      console.debug('[migration] Optional chat.json not found, skipping');
      // Optional file — skip
    }

    return true;
  } catch (err) {
    // Clean up partially migrated directory on failure
    try {
      await fs.rm(targetBookDir, { recursive: true, force: true });
    } catch {
      console.debug('[migration] Ignore cleanup errors');
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Migrate all projects in the projects directory.
 * Called once at app startup. Non-fatal: errors are collected and logged.
 */
export async function migrateAllProjects(
  projectsDir: string,
): Promise<{ migrated: string[]; skipped: string[]; errors: string[] }> {
  const result: { migrated: string[]; skipped: string[]; errors: string[] } = {
    migrated: [],
    skipped: [],
    errors: [],
  };

  let projectNames: string[];
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    projectNames = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    // Projects directory doesn't exist or can't be read — nothing to do
    return result;
  }

  for (const name of projectNames) {
    try {
      const projectDir = path.join(projectsDir, name);
      const migrated = await migrateProjectToMultiBook(projectDir, name);
      if (migrated) {
        result.migrated.push(name);
      } else {
        result.skipped.push(name);
      }
    } catch (err) {
      result.errors.push(name);
      console.error(`[migration] Failed to migrate project "${name}":`, err);
    }
  }

  return result;
}

/**
 * Migrate sessions from per-book directories to project-level directory.
 * For projects that were already migrated with sessions in book directories.
 * Idempotent: skips sessions that already exist at the project level.
 */
export async function migrateSessionsToProjectLevel(
  projectsDir: string,
): Promise<{ projectsProcessed: number; totalMigrated: number; totalSkipped: number }> {
  const result = { projectsProcessed: 0, totalMigrated: 0, totalSkipped: 0 };

  let projectNames: string[];
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    projectNames = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return result;
  }

  for (const name of projectNames) {
    const projectDir = path.join(projectsDir, name);
    const booksDir = path.join(projectDir, 'books');

    // Check if project has a books directory
    try {
      await fs.access(booksDir);
    } catch {
      continue;
    }

    // Check if any book has sessions directory
    let bookDirs: string[];
    try {
      const entries = await fs.readdir(booksDir, { withFileTypes: true });
      bookDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      continue;
    }

    let hasBookSessions = false;
    for (const bookId of bookDirs) {
      try {
        await fs.access(path.join(booksDir, bookId, 'sessions'));
        hasBookSessions = true;
        break;
      } catch {
        console.debug('[migration] No sessions for this book');
        // No sessions for this book
      }
    }

    if (!hasBookSessions) continue;

    // Migrate sessions for this project
    try {
      const { FileService } = await import('./fileService');
      const fileService = new FileService(name);
      const { migrated, skipped } = await fileService.migrateSessionsToProjectLevel();
      result.projectsProcessed++;
      result.totalMigrated += migrated;
      result.totalSkipped += skipped;
    } catch (err) {
      console.error(`[migration] Failed to migrate sessions for project "${name}":`, err);
    }
  }

  return result;
}
