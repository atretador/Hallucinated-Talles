import { api } from './base';
import type { ApiResponse, BookSettings } from '../../../shared/types';

// Book settings API
export const bookSettingsApi = {
  get: () => api.get<ApiResponse<BookSettings>>('/book/settings'),
  save: (settings: BookSettings) => api.put<ApiResponse<void>>('/book/settings', { settings }),
};
