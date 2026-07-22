import type { StateCreator } from 'zustand';
import type { AgentSession, SessionData, SessionCommit, AgentTask, SubAgentRun } from '../../../shared/types';
import { sessionApi } from '../api/client';

export interface SessionSlice {
  sessions: AgentSession[];
  activeSessionId: string | null;
  currentSessionData: SessionData | null;
  sessionsLoading: boolean;

  // Actions
  loadSessions: (bookId?: string) => Promise<void>;
  createSession: (title?: string) => Promise<string>;
  switchSession: (id: string) => Promise<void>;
  updateSession: (id: string, updates: Partial<AgentSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  archiveSession: (id: string) => Promise<void>;
  forkSession: (id: string, title?: string) => Promise<string>;
  addMessageToSession: (message: import('../../../shared/types').ChatMessage) => Promise<void>;
  addCommitToSession: (commit: SessionCommit) => Promise<void>;
  addTask: (task: AgentTask) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<AgentTask>) => Promise<void>;
  addSubAgentRun: (run: SubAgentRun) => Promise<void>;
  updateSubAgentRun: (runId: string, updates: Partial<SubAgentRun>) => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
  clearSessionMessages: () => void;
  undoChange: (entityType: string, entityId: string) => Promise<SessionCommit | undefined>;
}

