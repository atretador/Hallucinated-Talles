import path from 'node:path';
import { app } from 'electron';
import Store from 'electron-store';
import type { AiSettings, CompactionSettings, ImportedFont, McpServerConfig } from '../../shared/types';

interface Settings {
  projectsDir: string | null;  // null = not yet configured by user
  apiKeys: {
    openai?: string;
    anthropic?: string;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    autoSave: boolean;
  };
  ai: AiSettings;
  compaction: CompactionSettings;
  mcpServers: McpServerConfig[];
  activeMcpServerIds: string[];
  activeSubAgentIds: string[];
  tokenUsageRetentionDays: number;
  importedFonts: ImportedFont[];
}

const defaults: Settings = {
  projectsDir: null,  // Will be auto-detected on first access
  apiKeys: {},
  preferences: {
    theme: 'system',
    fontSize: 14,
    autoSave: true,
  },
  ai: {
    providers: [
      {
        id: 'ollama',
        name: 'Ollama (Local)',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'ollama',
        models: ['llama3', 'llama3.1', 'mistral', 'codellama', 'gemma'],
      },
    ],
    activeProviderId: 'ollama',
    activeModel: 'llama3',
    activeSkillIds: [],
    firstChunkTimeoutSec: 300,
  },
  compaction: {
    enabled: false,
    thresholdPercent: 70,
    strategy: 'summarize',
    keepRecent: 4,
    useCustomModel: false,
    compactorProviderId: '',
    compactorModel: '',
  },
  tokenUsageRetentionDays: 90,
  mcpServers: [],
  activeMcpServerIds: [],
  activeSubAgentIds: [],
  importedFonts: [],
};

export const settingsStore = new Store<Settings>({
  defaults,
  name: 'hallucinated-talles-settings',
});

export function getEffectiveProjectsDir(): string {
  const stored = settingsStore.get('projectsDir');
  if (stored) return stored;
  // Auto-detect: if the old default path exists, use it (migration for existing users)
  const defaultPath = path.join(app.getPath('documents'), 'Hallucinated Talles', 'projects');
  return defaultPath;
}

export function isProjectsDirConfigured(): boolean {
  return settingsStore.get('projectsDir') !== null;
}

// --- Active skill IDs (persisted in settings) ---

export function getActiveSkillIds(): string[] {
  return settingsStore.get('ai.activeSkillIds', []);
}

export function setActiveSkillIds(ids: string[]): void {
  settingsStore.set('ai.activeSkillIds', ids);
}

// --- MCP server config (persisted in settings) ---

export function getMcpServers(): McpServerConfig[] {
  return settingsStore.get('mcpServers', []);
}

export function setMcpServers(servers: McpServerConfig[]): void {
  settingsStore.set('mcpServers', servers);
}

export function getActiveMcpServerIds(): string[] {
  return settingsStore.get('activeMcpServerIds', []);
}

export function setActiveMcpServerIds(ids: string[]): void {
  settingsStore.set('activeMcpServerIds', ids);
}

// --- Active sub-agent IDs (persisted in settings) ---

export function getActiveSubAgentIds(): string[] {
  return settingsStore.get('activeSubAgentIds', []);
}

export function setActiveSubAgentIds(ids: string[]): void {
  settingsStore.set('activeSubAgentIds', ids);
}
