import { api } from './base';
import type { ApiResponse, AgentSession, SessionData, SessionCommit, ChatMessage, AgentTask, SubAgentRun } from '../../../shared/types';

// Typed session API methods (project-level)
export const sessionApi = {
  list: (bookId?: string) => {
    const params = bookId ? `?bookId=${encodeURIComponent(bookId)}` : '';
    return api.get<ApiResponse<AgentSession[]>>(`/sessions${params}`);
  },
  create: (title?: string, bookId?: string) =>
    api.post<ApiResponse<AgentSession>>('/sessions', { title, bookId }),
  get: (id: string) => api.get<ApiResponse<SessionData>>(`/sessions/${id}`),
  update: (id: string, updates: Partial<AgentSession>) =>
    api.put<ApiResponse<AgentSession>>(`/sessions/${id}`, updates),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/sessions/${id}`),
  addMessage: (sessionId: string, message: ChatMessage) =>
    api.post<ApiResponse<void>>(`/sessions/${sessionId}/messages`, { message }),
  getCommits: (sessionId: string) =>
    api.get<ApiResponse<SessionCommit[]>>(`/sessions/${sessionId}/commits`),
  fork: (sessionId: string, title?: string) =>
    api.post<ApiResponse<AgentSession>>(`/sessions/${sessionId}/fork`, { title }),
  migrateToProject: () =>
    api.post<ApiResponse<{ migrated: number; skipped: number }>>('/sessions/migrate-to-project', {}),
  // Task persistence
  addTask: (sessionId: string, task: AgentTask) =>
    api.post<ApiResponse<void>>(`/sessions/${sessionId}/tasks`, { task }),
  updateTask: (sessionId: string, taskId: string, updates: Partial<AgentTask>) =>
    api.put<ApiResponse<void>>(`/sessions/${sessionId}/tasks/${taskId}`, updates),
  // Sub-agent run persistence
  addSubAgentRun: (sessionId: string, run: SubAgentRun) =>
    api.post<ApiResponse<void>>(`/sessions/${sessionId}/sub-agent-runs`, { run }),
  updateSubAgentRun: (sessionId: string, runId: string, updates: Partial<SubAgentRun>) =>
    api.put<ApiResponse<void>>(`/sessions/${sessionId}/sub-agent-runs/${runId}`, updates),
  // Undo
  undoChange: (sessionId: string, entityType: string, entityId: string) =>
    api.post<ApiResponse<SessionCommit>>(`/sessions/${sessionId}/undo-change`, { entityType, entityId }),
};
