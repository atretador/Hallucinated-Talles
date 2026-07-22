import { api } from './base';
import type { Book, Character, StoryEvent, ApiResponse, ChatMessage } from '../../../shared/types';

// Typed project API methods
export const projectApi = {
  getBook: () => api.get<ApiResponse<Book>>('/book'),
  updateBook: (book: Book) => api.put<ApiResponse<void>>('/book', book),
  listBooks: () => api.get<ApiResponse<{ id: string; title: string; description: string; bookCount?: number; coverUrl?: string }[]>>('/books'),
  createBook: (title: string, description?: string) => api.post<ApiResponse<{ id: string; title: string; description: string }>>('/book', { title, description: description ?? '' }),
  renameBook: (projectId: string, title: string, description?: string) => api.patch<ApiResponse<{ id: string; title: string; description: string }>>(`/books/${projectId}`, { title, description }),
  deleteBook: (projectId: string) => api.delete<ApiResponse<void>>(`/books/${projectId}`),

  getCharacters: () => api.get<ApiResponse<Character[]>>('/characters'),
  addCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<ApiResponse<Character>>('/characters', character),
  updateCharacter: (id: string, updates: Partial<Character>) =>
    api.put<ApiResponse<Character>>(`/characters/${id}`, updates),
  deleteCharacter: (id: string) =>
    api.delete<ApiResponse<void>>(`/characters/${id}`),

  getEvents: () => api.get<ApiResponse<StoryEvent[]>>('/events'),
  addEvent: (event: Omit<StoryEvent, 'id'>) =>
    api.post<ApiResponse<StoryEvent>>('/events', event),
  updateEvent: (id: string, updates: Partial<StoryEvent>) =>
    api.put<ApiResponse<StoryEvent>>(`/events/${id}`, updates),
  deleteEvent: (id: string) =>
    api.delete<ApiResponse<void>>(`/events/${id}`),

  getPageContent: (pageId: string) =>
    api.get<ApiResponse<string>>(`/pages/${pageId}`),
  savePageContent: (pageId: string, content: string) =>
    api.put<ApiResponse<void>>(`/pages/${pageId}`, { content }),

  createPage: (opts: { title?: string; chapterId?: string; afterPageId?: string; content?: string }) =>
    api.post<ApiResponse<{ page: { id: string; type: string; title?: string }; book: Book }>>('/pages', opts),

  getBookContent: (bookId: string) =>
    api.get<ApiResponse<{
      bookId: string;
      bookTitle: string;
      pages: Array<{ id: string; title?: string; content: string }>;
    }>>(`/books/${bookId}/content`),

  saveBookContent: (content: string) =>
    api.put<ApiResponse<void>>('/book/content', { content }),

  loadBookContent: () =>
    api.get<ApiResponse<{ content: string }>>('/book/content'),

  search: (query: string) =>
    api.get<ApiResponse<{ pageId: string; title: string; preview: string }[]>>(
      `/search?q=${encodeURIComponent(query)}`,
    ),

  getChatHistory: () => api.get<ApiResponse<ChatMessage[]>>('/chat/history'),
  saveChatHistory: (messages: ChatMessage[]) =>
    api.post<ApiResponse<void>>('/chat/history', { messages }),
};
