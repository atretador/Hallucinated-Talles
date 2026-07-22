import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
import Store from 'electron-store';
import { createServer, shutdownMcpServers } from './server/index.js';
import { AiService } from './services/aiService.js';
import { createMenu } from './menu.js';
import { migrateAllProjects, migrateSessionsToProjectLevel } from './services/migration.js';
import { getEffectiveProjectsDir } from './services/settings.js';
import { listSubAgentRuns, cancelSubAgentRun } from './services/subAgentService.js';
import { isWithinDirectory } from './utils/pathValidation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr) {
        srv.close(() => resolve(addr.port));
      } else {
        reject(new Error('Failed to get free port'));
      }
    });
  });
}

let mainWindow: BrowserWindow | null = null;
let serverPort: number;

// IPC: Open file path in OS default application
ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
  return shell.openPath(filePath);
});

// IPC: File dialog
ipcMain.handle('dialog:openFile', async (_event, filters?: Electron.FileFilter[]) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters ?? [
      { name: 'Books', extensions: ['pdf', 'docx', 'odt', 'txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result;
});

// IPC: Read file as base64 data URL — restricted to the configured projects directory
ipcMain.handle('fs:readFileAsBase64', async (_event, filePath: string, projectId?: string) => {
  const fs = await import('node:fs/promises');
  const pathMod = await import('node:path');
  try {
    // Security: resolve the file path and ensure it's within the projects directory
    const projectsDir = getEffectiveProjectsDir();
    const resolved = pathMod.default.resolve(filePath);

    if (projectId) {
      // If projectId provided, restrict to that project's directory
      const projectDir = pathMod.default.join(projectsDir, projectId);
      if (!isWithinDirectory(resolved, projectDir)) {
        console.warn('[IPC] fs:readFileAsBase64 blocked — path escapes project directory:', filePath);
        return null;
      }
    } else {
      // No projectId: at minimum, restrict to the projects directory
      if (!isWithinDirectory(resolved, projectsDir)) {
        console.warn('[IPC] fs:readFileAsBase64 blocked — path escapes projects directory:', filePath);
        return null;
      }
    }

    const buffer = await fs.readFile(resolved);
    const ext = pathMod.default.extname(resolved).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      bmp: 'image/bmp',
    };
    const mime = mimeMap[ext] || 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
});

// IPC: Get system fonts via OS-native commands
ipcMain.handle('fonts:getSystemFonts', async () => {
  try {
    let output: string;
    if (process.platform === 'linux') {
      const { stdout } = await execAsync("fc-list --format='%{family}\\n'");
      output = stdout;
    } else if (process.platform === 'darwin') {
      const { stdout } = await execAsync("system_profiler SPFontsDataType | grep 'Family: ' | sed 's/.*: //'");
      output = stdout;
    } else {
      // Windows
      const { stdout } = await execAsync('powershell -Command "[System.Drawing.Text.InstalledFontCollection]::new().Families | ForEach-Object { $_.Name }"');
      output = stdout;
    }
    const fonts = [...new Set(output.split('\n').map(l => l.trim()).filter(Boolean))].sort();
    return fonts;
  } catch (err) {
    console.error('[IPC] fonts:getSystemFonts failed:', err);
    return [];
  }
});

// IPC: Read font file as ArrayBuffer (no project-directory restriction — user-picked files)
ipcMain.handle('fonts:readFontFile', async (_event, filePath: string) => {
  try {
    const fs = await import('node:fs/promises');
    const buffer = await fs.readFile(filePath);
    // Limit file size to 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      console.warn('[IPC] fonts:readFontFile — file too large:', filePath, buffer.length);
      return null;
    }
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch (err) {
    console.error('[IPC] fonts:readFontFile failed:', err);
    return null;
  }
});

// IPC: Open font file dialog
ipcMain.handle('fonts:openDialog', async (_event) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Font Files',
    filters: [
      { name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] },
      { name: 'TrueType', extensions: ['ttf'] },
      { name: 'OpenType', extensions: ['otf'] },
      { name: 'WOFF', extensions: ['woff', 'woff2'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  return result;
});

// IPC: Import font file into app storage
ipcMain.handle('fonts:importToStorage', async (_event, { filePath, filename }: { filePath: string; filename: string }) => {
  try {
    const fs = await import('node:fs/promises');
    const userDataPath = app.getPath('userData');
    const targetDir = path.join(userDataPath, 'imported-fonts');
    await fs.mkdir(targetDir, { recursive: true });

    // Read source file
    const buffer = await fs.readFile(filePath);
    // Max file size: 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      console.warn('[IPC] fonts:importToStorage — file too large:', filePath, buffer.length);
      return null;
    }

    // Sanitize filename: strip path separators and null bytes
    const safeFilename = path.basename(filename).replace(/\0/g, '');
    if (!safeFilename || safeFilename.startsWith('.')) {
      console.warn('[IPC] fonts:importToStorage — invalid filename:', filename);
      return null;
    }

    // Write to storage
    // Append a short random ID to prevent filename collisions
    const ext = path.extname(safeFilename);
    const base = path.basename(safeFilename, ext);
    const randomId = Math.random().toString(36).slice(2, 6);
    const storedFilename = `${base}-${randomId}${ext}`;
    const storedPath = path.join(targetDir, storedFilename);
    await fs.writeFile(storedPath, buffer);
    return { storedPath, storedFilename };
  } catch (err) {
    console.error('[IPC] fonts:importToStorage failed:', err);
    return null;
  }
});

// IPC: Get imported fonts from settings store
ipcMain.handle('fonts:getImportedFonts', async () => {
  const { settingsStore } = await import('./services/settings.js');
  return settingsStore.get('importedFonts', []);
});

// IPC: Save imported fonts to settings store
ipcMain.handle('fonts:saveImportedFonts', async (_event, fonts: any[]) => {
  const { settingsStore } = await import('./services/settings.js');
  settingsStore.set('importedFonts', fonts);
  return true;
});

// IPC: Remove a font file from storage
ipcMain.handle('fonts:removeFromStorage', async (_event, { storedPath }: { storedPath: string }) => {
  try {
    const fs = await import('node:fs/promises');
    const userDataPath = app.getPath('userData');
    // Security: only delete files inside the userData directory
    if (!isWithinDirectory(storedPath, userDataPath)) {
      console.warn('[IPC] fonts:removeFromStorage blocked — path outside userData:', storedPath);
      return false;
    }
    await fs.unlink(storedPath);
    return true;
  } catch (err) {
    console.error('[IPC] fonts:removeFromStorage failed:', err);
    return false;
  }
});

const aiService = new AiService();

// Window state persistence
const windowStore = new Store<{ bounds: Partial<Electron.Rectangle>; isMaximized: boolean }>({
  name: 'window-state',
  defaults: {
    bounds: { width: 1200, height: 800, x: undefined, y: undefined },
    isMaximized: false,
  },
});

async function createWindow() {
  serverPort = await getFreePort();
  process.env.API_PORT = String(serverPort);

  const expressApp = createServer(aiService);
  await new Promise<void>((resolve) => {
    expressApp.listen(serverPort, () => {
      console.log(`[main] API server running on http://localhost:${serverPort}`);
      resolve();
    });
  });

  // Migrate legacy projects to multi-book structure (non-fatal)
  try {
    const projectsDir = getEffectiveProjectsDir();
    const result = await migrateAllProjects(projectsDir);
    if (result.migrated.length > 0) {
      console.log(`[migration] Migrated ${result.migrated.length} projects to multi-book structure`);
    }
    if (result.errors.length > 0) {
      console.warn(`[migration] ${result.errors.length} projects failed to migrate`);
    }

    // Migrate sessions from per-book to project-level
    const sessionResult = await migrateSessionsToProjectLevel(projectsDir);
    if (sessionResult.totalMigrated > 0) {
      console.log(`[migration] Migrated ${sessionResult.totalMigrated} sessions to project level across ${sessionResult.projectsProcessed} projects`);
    }
  } catch (err) {
    console.error('[migration] Migration failed:', err);
    // Non-fatal: app can still run with legacy structure
  }

  // Restore window state
  const { bounds, isMaximized } = windowStore.store;

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '../preload/index.mjs'),
    },
  });

  if (isMaximized) {
    mainWindow.maximize();
  }

  // Save window state on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      windowStore.set('isMaximized', mainWindow.isMaximized());
      if (!mainWindow.isMaximized()) {
        windowStore.set('bounds', mainWindow.getBounds());
      }
    }
  });

  // Create native menu
  createMenu(mainWindow);

  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    const url = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';
    mainWindow.loadURL(url);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on('before-quit', () => {
    console.log('[main] App quitting, cleaning up...');
    // Abort all active sub-agent runs
    try {
      const runs = listSubAgentRuns();
      for (const run of runs) {
        if (run.status === 'running') {
          cancelSubAgentRun(run.id);
        }
      }
    } catch (err) {
      console.error('[main] Failed to clean up sub-agent runs:', err);
    }
    // Shutdown MCP server connections
    shutdownMcpServers().catch(err => {
      console.error('[main] Failed to shutdown MCP servers:', err);
    });
  });
}
