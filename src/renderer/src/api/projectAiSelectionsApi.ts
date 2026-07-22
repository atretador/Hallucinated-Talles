import { api } from './base';
import type { ApiResponse, ProjectAiSelections } from '../../../shared/types';

// Per-project AI selections (provider, model, effort)
export const projectAiSelectionsApi = {
  get: () => api.get<{ success: boolean; data: ProjectAiSelections | null }>('/project/ai-selections'),
  save: (selections: ProjectAiSelections) =>
    api.put<ApiResponse<void>>('/project/ai-selections', selections),
};
