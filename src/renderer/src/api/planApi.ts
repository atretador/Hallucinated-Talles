import { api, getStandardHeaders, API_BASE } from './base';
import type { ApiResponse, PlanModel } from '../../../shared/types';

// Story Planner API
export const planApi = {
  get: () => api.get<ApiResponse<PlanModel | null>>('/plan'),
  save: (plan: PlanModel) => api.put<ApiResponse<void>>('/plan', plan),
  generate: (effort?: 'low' | 'medium' | 'high') => {
    const headers = getStandardHeaders();
    headers['Content-Type'] = 'application/json';
    return fetch(`${API_BASE}/generate-from-plan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ effort: effort || 'medium' }),
    });
  },
};
