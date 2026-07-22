import { api } from './base';
import type { ApiResponse, WritingSkill } from '../../../shared/types';

// Skills API
export const skillsApi = {
  list: () => api.get<ApiResponse<WritingSkill[]>>('/skills'),

  get: (id: string) => api.get<ApiResponse<WritingSkill>>(`/skills/${id}`),

  create: (skill: { name: string; description?: string; instructions: string; scope?: 'global' | 'project' }) =>
    api.post<ApiResponse<WritingSkill>>('/skills', skill),

  update: (id: string, updates: { name?: string; description?: string; instructions?: string; scope?: 'global' | 'project' }) =>
    api.put<ApiResponse<WritingSkill>>(`/skills/${id}`, updates),

  delete: (id: string) => api.delete<ApiResponse<void>>(`/skills/${id}`),

  getActive: () => api.get<ApiResponse<string[]>>('/skills/active'),

  setActive: (ids: string[]) => api.post<ApiResponse<void>>('/skills/active', { ids }),
};
