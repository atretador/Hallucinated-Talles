import { request } from './base';
import type { ApiResponse, SubAgent, SubAgentRun } from '../../../shared/types';

// Sub-Agent API
export const subAgentApi = {
  list: (): Promise<ApiResponse<SubAgent[]>> => request('/sub-agents'),

  getActive: (): Promise<ApiResponse<string[]>> => request('/sub-agents/active'),

  setActive: (ids: string[]): Promise<ApiResponse<void>> =>
    request('/sub-agents/active', { method: 'POST', body: { ids } }),

  create: (agent: Omit<SubAgent, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<SubAgent>> =>
    request('/sub-agents', { method: 'POST', body: agent }),

  update: (id: string, agent: Partial<Omit<SubAgent, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ApiResponse<SubAgent>> =>
    request(`/sub-agents/${id}`, { method: 'PUT', body: agent }),

  delete: (id: string): Promise<ApiResponse<void>> =>
    request(`/sub-agents/${id}`, { method: 'DELETE' }),

  delegate: (subAgentId: string, task: string, sessionId: string, agentName?: string, context?: string[]): Promise<ApiResponse<{ runId: string }>> =>
    request('/sub-agents/delegate', { method: 'POST', body: { subAgentId, task, sessionId, agentName, context } }),

  getRun: (runId: string): Promise<ApiResponse<SubAgentRun>> =>
    request(`/sub-agents/runs/${runId}`),

  listRuns: (sessionId: string): Promise<ApiResponse<SubAgentRun[]>> =>
    request(`/sub-agents/runs?sessionId=${sessionId}`),

  cancel: (runId: string): Promise<ApiResponse<{ cancelled: boolean }>> =>
    request(`/sub-agents/runs/${runId}/cancel`, { method: 'POST' }),
};
