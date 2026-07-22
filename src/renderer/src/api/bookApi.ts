import { api } from './base';
import type { ApiResponse } from '../../../shared/types';

// Book-level API methods (multi-book within a project)
export interface BookListItem {
  id: string;
  title: string;
  description?: string;
  systemPrompt?: string;
  coverUrl?: string;
}

export const bookApi = {
  list: () => api.get<ApiResponse<BookListItem[]>>('/project/books'),
  create: (title: string, description?: string, systemPrompt?: string) => api.post<ApiResponse<BookListItem>>('/project/books', { title, description: description ?? '', systemPrompt: systemPrompt ?? '' }),
  update: (bookId: string, updates: { title?: string; description?: string; systemPrompt?: string }) => api.patch<ApiResponse<BookListItem>>(`/project/books/${bookId}`, updates),
  delete: (bookId: string) => api.delete<ApiResponse<void>>(`/project/books/${bookId}`),
};

// Helper to sync active book ID to window global
export function setActiveBookId(bookId: string | null) {
  (window as unknown as Record<string, unknown>).__activeBookId = bookId ?? '';
}
