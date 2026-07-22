import type { StateCreator } from 'zustand';
import type { McpServerInfo } from '../../../shared/types';
import { mcpApi } from '../api/client';

export interface McpServersSlice {
  mcpServers: McpServerInfo[];
  activeMcpServerIds: string[];
  mcpServersLoading: boolean;

  fetchMcpServers: () => Promise<void>;
  fetchActiveMcpServerIds: () => Promise<void>;
  createMcpServer: (server: { id: string; name: string; command: string; args?: string[]; env?: Record<string, string>; enabled?: boolean; timeoutMs?: number }) => Promise<void>;
  updateMcpServer: (id: string, updates: Partial<{ name: string; command: string; args: string[]; env: Record<string, string>; enabled: boolean; timeoutMs: number }>) => Promise<void>;
  deleteMcpServer: (id: string) => Promise<void>;
  toggleMcpServer: (id: string) => Promise<void>;
  setActiveMcpServerIds: (ids: string[]) => Promise<void>;
}

export const createMcpServersSlice: StateCreator<McpServersSlice, [], [], McpServersSlice> = (set, get) => ({
  mcpServers: [],
  activeMcpServerIds: [],
  mcpServersLoading: false,

  fetchMcpServers: async () => {
    set({ mcpServersLoading: true });
    try {
      const res = await mcpApi.list();
      if (res.success && res.data) {
        set({ mcpServers: res.data });
      }
    } catch (err) {
      console.error('[McpServersSlice] fetchMcpServers failed:', err);
    } finally {
      set({ mcpServersLoading: false });
    }
  },

  fetchActiveMcpServerIds: async () => {
    try {
      const res = await mcpApi.getActive();
      if (res.success && res.data) {
        set({ activeMcpServerIds: res.data });
      }
    } catch (err) {
      console.error('[McpServersSlice] fetchActiveMcpServerIds failed:', err);
    }
  },

  createMcpServer: async (server) => {
    try {
      await mcpApi.create(server);
      await get().fetchMcpServers();
    } catch (err) {
      console.error('[McpServersSlice] createMcpServer failed:', err);
      throw err;
    }
  },

  updateMcpServer: async (id, updates) => {
    try {
      await mcpApi.update(id, updates);
      await get().fetchMcpServers();
    } catch (err) {
      console.error('[McpServersSlice] updateMcpServer failed:', err);
      throw err;
    }
  },

  deleteMcpServer: async (id) => {
    try {
      await mcpApi.delete(id);
      // Remove from active if present
      const { activeMcpServerIds } = get();
      if (activeMcpServerIds.includes(id)) {
        const newIds = activeMcpServerIds.filter(sid => sid !== id);
        await mcpApi.setActive(newIds);
        set({ activeMcpServerIds: newIds });
      }
      await get().fetchMcpServers();
    } catch (err) {
      console.error('[McpServersSlice] deleteMcpServer failed:', err);
      throw err;
    }
  },

  toggleMcpServer: async (id) => {
    const { activeMcpServerIds } = get();
    const newIds = activeMcpServerIds.includes(id)
      ? activeMcpServerIds.filter(sid => sid !== id)
      : [...activeMcpServerIds, id];
    try {
      await mcpApi.setActive(newIds);
      set({ activeMcpServerIds: newIds });
    } catch (err) {
      console.error('[McpServersSlice] toggleMcpServer failed:', err);
    }
  },

  setActiveMcpServerIds: async (ids) => {
    try {
      await mcpApi.setActive(ids);
      set({ activeMcpServerIds: ids });
    } catch (err) {
      console.error('[McpServersSlice] setActiveMcpServerIds failed:', err);
    }
  },
});
