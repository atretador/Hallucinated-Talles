import { api } from './base';
import type { AiSettings, AiProvider, ApiResponse } from '../../../shared/types';

// Typed AI provider API methods
export interface AiStatusResponse {
  success: boolean;
  configured: boolean;
  config: { baseUrl: string; apiKey: string; model: string } | null;
  settings: AiSettings;
  activeProvider: { id: string; name: string } | null;
  activeModel: string;
}

export const aiApi = {
  getStatus: () => api.get<AiStatusResponse>('/ai/status'),

  configure: (settings: AiSettings) =>
    api.post<ApiResponse<void>>('/ai/configure', settings),

  getProviders: () =>
    api.get<ApiResponse<AiProvider[]>>('/ai/providers'),

  addProvider: (provider: AiProvider) =>
    api.post<ApiResponse<AiProvider>>('/ai/providers', provider),

  updateProvider: (id: string, updates: Partial<AiProvider>) =>
    api.put<ApiResponse<AiProvider>>(`/ai/providers/${id}`, updates),

  deleteProvider: (id: string) =>
    api.delete<ApiResponse<void>>(`/ai/providers/${id}`),

  setActive: (providerId: string, model: string) =>
    api.post<ApiResponse<void>>('/ai/active', { providerId, model }),

  setTimeout: (firstChunkTimeoutSec: number) =>
    api.post<ApiResponse<void>>('/ai/timeout', { firstChunkTimeoutSec }),

  discoverModels: (baseUrl: string, apiKey?: string) =>
    api.post<{ success: boolean; models?: string[]; contextLengths?: Record<string, number>; error?: string }>('/ai/discover-models', { baseUrl, apiKey }),
};
