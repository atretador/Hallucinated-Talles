import type { StateCreator } from 'zustand';
import type { ContentAddress, EditorPageData } from '../../../shared/types';

export type AppView = 'loading' | 'llmSetup' | 'directorySetup' | 'projects' | 'author' | 'tokenUsage' | 'planner';

export type EntityDetailRef = { kind: 'character' | 'event' | 'worldData'; id: string; mode?: 'view' } | { kind: 'character' | 'event' | 'worldData'; mode: 'add' } | null;

export interface AiEditInfo {
  editId: string;
  action: 'rewrite' | 'tweak' | 'remove';
  startedAt: string;
  minimized: boolean;
  /** ProseMirror doc position of the start of the selected range — used to locate the affected page */
  selectionFrom?: number;
}

export interface UISlice {
  appView: AppView;
  activeContent: ContentAddress | null;
  editorScrollTarget: ContentAddress | null;
  editorPageData: EditorPageData | null;
  sidebarLeftOpen: boolean;
  sidebarRightOpen: boolean;
  timelineOpen: boolean;
  settingsOpen: boolean;
  activeAiEdits: Map<string, AiEditInfo>;
  entityDetailPanel: EntityDetailRef;
  setAppView: (view: AppView) => void;
  setActiveContent: (content: ContentAddress | null) => void;
  setEditorScrollTarget: (content: ContentAddress | null) => void;
  setEditorPageData: (data: EditorPageData | null) => void;
  toggleSidebarLeft: () => void;
  toggleSidebarRight: () => void;
  toggleTimeline: () => void;
  setSettingsOpen: (open: boolean) => void;
  setEntityDetailPanel: (ref: EntityDetailRef) => void;
  setAiEdit: (editId: string, info: AiEditInfo) => void;
  setAiEditMinimized: (editId: string, minimized: boolean) => void;
  clearAiEdit: (editId: string) => void;
  resetForProjectSwitch: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  appView: 'loading',
  activeContent: null,
  editorScrollTarget: null,
  editorPageData: null,
  sidebarLeftOpen: true,
  sidebarRightOpen: true,
  timelineOpen: false,
  settingsOpen: false,
  activeAiEdits: new Map<string, AiEditInfo>(),
  entityDetailPanel: null,

  setAppView: (view) => {
    set({ appView: view });
  },

  setActiveContent: (content) => {
    set({ activeContent: content });
  },

  setEditorScrollTarget: (content) => {
    set({ editorScrollTarget: content });
  },

  setEditorPageData: (data) => {
    set({ editorPageData: data });
  },

  toggleSidebarLeft: () => {
    set((state) => ({ sidebarLeftOpen: !state.sidebarLeftOpen }));
  },

  toggleSidebarRight: () => {
    set((state) => ({ sidebarRightOpen: !state.sidebarRightOpen }));
  },

  toggleTimeline: () => {
    set((state) => ({ timelineOpen: !state.timelineOpen }));
  },

  setSettingsOpen: (open) => {
    set({ settingsOpen: open });
  },

  setEntityDetailPanel: (ref) => {
    set({ entityDetailPanel: ref });
  },

  setAiEdit: (editId, info) => {
    set((s) => {
      const next = new Map(s.activeAiEdits);
      next.set(editId, info);
      return { activeAiEdits: next };
    });
  },

  setAiEditMinimized: (editId, minimized) => {
    set((s) => {
      const next = new Map(s.activeAiEdits);
      const existing = next.get(editId);
      if (existing) {
        next.set(editId, { ...existing, minimized });
      }
      return { activeAiEdits: next };
    });
  },

  clearAiEdit: (editId) => {
    set((s) => {
      const next = new Map(s.activeAiEdits);
      next.delete(editId);
      return { activeAiEdits: next };
    });
  },

  resetForProjectSwitch: () => {
    set({
      activeContent: null,
      editorScrollTarget: null,
      editorPageData: null,
      sidebarLeftOpen: true,
      sidebarRightOpen: true,
      timelineOpen: false,
      settingsOpen: false,
      activeAiEdits: new Map(),
      entityDetailPanel: null,
      // Clear session state to prevent leakage between projects
      sessions: [],
      activeSessionId: null,
      currentSessionData: null,
      planModel: null,
      planLoading: false,
      planError: null,
    } as Record<string, unknown>);
  },
});
