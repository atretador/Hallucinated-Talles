import { api } from './base';
import type { ApiResponse } from '../../../shared/types';

// App status and settings API
export interface AppStatusResponse {
  success: boolean;
  data: {
    llmConfigured: boolean;
    projectsDirConfigured: boolean;
    projectsDir: string;
  };
}

export interface ProjectsDirResponse {
  success: boolean;
  data: {
    configured: boolean;
    path: string;
  };
}

export const settingsApi = {
  getAppStatus: () => api.get<AppStatusResponse>('/app-status'),
  getProjectsDir: () => api.get<ProjectsDirResponse>('/settings/projects-dir'),
  setProjectsDir: (dir: string) =>
    api.put<ApiResponse<{ path: string }>>('/settings/projects-dir', { dir }),
};
