import { create } from 'zustand';
import { temporal } from 'zundo';
import type { BookSlice } from './bookSlice';
import { createBookSlice } from './bookSlice';
import type { CharacterSlice } from './characterSlice';
import { createCharacterSlice } from './characterSlice';
import type { EventSlice } from './eventSlice';
import { createEventSlice } from './eventSlice';
import type { ChatSlice } from './chatSlice';
import { createChatSlice } from './chatSlice';
import type { UISlice } from './uiSlice';
import { createUISlice } from './uiSlice';
import type { SessionSlice } from './sessionSlice';
import { createSessionSlice } from './sessionSlice';
import type { SkillsSlice } from './skillsSlice';
import { createSkillsSlice } from './skillsSlice';
import type { McpServersSlice } from './mcpServersSlice';
import { createMcpServersSlice } from './mcpServersSlice';
import type { PlanSlice } from './planSlice';
import { createPlanSlice } from './planSlice';
import type { WorldDataSlice } from './worldDataSlice';
import { createWorldDataSlice } from './worldDataSlice';
import type { RelationSlice } from './relationSlice';
import { createRelationSlice } from './relationSlice';

type AppState = BookSlice & CharacterSlice & EventSlice & WorldDataSlice & RelationSlice & ChatSlice & UISlice & SessionSlice & SkillsSlice & McpServersSlice & PlanSlice;

export const useAppStore = create<AppState>()(
  temporal(
    (...a) => ({
      ...createBookSlice(...a),
      ...createCharacterSlice(...a),
      ...createEventSlice(...a),
      ...createWorldDataSlice(...a),
      ...createRelationSlice(...a),
      ...createChatSlice(...a),
      ...createUISlice(...a),
      ...createSessionSlice(...a),
      ...createSkillsSlice(...a),
      ...createMcpServersSlice(...a),
      ...createPlanSlice(...a),
    }),
    {
      partialize: (state) => {
        // Exclude view navigation, book switching, and book-scoped data from undo history
        const {
          appView: _appView,
          activeBookId: _activeBookId,
          activeProjectId: _activeProjectId,
          books: _books,
          // Book-scoped data — undoing after switchBook must not restore old book's data
          characters: _characters,
          events: _events,
          worldData: _worldData,
          relations: _relations,
          messages: _messages,
          sessions: _sessions,
          activeSessionId: _activeSessionId,
          currentSessionData: _currentSessionData,
          // Skills state — not undoable
          skills: _skills,
          activeSkillIds: _activeSkillIds,
          skillsLoading: _skillsLoading,
          // MCP servers state — not undoable
          mcpServers: _mcpServers,
          activeMcpServerIds: _activeMcpServerIds,
          mcpServersLoading: _mcpServersLoading,
          // Canvas state — not undoable (viewport/selection/layout are transient)
          canvasViewport: _canvasViewport,
          canvasSelection: _canvasSelection,
          layoutVersion: _layoutVersion,
          // AI edit panel state — transient, not undoable
          activeAiEdits: _activeAiEdits,
          ...rest
        } = state;
        return rest;
      },
    },
  ),
);

// Export undo/redo helpers (getter functions, not stale snapshots)
export const undo = () => useAppStore.temporal.getState().undo();
export const redo = () => useAppStore.temporal.getState().redo();
export const clear = () => useAppStore.temporal.getState().clear();
export const getPastStates = () => useAppStore.temporal.getState().pastStates;
export const getFutureStates = () => useAppStore.temporal.getState().futureStates;
