import type { StateCreator } from 'zustand';
import type { PlanModel, PlanNode, PlanEdge, PlanNodeData, GenerationProgress } from '../../../shared/types';
import { planApi } from '../api/client';
import { computeAutoLayout } from '../components/planner/autoLayout';

// ── Debounced save helper ──
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1500;

function debouncedSave(get: () => PlanSlice) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    get().savePlan().catch(() => {});
  }, DEBOUNCE_MS);
}

export interface PlanSlice {
  planModel: PlanModel | null;
  planLoading: boolean;
  planError: string | null;
  canvasViewport: { x: number; y: number; zoom: number };
  canvasSelection: string[];
  layoutVersion: number;
  generationStatus: 'idle' | 'connecting' | 'generating' | 'complete' | 'error';
  generationProgress: GenerationProgress | null;
  generationError: string | null;

  loadPlan: () => Promise<void>;
  savePlan: () => Promise<void>;
  flushSave: () => void;
  setPlanModel: (plan: PlanModel) => void;
  addNode: (node: PlanNode) => void;
  updateNode: (id: string, data: Partial<PlanNodeData>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: PlanEdge) => void;
  deleteEdge: (id: string) => void;
  autoLayout: () => void;
  setCanvasViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  setCanvasSelection: (selection: string[]) => void;
  clearPlan: () => void;
  startGeneration: (effort?: 'low' | 'medium' | 'high') => Promise<void>;
}

export const createPlanSlice: StateCreator<PlanSlice, [], [], PlanSlice> = (set, get) => ({
  planModel: null,
  planLoading: false,
  planError: null,
  canvasViewport: { x: 0, y: 0, zoom: 1 },
  canvasSelection: [],
  layoutVersion: 0,
  generationStatus: 'idle',
  generationProgress: null,
  generationError: null,

  loadPlan: async () => {
    set({ planLoading: true, planError: null });
    try {
      const res = await planApi.get();
      if (res.success) {
        set({ planModel: res.data ?? null, planLoading: false });
      } else {
        set({ planError: res.error ?? 'Failed to load plan', planLoading: false });
      }
    } catch (error) {
      set({ planError: String(error), planLoading: false });
    }
  },

  savePlan: async () => {
    const { planModel } = get();
    if (!planModel) return;
    try {
      await planApi.save(planModel);
    } catch {
      // Fire-and-forget; errors are non-fatal
      console.debug('[planSlice] Plan save failed (fire-and-forget)');
    }
  },

  flushSave: () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
      get().savePlan().catch(() => {});
    }
  },

  setPlanModel: (plan: PlanModel) => {
    set({ planModel: plan });
    debouncedSave(get);
  },

  addNode: (node: PlanNode) => {
    set((state) => {
      if (!state.planModel) {
        return {
          planModel: {
            version: 1,
            nodes: [node],
            edges: [],
          },
        };
      }
      return {
        planModel: {
          ...state.planModel,
          nodes: [...state.planModel.nodes, node],
        },
      };
    });
    debouncedSave(get);
  },

  updateNode: (id: string, data: Partial<PlanNodeData>) => {
    set((state) => {
      if (!state.planModel) return state;
      return {
        planModel: {
          ...state.planModel,
          nodes: state.planModel.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
          ),
        },
      };
    });
    debouncedSave(get);
  },

  updateNodePosition: (id: string, position: { x: number; y: number }) => {
    set((state) => {
      if (!state.planModel) return state;
      return {
        planModel: {
          ...state.planModel,
          nodes: state.planModel.nodes.map((n) =>
            n.id === id ? { ...n, position } : n,
          ),
        },
      };
    });
    debouncedSave(get);
  },

  deleteNode: (id: string) => {
    set((state) => {
      if (!state.planModel) return state;
      return {
        planModel: {
          ...state.planModel,
          nodes: state.planModel.nodes.filter((n) => n.id !== id),
          edges: state.planModel.edges.filter((e) => e.source !== id && e.target !== id),
        },
      };
    });
    debouncedSave(get);
  },

  addEdge: (edge: PlanEdge) => {
    set((state) => {
      if (!state.planModel) {
        return {
          planModel: {
            version: 1,
            nodes: [],
            edges: [edge],
          },
        };
      }
      return {
        planModel: {
          ...state.planModel,
          edges: [...state.planModel.edges, edge],
        },
      };
    });
    debouncedSave(get);
  },

  deleteEdge: (id: string) => {
    set((state) => {
      if (!state.planModel) return state;
      return {
        planModel: {
          ...state.planModel,
          edges: state.planModel.edges.filter((e) => e.id !== id),
        },
      };
    });
    debouncedSave(get);
  },

  setCanvasViewport: (viewport) => {
    set({ canvasViewport: viewport });
  },

  setCanvasSelection: (selection) => {
    set({ canvasSelection: selection });
  },

  autoLayout: () => {
    const { planModel, layoutVersion } = get();
    if (!planModel) return;
    const laid = computeAutoLayout(planModel);
    set({ planModel: laid, layoutVersion: layoutVersion + 1 });
    debouncedSave(get);
  },

  clearPlan: () => {
    set({
      planModel: null,
      planLoading: false,
      planError: null,
      canvasViewport: { x: 0, y: 0, zoom: 1 },
      canvasSelection: [],
      layoutVersion: 0,
    });
  },

  startGeneration: async (effort) => {
    set({ generationStatus: 'connecting', generationProgress: null, generationError: null });

    try {
      const response = await planApi.generate(effort);

      if (!response.ok) {
        const error = await response.text();
        set({ generationStatus: 'error', generationError: error || 'Generation failed' });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        set({ generationStatus: 'error', generationError: 'No response body' });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6);
            try {
              const data = JSON.parse(raw);
              switch (currentEvent) {
                case 'progress':
                  set({
                    generationStatus: 'generating',
                    generationProgress: data as GenerationProgress,
                  });
                  break;
                case 'node_complete': {
                  // Reload plan to get updated generatedChapterId
                  const plan = await planApi.get();
                  if (plan.data) {
                    set({ planModel: plan.data });
                  }
                  break;
                }
                case 'complete':
                  set({ generationStatus: 'complete' });
                  // Reload plan one final time
                  {
                    const plan = await planApi.get();
                    if (plan.data) {
                      set({ planModel: plan.data });
                    }
                  }
                  break;
                case 'error':
                  set({ generationStatus: 'error', generationError: data.error || 'Generation failed' });
                  break;
                default: {
                  // Fallback: infer from data shape
                  if (data.status === 'connecting' || data.status === 'connected') {
                    set({ generationStatus: 'connecting' });
                  } else if (data.error) {
                    set({ generationStatus: 'error', generationError: data.error });
                  }
                  break;
                }
              }
            } catch {
              // skip malformed JSON
              console.debug('[planSlice] Skipped malformed JSON in SSE stream');
            }
            currentEvent = '';
          }
        }
      }
    } catch (error) {
      set({
        generationStatus: 'error',
        generationError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});
