import type { StateCreator } from 'zustand';
import type { WritingSkill } from '../../../shared/types';
import { skillsApi } from '../api/client';

export interface SkillsSlice {
  skills: WritingSkill[];
  activeSkillIds: string[];
  skillsLoading: boolean;

  fetchSkills: () => Promise<void>;
  fetchActiveSkillIds: () => Promise<void>;
  createSkill: (skill: { name: string; description?: string; instructions: string; scope?: 'global' | 'project' }) => Promise<void>;
  updateSkill: (id: string, updates: { name?: string; description?: string; instructions?: string; scope?: 'global' | 'project' }) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  toggleSkill: (id: string) => Promise<void>;
  setActiveSkillIds: (ids: string[]) => Promise<void>;
}

export const createSkillsSlice: StateCreator<SkillsSlice, [], [], SkillsSlice> = (set, get) => ({
  skills: [],
  activeSkillIds: [],
  skillsLoading: false,

  fetchSkills: async () => {
    set({ skillsLoading: true });
    try {
      const res = await skillsApi.list();
      if (res.success && res.data) {
        set({ skills: res.data });
      }
    } catch (err) {
      console.error('[SkillsSlice] fetchSkills failed:', err);
    } finally {
      set({ skillsLoading: false });
    }
  },

  fetchActiveSkillIds: async () => {
    try {
      const res = await skillsApi.getActive();
      if (res.success && res.data) {
        set({ activeSkillIds: res.data });
      }
    } catch (err) {
      console.error('[SkillsSlice] fetchActiveSkillIds failed:', err);
    }
  },

  createSkill: async (skill) => {
    try {
      await skillsApi.create(skill);
      await get().fetchSkills();
    } catch (err) {
      console.error('[SkillsSlice] createSkill failed:', err);
      throw err;
    }
  },

  updateSkill: async (id, updates) => {
    try {
      await skillsApi.update(id, updates);
      await get().fetchSkills();
    } catch (err) {
      console.error('[SkillsSlice] updateSkill failed:', err);
      throw err;
    }
  },

  deleteSkill: async (id) => {
    try {
      await skillsApi.delete(id);
      // Remove from active if present
      const { activeSkillIds } = get();
      if (activeSkillIds.includes(id)) {
        const newIds = activeSkillIds.filter(sid => sid !== id);
        await skillsApi.setActive(newIds);
        set({ activeSkillIds: newIds });
      }
      await get().fetchSkills();
    } catch (err) {
      console.error('[SkillsSlice] deleteSkill failed:', err);
      throw err;
    }
  },

  toggleSkill: async (id) => {
    const { activeSkillIds } = get();
    const newIds = activeSkillIds.includes(id)
      ? activeSkillIds.filter(sid => sid !== id)
      : [...activeSkillIds, id];
    try {
      await skillsApi.setActive(newIds);
      set({ activeSkillIds: newIds });
    } catch (err) {
      console.error('[SkillsSlice] toggleSkill failed:', err);
    }
  },

  setActiveSkillIds: async (ids) => {
    try {
      await skillsApi.setActive(ids);
      set({ activeSkillIds: ids });
    } catch (err) {
      console.error('[SkillsSlice] setActiveSkillIds failed:', err);
    }
  },
});
