import type { StateCreator } from 'zustand';
import type { ChatMessage, ChatMessagePart, PendingEdit, ToolCall, SessionCommit } from '../../../shared/types';

export interface ChatSlice {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingParts: ChatMessagePart[];
  pendingEdits: PendingEdit[];
  streamCommits: SessionCommit[];
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  resetStreaming: () => void;
  appendStreamingContent: (delta: string) => void;
  appendStreamingReasoning: (delta: string) => void;
  addStreamingToolCall: (toolCall: ToolCall) => void;
  updateStreamingToolCallResult: (id: string, result: unknown) => void;
  addStreamCommit: (commit: SessionCommit) => void;
  clearStreamCommits: () => void;
  finalizeStream: (message: ChatMessage) => void;
  clearMessages: () => void;
  addPendingEdit: (edit: PendingEdit) => void;
  removePendingEdit: (id: string) => void;
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set) => ({
  messages: [],
  isStreaming: false,
  streamingParts: [],
  pendingEdits: [],
  streamCommits: [],

  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
  },

  setMessages: (messages) => {
    set({ messages });
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming });
  },

  resetStreaming: () => {
    set({ streamingParts: [] });
  },

  appendStreamingContent: (delta) => {
    set((state) => {
      const parts = [...state.streamingParts];
      const last = parts[parts.length - 1];
      if (last?.type === 'text') {
        parts[parts.length - 1] = { ...last, content: last.content + delta };
      } else {
        parts.push({ type: 'text', content: delta });
      }
      return { streamingParts: parts };
    });
  },

  appendStreamingReasoning: (delta) => {
    set((state) => {
      const parts = [...state.streamingParts];
      const last = parts[parts.length - 1];
      if (last?.type === 'thinking') {
        parts[parts.length - 1] = { ...last, content: last.content + delta };
      } else {
        parts.push({ type: 'thinking', content: delta });
      }
      return { streamingParts: parts };
    });
  },

  addStreamingToolCall: (toolCall) => {
    set((state) => ({
      streamingParts: [...state.streamingParts, { type: 'tool_call', toolCall }],
    }));
  },

  updateStreamingToolCallResult: (id, result) => {
    set((state) => ({
      streamingParts: state.streamingParts.map((part) =>
        part.type === 'tool_call' && part.toolCall.id === id
          ? { ...part, toolCall: { ...part.toolCall, result } }
          : part,
      ),
    }));
  },

  addStreamCommit: (commit) => {
    set((state) => ({ streamCommits: [...state.streamCommits, commit] }));
  },

  clearStreamCommits: () => {
    set({ streamCommits: [] });
  },

  finalizeStream: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
      isStreaming: false,
      streamingParts: [],
      streamCommits: [],
    }));
  },

  clearMessages: () => {
    set({ messages: [], streamingParts: [], pendingEdits: [] });
  },

  addPendingEdit: (edit) => {
    set((state) => ({ pendingEdits: [...state.pendingEdits, edit] }));
  },

  removePendingEdit: (id) => {
    set((state) => ({ pendingEdits: state.pendingEdits.filter((e) => e.id !== id) }));
  },
});