export const createSessionSlice: StateCreator<SessionSlice, [], [], SessionSlice> = (set, get) => ({
  sessions: [],
  activeSessionId: null,
  currentSessionData: null,
  sessionsLoading: false,

  loadSessions: async (bookId?: string) => {
    set({ sessionsLoading: true });
    try {
      const res = await sessionApi.list(bookId);
      if (res.success && res.data) {
        set({ sessions: res.data, sessionsLoading: false });
        // Auto-restore last active session if available
        const { activeSessionId } = get();
        if (!activeSessionId && res.data.length > 0) {
          let lastId: string | null = null;
          try { lastId = localStorage.getItem('lastActiveSessionId'); } catch { /* noop */ }
          const targetId = (lastId && res.data.some(s => s.id === lastId)) ? lastId : res.data[0].id;
          await get().switchSession(targetId);
        }
      }
    } catch {
      set({ sessionsLoading: false });
    }
  },

  createSession: async (title?: string) => {
    // Get current bookId from the store
    const fullState = (get() as unknown as Record<string, unknown>);
    const activeBookId = (fullState.activeBookId as string) || undefined;
    const res = await sessionApi.create(title, activeBookId);
    if (res.success && res.data) {
      const newSession = res.data;
      set((state) => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newSession.id,
        currentSessionData: {
          session: newSession,
          messages: [],
          commits: [],
        },
      }));
      return newSession.id;
    }
    throw new Error('Failed to create session');
  },

  switchSession: async (id: string) => {
    const { activeSessionId } = get();
    if (id === activeSessionId) return;

    set({ sessionsLoading: true });
    try {
      const res = await sessionApi.get(id);
      if (res.success && res.data) {
        set({
          activeSessionId: id,
          currentSessionData: res.data,
          sessionsLoading: false,
        });
        // Persist last active session for restore on refresh
        try { localStorage.setItem('lastActiveSessionId', id); } catch { /* noop */ }
      }
    } catch {
      set({ sessionsLoading: false });
    }
  },

  updateSession: async (id: string, updates: Partial<AgentSession>) => {
    const res = await sessionApi.update(id, updates);
    if (res.success && res.data) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? res.data! : s)),
        currentSessionData:
          state.currentSessionData?.session.id === id
            ? { ...state.currentSessionData, session: res.data! }
            : state.currentSessionData,
      }));
    }
  },

  deleteSession: async (id: string) => {
    await sessionApi.delete(id);
    const { activeSessionId, sessions } = get();
    const filtered = sessions.filter((s) => s.id !== id);

    if (activeSessionId === id) {
      // Switch to first available session or clear
      if (filtered.length > 0) {
        set({ sessions: filtered });
        await get().switchSession(filtered[0].id);
      } else {
        set({
          sessions: filtered,
          activeSessionId: null,
          currentSessionData: null,
        });
      }
    } else {
      set({ sessions: filtered });
    }
  },

  archiveSession: async (id: string) => {
    await get().updateSession(id, { status: 'archived' });
  },

  forkSession: async (id: string, title?: string) => {
    const res = await sessionApi.fork(id, title);
    if (res.success && res.data) {
      const newSession = res.data;
      set((state) => ({
        sessions: [newSession, ...state.sessions],
      }));
      return newSession.id;
    }
    throw new Error('Failed to fork session');
  },

  addMessageToSession: async (message) => {
    const { activeSessionId, currentSessionData } = get();
    if (!activeSessionId || !currentSessionData) return;

    // Optimistic update
    set({
      currentSessionData: {
        ...currentSessionData,
        messages: [...currentSessionData.messages, message],
      },
    });

    // Persist to server
    try {
      await sessionApi.addMessage(activeSessionId, message);
    } catch {
      // Rollback on failure would go here
      console.warn('[sessionSlice] Failed to persist message, rollback needed');
    }
  },

  addCommitToSession: async (commit) => {
    const { activeSessionId, currentSessionData } = get();
    if (!activeSessionId || !currentSessionData) return;

    // Optimistic update
    set({
      currentSessionData: {
        ...currentSessionData,
        commits: [...currentSessionData.commits, commit],
      },
    });

    // NOTE: Commit persistence is handled server-side in chatStream.ts via
    // sessionFs.addCommit(). The old sessionApi.update({}) call here was a
    // no-op that read-and-rewrote the session file, causing a lost-update
    // race condition with addMessage() that overwrote assistant messages.
  },

  addTask: async (task) => {
    const { activeSessionId, currentSessionData } = get();
    if (!activeSessionId || !currentSessionData) return;

    // Optimistic update
    set({
      currentSessionData: {
        ...currentSessionData,
        tasks: [...(currentSessionData.tasks ?? []), task],
      },
    });

    // Persist to server
    try {
      await sessionApi.addTask(activeSessionId, task);
    } catch {
      // Rollback on failure
      console.warn('[sessionSlice] Failed to add task, rollback needed');
    }
  },

  updateTask: async (taskId, updates) => {
    const { activeSessionId, currentSessionData } = get();
    if (!activeSessionId || !currentSessionData) return;

    const prevTasks = currentSessionData.tasks ?? [];

    // Optimistic update
    set({
      currentSessionData: {
        ...currentSessionData,
        tasks: prevTasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      },
    });

    // Persist to server
    try {
      await sessionApi.updateTask(activeSessionId, taskId, updates);
    } catch {
      // Rollback on failure
      console.warn('[sessionSlice] Failed to update task, rollback needed');
    }
  },

  addSubAgentRun: async (run) => {
    const { activeSessionId, currentSessionData } = get();
    if (!activeSessionId || !currentSessionData) return;

    // Optimistic update
    set({
      currentSessionData: {
        ...currentSessionData,
        subAgentRuns: [...(currentSessionData.subAgentRuns ?? []), run],
      },
    });

    // Persist to server
    try {
      await sessionApi.addSubAgentRun(activeSessionId, run);
    } catch {
      // Rollback on failure
      console.warn('[sessionSlice] Failed to add sub-agent run, rollback needed');
    }
  },

  updateSubAgentRun: async (runId, updates) => {
    const { activeSessionId, currentSessionData } = get();
    if (!activeSessionId || !currentSessionData) return;

    const prevRuns = currentSessionData.subAgentRuns ?? [];

    // Optimistic update
    set({
      currentSessionData: {
        ...currentSessionData,
        subAgentRuns: prevRuns.map((r) => (r.id === runId ? { ...r, ...updates } : r)),
      },
    });

    // Persist to server
    try {
      await sessionApi.updateSubAgentRun(activeSessionId, runId, updates);
    } catch {
      // Rollback on failure
      console.warn('[sessionSlice] Failed to update sub-agent run, rollback needed');
    }
  },

  refreshCurrentSession: async () => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    try {
      const res = await sessionApi.get(activeSessionId);
      if (res.success && res.data) {
        set({ currentSessionData: res.data });
      }
    } catch {
      // non-fatal
      console.debug('[sessionSlice] Failed to refresh current session');
    }
  },

  clearSessionMessages: () => {
    const { currentSessionData } = get();
    if (!currentSessionData) return;
    set({
      currentSessionData: {
        ...currentSessionData,
        messages: [],
      },
    });
  },

  undoChange: async (entityType: string, entityId: string) => {
    const { currentSessionData } = get();
    if (!currentSessionData) return;

    try {
      const result = await sessionApi.undoChange(currentSessionData.session.id, entityType, entityId);
      if (result.success && result.data) {
        const commit = result.data;
        set((state) => ({
          currentSessionData: state.currentSessionData
            ? {
                ...state.currentSessionData,
                commits: [...state.currentSessionData.commits, commit],
              }
            : null,
        }));

        // Refresh book structure to reflect the restored content
        const fullState = get() as unknown as Record<string, unknown>;
        const fetchBook = fullState.fetchBook as (() => Promise<void>) | undefined;
        if (fetchBook) fetchBook();

        return commit;
      }
    } catch (error) {
      console.error('Failed to undo change:', error);
      throw error;
    }
  },
});
