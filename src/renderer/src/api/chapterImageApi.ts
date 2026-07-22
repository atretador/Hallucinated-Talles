import { getStandardHeaders } from './base';
import type { ApiResponse } from '../../../shared/types';

// Chapter Image API
export const chapterImageApi = {
  /** Save a base64 data-URL image to the chapter's images directory. Returns the relative path. */
  save: async (chapterId: string, dataUrl: string, filename?: string): Promise<ApiResponse<{ path: string }>> => {
    const port = window.electron?.getApiPort() ?? '3000';
    const headers = getStandardHeaders();
    headers['Content-Type'] = 'application/json';
    const response = await fetch(`http://localhost:${port}/api/chapters/${chapterId}/images`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ dataUrl, filename }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || 'Image save failed');
    }
    return response.json();
  },

  /** Build the URL for a chapter image served from the API */
  getImageUrl: (chapterId: string, filename: string): string => {
    const port = window.electron?.getApiPort() ?? '3000';
    const projectId = (window as unknown as Record<string, unknown>).__activeProjectId as string;
    const bookId = (window as unknown as Record<string, unknown>).__activeBookId as string;
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (bookId) params.set('bookId', bookId);
    return `http://localhost:${port}/api/chapters/${chapterId}/images/${filename}?${params.toString()}`;
  },
};
