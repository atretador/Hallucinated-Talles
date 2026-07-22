import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from '../components/timeline/Timeline';
import { useAppStore } from '../stores';

// Mock the API module used by the stores
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    put: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  },
  projectApi: {
    getBook: vi.fn(),
    updateBook: vi.fn(),
    getCharacters: vi.fn(),
    addCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    getEvents: vi.fn().mockResolvedValue({ data: [] }),
    addEvent: vi.fn(),
    getPageContent: vi.fn(),
    savePageContent: vi.fn(),
    search: vi.fn(),
  },
}));

const mockEvents = [
  {
    id: 'evt-1',
    bookId: 'book-1',
    title: 'Battle of Helm\'s Deep',
    description: 'A great battle at the fortress of Helm\'s Deep.',
    timestamp: 'TA 3019',
    characters: ['char-1', 'char-2'],
    chapterId: 'ch-1',
    type: 'major' as const,
    consequences: ['Theoden rallies', 'Many casualties'],
    sortOrder: 2,
    locations: [],
  },
  {
    id: 'evt-2',
    bookId: 'book-1',
    title: 'Gandalf arrives',
    description: 'Gandalf the White arrives at dawn.',
    timestamp: 'TA 3019',
    characters: ['char-1'],
    chapterId: 'ch-1',
    type: 'major' as const,
    consequences: ['Rohirrim saved'],
    sortOrder: 1,
    locations: [],
  },
  {
    id: 'evt-3',
    bookId: 'book-1',
    title: 'Background event',
    description: 'Some minor happening in the background.',
    timestamp: 'TA 3018',
    characters: [],
    chapterId: 'ch-1',
    type: 'background' as const,
    consequences: [],
    sortOrder: 3,
    locations: [],
  },
];

const mockCharacters = [
  { id: 'char-1', bookId: '', name: 'Aragorn', aliases: [], description: '', attributes: [], entries: [], relations: [], storyPoints: [], createdAt: '', updatedAt: '' },
  { id: 'char-2', bookId: '', name: 'Legolas', aliases: [], description: '', attributes: [], entries: [], relations: [], storyPoints: [], createdAt: '', updatedAt: '' },
];

describe('Timeline', () => {
  beforeEach(() => {
    useAppStore.setState({
      events: mockEvents,
      characters: mockCharacters,
      eventsLoading: false,
      eventsError: null,
      activeContent: null,
      timelineOpen: false,
      sidebarLeftOpen: true,
      sidebarRightOpen: true,
      book: null,
      bookLoading: false,
      bookError: null,
      messages: [],
      isStreaming: false,
      streamingParts: [],
    });
  });

  it('renders the timeline header', () => {
    render(<Timeline />);
    expect(screen.getByText('Timeline')).toBeDefined();
  });

  it('renders events sorted by sortOrder', () => {
    render(<Timeline />);
    expect(screen.getByText('Gandalf arrives')).toBeDefined();
    expect(screen.getByText('Battle of Helm\'s Deep')).toBeDefined();
    expect(screen.getByText('Background event')).toBeDefined();
  });

  it('shows character names on event cards', () => {
    render(<Timeline />);
    expect(screen.getByText('Aragorn, Legolas')).toBeDefined();
  });

  it('shows empty state when no events', () => {
    useAppStore.setState({ events: [] });
    render(<Timeline />);
    expect(screen.getByText('No events yet.')).toBeDefined();
  });

  it('filters by event type', () => {
    render(<Timeline />);
    const majorButton = screen.getByText('Major');
    fireEvent.click(majorButton);
    expect(screen.getByText('Gandalf arrives')).toBeDefined();
    expect(screen.getByText('Battle of Helm\'s Deep')).toBeDefined();
    expect(screen.queryByText('Background event')).toBeNull();
  });

  it('clicking an event sets activeContent', () => {
    render(<Timeline />);
    const gandalfCard = screen.getByText('Gandalf arrives');
    fireEvent.click(gandalfCard);
    const state = useAppStore.getState();
    expect(state.activeContent).toEqual({ kind: 'event', bookId: 'book-1', eventId: 'evt-2' });
  });
});
