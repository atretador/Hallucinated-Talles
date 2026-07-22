import { api, getStandardHeaders } from './base';
import type { ApiResponse } from '../../../shared/types';

// Cover API
export const coverApi = {
  /** List which covers exist for the current book */
  list: () => api.get<ApiResponse<{ frontCover: boolean; backCover: boolean }>>('/book/covers'),

  /** Get cover image URL for direct use in <img> tags */
  getImageUrl: (type: 'front-cover' | 'back-cover'): string => {
    const port = window.electron?.getApiPort() ?? '3000';
    const projectId = (window as unknown as Record<string, unknown>).__activeProjectId as string;
    const bookId = (window as unknown as Record<string, unknown>).__activeBookId as string;
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (bookId) params.set('bookId', bookId);
    return `http://localhost:${port}/api/book/covers/${type}?${params.toString()}`;
  },

  /** Upload/replace a cover image (accepts a File or Blob) */
  upload: async (type: 'front-cover' | 'back-cover', file: File | Blob): Promise<ApiResponse<void>> => {
    const port = window.electron?.getApiPort() ?? '3000';
    const headers = getStandardHeaders();
    const response = await fetch(`http://localhost:${port}/api/book/covers/${type}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': file.type || 'image/png',
      },
      body: file,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || 'Upload failed');
    }
    return response.json();
  },

  /** Delete a cover image */
  delete: (type: 'front-cover' | 'back-cover') =>
    api.delete<ApiResponse<void>>(`/book/covers/${type}`),
};
