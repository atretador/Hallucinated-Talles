import type { StateCreator } from 'zustand';
import type { StoryRelation } from '../../../shared/types';
import { api } from '../api/client';

export interface RelationSlice {
  relations: StoryRelation[];
  relationsLoading: boolean;
  relationsError: string | null;
  fetchRelations: () => Promise<void>;
  addRelation: (relation: Omit<StoryRelation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRelation: (id: string, updates: Partial<StoryRelation>) => Promise<void>;
  deleteRelation: (id: string) => Promise<void>;
  getEntityRelations: (entityType: string, entityId: string) => Promise<StoryRelation[]>;
}

export const createRelationSlice: StateCreator<RelationSlice & { activeBookId?: string }, [], [], RelationSlice> = (set, get) => ({
  relations: [],
  relationsLoading: false,
  relationsError: null,

  fetchRelations: async () => {
    set({ relationsLoading: true, relationsError: null });
    try {
      const response = await api.get<{ success: boolean; data: StoryRelation[] }>('/relations');
      set({ relations: response.data, relationsLoading: false });
    } catch (error) {
      set({ relationsError: String(error), relationsLoading: false });
    }
  },

  addRelation: async (relation) => {
    set({ relationsError: null });
    try {
      const bookId = get().activeBookId;
      const payload = bookId ? { ...relation, bookId } : relation;
      const response = await api.post<{ success: boolean; data: StoryRelation }>('/relations', payload);
      set((state) => ({ relations: [...state.relations, response.data] }));
    } catch (error) {
      set({ relationsError: String(error) });
      throw error;
    }
  },

  updateRelation: async (id, updates) => {
    set({ relationsError: null });
    try {
      const response = await api.put<{ success: boolean; data: StoryRelation }>(`/relations/${id}`, updates);
      set((state) => ({
        relations: state.relations.map(r => r.id === id ? response.data : r),
      }));
    } catch (error) {
      set({ relationsError: String(error) });
      throw error;
    }
  },

  deleteRelation: async (id) => {
    set({ relationsError: null });
    try {
      await api.delete(`/relations/${id}`);
      set((state) => ({
        relations: state.relations.filter(r => r.id !== id),
      }));
    } catch (error) {
      set({ relationsError: String(error) });
      throw error;
    }
  },

  getEntityRelations: async (entityType, entityId) => {
    try {
      const response = await api.get<{ success: boolean; data: StoryRelation[] }>(
        `/relations/entity/${entityType}/${entityId}`,
      );
      return response.data;
    } catch {
      return [];
    }
  },
});
