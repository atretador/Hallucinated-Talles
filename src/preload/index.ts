import { contextBridge, ipcRenderer } from 'electron';
import type { FileFilter } from 'electron';

const IMAGE_FILTERS: FileFilter[] = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
  { name: 'All Files', extensions: ['*'] },
];

contextBridge.exposeInMainWorld('electron', {
  getApiPort: () => process.env.API_PORT,
  platform: process.platform,
  openFileDialog: (filters?: FileFilter[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),
  openPath: (filePath: string) =>
    ipcRenderer.invoke('shell:openPath', filePath),
  openImageDialog: () =>
    ipcRenderer.invoke('dialog:openFile', IMAGE_FILTERS),
  readFileAsBase64: (filePath: string, projectId?: string) =>
    ipcRenderer.invoke('fs:readFileAsBase64', filePath, projectId),
  getSystemFonts: () => ipcRenderer.invoke('fonts:getSystemFonts'),
  readFontFile: (filePath: string) => ipcRenderer.invoke('fonts:readFontFile', filePath),
  openFontDialog: () => ipcRenderer.invoke('fonts:openDialog'),
  importFontToStorage: (filePath: string, filename: string) =>
    ipcRenderer.invoke('fonts:importToStorage', { filePath, filename }),
  getImportedFonts: () => ipcRenderer.invoke('fonts:getImportedFonts'),
  saveImportedFonts: (fonts: Array<{ family: string; filename: string; filePath: string; storedPath: string; weight: string; style: string; importedAt: string }>) => ipcRenderer.invoke('fonts:saveImportedFonts', fonts),
  removeFromStorage: (storedPath: string) => ipcRenderer.invoke('fonts:removeFromStorage', { storedPath }),
});
