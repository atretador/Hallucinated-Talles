import { api } from './base';
import type { ApiResponse, McpServerInfo } from '../../../shared/types';

// MCP Servers API
export const mcpApi = {
  list: () => api.get<ApiResponse<McpServerInfo[]>>('/mcp/servers'),

  get: (id: string) => api.get<ApiResponse<McpServerInfo>>(`/mcp/servers/${id}`),

  create: (server: { id: string; name: string; command: string; args?: string[]; env?: Record<string, string>; enabled?: boolean; timeoutMs?: number }) =>
    api.post<ApiResponse<McpServerInfo>>('/mcp/servers', server),

  update: (id: string, updates: Partial<{ name: string; command: string; args: string[]; env: Record<string, string>; enabled: boolean; timeoutMs: number }>) =>
    api.put<ApiResponse<McpServerInfo>>(`/mcp/servers/${id}`, updates),

  delete: (id: string) => api.delete<ApiResponse<void>>(`/mcp/servers/${id}`),

  getActive: () => api.get<ApiResponse<string[]>>('/mcp/servers/active'),

  setActive: (ids: string[]) => api.post<ApiResponse<void>>('/mcp/servers/active', { ids }),
};
