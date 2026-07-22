import type { StateCreator } from 'zustand';
import type { Character } from '../../../shared/types';
import { api } from '../api/client';

export interface CharacterSlice {
  characters: Character[];
  charactersLoading: boolean;
  charactersError: string | null;
  fetchCharacters: () => Promise<void>;
  addCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCharacter: (id: string, updates: Partial<Character>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
}

export const createCharacterSlice: StateCreator<CharacterSlice, [], [], CharacterSlice> = (set, get) => ({
  characters: [],
  charactersLoading: false,
  charactersError: null,

  fetchCharacters: async () => {
    set({ charactersLoading: true, charactersError: null });
    try {
      const response = await api.get<{ success: boolean; data: Character[] }>('/characters');
      set({ characters: response.data, charactersLoading: false });
    } catch (error) {
      set({ charactersError: String(error), charactersLoading: false });
    }
  },

  addCharacter: async (character) => {
    try {
      // Inject activeBookId to ensure character is scoped to the current book
      const bookId = (get() as unknown as { activeBookId?: string }).activeBookId;
      const payload = bookId ? { ...character, bookId } : character;
      const response = await api.post<{ success: boolean; data: Character }>('/characters', payload);
      set((state) => ({ characters: [...state.characters, response.data] }));
    } catch (error) {
      set({ charactersError: String(error) });
    }
  },

  updateCharacter: async (id, updates) => {
    try {
      const response = await api.put<{ success: boolean; data: Character }>(`/characters/${id}`, updates);
      set((state) => ({
        characters: state.characters.map(c => c.id === id ? response.data : c),
      }));
    } catch (error) {
      set({ charactersError: String(error) });
    }
  },

  deleteCharacter: async (id) => {
    try {
      await api.delete(`/characters/${id}`);
      set((state) => ({
        characters: state.characters.filter(c => c.id !== id),
      }));
    } catch (error) {
      set({ charactersError: String(error) });
    }
  },
});
