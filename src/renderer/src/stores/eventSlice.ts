import type { StateCreator } from 'zustand';
import type { StoryEvent } from '../../../shared/types';
import { api } from '../api/client';

export interface EventSlice {
  events: StoryEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
  fetchEvents: () => Promise<void>;
  addEvent: (event: Omit<StoryEvent, 'id'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<StoryEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export const createEventSlice: StateCreator<EventSlice, [], [], EventSlice> = (set, get) => ({
  events: [],
  eventsLoading: false,
  eventsError: null,

  fetchEvents: async () => {
    set({ eventsLoading: true, eventsError: null });
    try {
      const response = await api.get<{ success: boolean; data: StoryEvent[] }>('/events');
      set({ events: response.data, eventsLoading: false });
    } catch (error) {
      set({ eventsError: String(error), eventsLoading: false });
    }
  },

  addEvent: async (event) => {
    try {
      // Inject activeBookId to ensure event is scoped to the current book
      const bookId = (get() as unknown as { activeBookId?: string }).activeBookId;
      const payload = bookId ? { ...event, bookId } : event;
      const response = await api.post<{ success: boolean; data: StoryEvent }>('/events', payload);
      set((state) => ({ events: [...state.events, response.data] }));
    } catch (error) {
      set({ eventsError: String(error) });
    }
  },

  updateEvent: async (id, updates) => {
    try {
      const response = await api.put<{ success: boolean; data: StoryEvent }>(`/events/${id}`, updates);
      set((state) => ({
        events: state.events.map(e => e.id === id ? response.data : e),
      }));
    } catch (error) {
      set({ eventsError: String(error) });
    }
  },

  deleteEvent: async (id) => {
    try {
      await api.delete(`/events/${id}`);
      set((state) => ({
        events: state.events.filter(e => e.id !== id),
      }));
    } catch (error) {
      set({ eventsError: String(error) });
    }
  },
});
