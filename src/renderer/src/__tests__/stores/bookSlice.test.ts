import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../stores';

// Mock the API module used by the stores
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  },
  projectApi: {
    getBook: vi.fn(),
    updateBook: vi.fn(),
    getCharacters: vi.fn(),
    addCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    getEvents: vi.fn(),
    addEvent: vi.fn(),
    getPageContent: vi.fn(),
    savePageContent: vi.fn(),
    search: vi.fn(),
  },
}));

describe('BookSlice', () => {
  beforeEach(() => {
    useAppStore.setState({
      book: null,
      bookLoading: false,
      bookError: null,
      characters: [],
      charactersLoading: false,
      charactersError: null,
      events: [],
      eventsLoading: false,
      eventsError: null,
      messages: [],
      isStreaming: false,
      activeContent: null,
      sidebarLeftOpen: true,
      sidebarRightOpen: true,
    });
  });

  it('should have initial state', () => {
    const state = useAppStore.getState();
    expect(state.book).toBeNull();
    expect(state.bookLoading).toBe(false);
    expect(state.bookError).toBeNull();
  });

  it('should update book locally', async () => {
    const mockBook = {
      id: 'test',
      title: 'Test Book',
      items: [],
      metadata: { author: '', description: '', createdAt: '', updatedAt: '' },
    };

    await useAppStore.getState().updateBook(mockBook);
    expect(useAppStore.getState().book).toEqual(mockBook);
  });

  it('should add an item to the book', async () => {
    const mockBook = {
      id: 'test',
      title: 'Test Book',
      items: [],
      metadata: { author: '', description: '', createdAt: '', updatedAt: '' },
    };

    await useAppStore.getState().updateBook(mockBook);

    const newChapter = {
      type: 'chapter' as const,
      id: 'ch-1',
      title: 'Chapter 1',
    };

    useAppStore.getState().addItem(newChapter);

    const book = useAppStore.getState().book;
    expect(book?.items).toHaveLength(1);
    expect(book?.items[0].title).toBe('Chapter 1');
  });

  it('should update an item in the book', async () => {
    const mockBook = {
      id: 'test',
      title: 'Test Book',
      items: [
        { type: 'chapter' as const, id: 'ch-1', title: 'Old Title' },
      ],
      metadata: { author: '', description: '', createdAt: '', updatedAt: '' },
    };

    await useAppStore.getState().updateBook(mockBook);
    useAppStore.getState().updateItem('ch-1', { title: 'New Title' });

    expect(useAppStore.getState().book?.items[0].title).toBe('New Title');
  });

  it('should handle fetchBook loading state', async () => {
    const { api } = await import('../../api/client');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: 'test',
        title: 'Test',
        items: [],
        metadata: { author: '', description: '', createdAt: '', updatedAt: '' },
      },
    });

    const fetchPromise = useAppStore.getState().fetchBook();

    // Should be loading during fetch
    expect(useAppStore.getState().bookLoading).toBe(true);

    await fetchPromise;

    expect(useAppStore.getState().bookLoading).toBe(false);
    expect(useAppStore.getState().book).toBeTruthy();
  });
});
