import type { StateCreator } from 'zustand';
import type { Book, BookItem } from '../../../shared/types';
import { api, bookApi, setActiveBookId } from '../api/client';
import type { BookListItem } from '../api/client';

export interface BookSlice {
  // Project-level
  activeProjectId: string;
  activeProjectTitle: string;

  // Book-level
  books: BookListItem[];
  activeBookId: string;
  book: Book | null;
  bookLoading: boolean;
  bookError: string | null;

  // Actions
  fetchBooks: () => Promise<void>;
  fetchBook: () => Promise<void>;
  updateBook: (book: Book) => Promise<void>;
  switchProject: (projectId: string, projectTitle?: string) => Promise<void>;
  switchBook: (bookId: string) => Promise<void>;
  createBook: (title: string, description?: string, systemPrompt?: string) => Promise<string>;
  deleteBook: (bookId: string) => Promise<void>;
  updateBookMeta: (bookId: string, updates: { title?: string; description?: string; systemPrompt?: string }) => Promise<void>;
  updateBookContent: (content: string) => Promise<void>;
  addItem: (item: BookItem) => void;
  updateItem: (id: string, updates: Partial<BookItem>) => void;
  deleteItem: (id: string) => void;
}

export const createBookSlice: StateCreator<BookSlice, [], [], BookSlice> = (set, get) => ({
  activeProjectId: 'default',
  activeProjectTitle: '',
  books: [],
  activeBookId: '',
  book: null,
  bookLoading: false,
  bookError: null,

  fetchBooks: async () => {
    try {
      const res = await bookApi.list();
      if (res.success && res.data) {
        set({ books: res.data });
        // Auto-select first book if only one exists and none is active
        const currentActive = get().activeBookId;
        if (res.data.length === 1 && !currentActive) {
          await get().switchBook(res.data[0].id);
        }
      }
    } catch {
      // Non-fatal
      console.debug('[bookSlice] Failed to fetch books');
    }
  },

  fetchBook: async () => {
    set({ bookLoading: true, bookError: null });
    try {
      const response = await api.get<{ success: boolean; data: Book }>('/book');
      const book = response.data;
      // Load document content from content.html
      try {
        const contentRes = await api.get<{ success: boolean; data: { content: string } }>('/book/content');
        if (contentRes.data?.content) {
          book.content = contentRes.data.content;
        }
      } catch {
        // content.html might not exist yet — that's fine
      }
      set({ book, bookLoading: false });
    } catch (error) {
      set({ bookError: String(error), bookLoading: false });
    }
  },

  updateBook: async (book: Book) => {
    try {
      await api.put('/book', book);
      set({ book });
    } catch (error) {
      set({ bookError: String(error) });
    }
  },

  switchProject: async (projectId: string, projectTitle?: string) => {
    // Sync project ID to window global so API client sends x-project-id header
    (window as unknown as Record<string, unknown>).__activeProjectId = projectId;
    setActiveBookId(null); // Clear book when switching projects
    set({
      activeProjectId: projectId,
      activeProjectTitle: projectTitle ?? projectId,
      activeBookId: '',
      books: [],
      book: null,
      bookLoading: false,
      bookError: null,
    } as Record<string, unknown>);
    // Clear project-level session data
    const { loadSessions } = get() as unknown as { loadSessions: (bookId?: string) => Promise<void> };
    set({
      sessions: [],
      activeSessionId: null,
      currentSessionData: null,
    } as Record<string, unknown>);
    // Clear persisted session ID (sessions are project-scoped)
    try { localStorage.removeItem('lastActiveSessionId'); } catch { /* noop */ }
    // Fetch books for the new project
    await get().fetchBooks();
    // Reload sessions for the new project
    await loadSessions();
  },

  switchBook: async (bookId: string) => {
    setActiveBookId(bookId);
    // Clear book-scoped data to prevent leakage between books
    // Note: sessions are project-level and NOT cleared on book switch
    set({
      activeBookId: bookId,
      bookLoading: true,
      bookError: null,
      book: null,
      characters: [],
      events: [],
    } as Record<string, unknown>);
    try {
      const response = await api.get<{ success: boolean; data: Book }>('/book');
      const book = response.data;
      // Load document content from content.html
      try {
        const contentRes = await api.get<{ success: boolean; data: { content: string } }>('/book/content');
        if (contentRes.data?.content) {
          book.content = contentRes.data.content;
        }
      } catch {
        // content.html might not exist yet
      }
      set({ book, bookLoading: false });
    } catch (error) {
      set({ bookError: String(error), bookLoading: false });
    }
  },

  createBook: async (title: string, description?: string, systemPrompt?: string) => {
    const res = await bookApi.create(title, description, systemPrompt);
    if (res.success && res.data) {
      // Refresh book list
      await get().fetchBooks();
      // Switch to the new book
      await get().switchBook(res.data.id);
      return res.data.id;
    }
    throw new Error('Failed to create book');
  },

  deleteBook: async (bookId: string) => {
    await bookApi.delete(bookId);
    // If we deleted the active book, clear book-scoped data
    if (get().activeBookId === bookId) {
      setActiveBookId(null);
      set({
        activeBookId: '',
        book: null,
        characters: [],
        events: [],
        messages: [],
        activeContent: null,
      } as Record<string, unknown>);
    }
    // Refresh book list
    await get().fetchBooks();
  },

  updateBookMeta: async (bookId: string, updates: { title?: string; description?: string; systemPrompt?: string }) => {
    await bookApi.update(bookId, updates);
    // Refresh book list to reflect title changes
    await get().fetchBooks();
    // If we updated the active book, refresh its structure too
    if (get().activeBookId === bookId) {
      await get().fetchBook();
    }
  },

  updateBookContent: async (content: string) => {
    try {
      await api.put('/book/content', { content });
      // Also update the local book state
      set((state) => {
        if (!state.book) return state;
        return { book: { ...state.book, content } };
      });
    } catch (error) {
      console.error('[bookSlice] Failed to save book content:', error);
    }
  },

  addItem: (item: BookItem) => {
    set((state) => {
      if (!state.book) return state;
      return {
        book: {
          ...state.book,
          items: [...state.book.items, item],
        },
      };
    });
    set((state) => {
      if (!state.book) return state;
      api.put('/book', state.book).catch(() => {});
      return state;
    });
  },

  updateItem: (id: string, updates: Partial<BookItem>) => {
    set((state) => {
      if (!state.book) return state;
      return {
        book: {
          ...state.book,
          items: state.book.items.map((item) =>
            item.id === id ? ({ ...item, ...updates } as BookItem) : item,
          ),
        },
      };
    });
    set((state) => {
      if (!state.book) return state;
      api.put('/book', state.book).catch(() => {});
      return state;
    });
  },

  deleteItem: (id: string) => {
    set((state) => {
      if (!state.book) return state;
      const updated = {
        book: {
          ...state.book,
          items: state.book.items.filter((item) => item.id !== id),
        },
      };
      api.put('/book', updated.book).catch(() => {});
      return updated;
    });
  },
});
