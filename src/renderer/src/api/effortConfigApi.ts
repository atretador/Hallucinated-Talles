import { request } from './base';
import type { ApiResponse, EffortConfig } from '../../../shared/types';

// Effort Config API
export const effortConfigApi = {
  get: (): Promise<ApiResponse<EffortConfig>> => request('/effort-config'),
  save: (config: EffortConfig): Promise<ApiResponse<void>> => request('/effort-config', { method: 'PUT', body: config }),
  resolve: (model: string, providerUrl?: string, providerApiKey?: string): Promise<ApiResponse<{ efforts: string[]; default: string; source: string }>> => {
    const params = new URLSearchParams({ model });
    if (providerUrl) params.set('providerUrl', providerUrl);
    if (providerApiKey) params.set('providerApiKey', providerApiKey);
    return request(`/effort-options?${params.toString()}`);
  },
};
