import { request } from './base';
import type { ApiResponse, TokenUsageRecord, TokenUsageSummary } from '../../../shared/types';

// ── Token Usage API ──────────────────────────────────────────

export interface TokenUsageRecordsResponse {
  success: boolean;
  data: {
    records: TokenUsageRecord[];
    total: number;
  };
}

export interface TokenUsageSummaryResponse {
  success: boolean;
  data: TokenUsageSummary;
}

export interface TokenUsageModelsResponse {
  success: boolean;
  data: string[];
}

export const tokenUsageApi = {
  getRecords: (params?: {
    from?: string;
    to?: string;
    model?: string;
    source?: 'chat' | 'import';
    project?: string;
    limit?: number;
    offset?: number;
  }): Promise<TokenUsageRecordsResponse> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.model) qs.set('model', params.model);
    if (params?.source) qs.set('source', params.source);
    if (params?.project) qs.set('project', params.project);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return request(`/token-usage${query ? `?${query}` : ''}`);
  },

  getSummary: (params?: {
    from?: string;
    to?: string;
    model?: string;
    source?: 'chat' | 'import';
    project?: string;
  }): Promise<TokenUsageSummaryResponse> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.model) qs.set('model', params.model);
    if (params?.source) qs.set('source', params.source);
    if (params?.project) qs.set('project', params.project);
    const query = qs.toString();
    return request(`/token-usage/summary${query ? `?${query}` : ''}`);
  },

  getModels: (): Promise<TokenUsageModelsResponse> => {
    return request('/token-usage/models');
  },

  getProjects: (): Promise<ApiResponse<Array<{ projectId: string; projectName: string }>>> => {
    return request('/token-usage/projects');
  },

  getRetentionDays: () => request<ApiResponse<{ days: number }>>('/token-usage/retention'),
  setRetentionDays: (days: number) => request<ApiResponse<{ days: number }>>('/token-usage/retention', { method: 'PUT', body: { days } }),
};
