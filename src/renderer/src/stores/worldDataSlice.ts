import type { StateCreator } from 'zustand';
import type { WorldData } from '../../../shared/types';
import { api } from '../api/client';

export interface WorldDataSlice {
  worldData: WorldData[];
  worldDataLoading: boolean;
  worldDataError: string | null;
  fetchWorldData: () => Promise<void>;
  addWorldData: (entry: Omit<WorldData, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateWorldData: (id: string, updates: Partial<WorldData>) => Promise<void>;
  deleteWorldData: (id: string) => Promise<void>;
}

export const createWorldDataSlice: StateCreator<WorldDataSlice & { activeBookId?: string }, [], [], WorldDataSlice> = (set, get) => ({
  worldData: [],
  worldDataLoading: false,
  worldDataError: null,

  fetchWorldData: async () => {
    set({ worldDataLoading: true, worldDataError: null });
    try {
      const response = await api.get<{ success: boolean; data: WorldData[] }>('/world-data');
      set({ worldData: response.data, worldDataLoading: false });
    } catch (error) {
      set({ worldDataError: String(error), worldDataLoading: false });
    }
  },

  addWorldData: async (entry) => {
    set({ worldDataError: null });
    try {
      const bookId = get().activeBookId;
      const payload = bookId ? { ...entry, bookId } : entry;
      const response = await api.post<{ success: boolean; data: WorldData }>('/world-data', payload);
      set((state) => ({ worldData: [...state.worldData, response.data] }));
    } catch (error) {
      set({ worldDataError: String(error) });
      throw error;
    }
  },

  updateWorldData: async (id, updates) => {
    set({ worldDataError: null });
    try {
      const response = await api.put<{ success: boolean; data: WorldData }>(`/world-data/${id}`, updates);
      set((state) => ({
        worldData: state.worldData.map(w => w.id === id ? response.data : w),
      }));
    } catch (error) {
      set({ worldDataError: String(error) });
      throw error;
    }
  },

  deleteWorldData: async (id) => {
    set({ worldDataError: null });
    try {
      await api.delete(`/world-data/${id}`);
      set((state) => ({
        worldData: state.worldData.filter(w => w.id !== id),
      }));
    } catch (error) {
      set({ worldDataError: String(error) });
      throw error;
    }
  },
});
