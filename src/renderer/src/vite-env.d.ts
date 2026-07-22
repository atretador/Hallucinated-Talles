/// <reference types="vite/client" />

interface ImportedFont {
  family: string;
  filename: string;
  filePath: string;
  storedPath: string;
  weight: string;
  style: string;
  importedAt: string;
}

interface Window {
  electron?: {
    getApiPort: () => string | undefined;
    platform: string;
    openFileDialog: (filters?: import('electron').FileFilter[]) => Promise<import('electron').OpenDialogReturnValue>;
    openImageDialog: () => Promise<import('electron').OpenDialogReturnValue>;
    readFileAsBase64: (filePath: string, projectId?: string) => Promise<string | null>;
    getSystemFonts: () => Promise<string[]>;
    readFontFile: (filePath: string) => Promise<ArrayBuffer | null>;
    openFontDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
    openPath: (filePath: string) => Promise<string | void>;
    importFontToStorage: (filePath: string, filename: string) => Promise<{ storedPath: string } | null>;
    getImportedFonts: () => Promise<ImportedFont[]>;
    saveImportedFonts: (fonts: ImportedFont[]) => Promise<boolean>;
    removeFromStorage: (storedPath: string) => Promise<boolean>;
  };
}
