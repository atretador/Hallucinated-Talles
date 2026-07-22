import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';

/* ── Types ────────────────────────────────────────────── */

export interface HighlightRange {
  from: number;
  to: number;
}

/* ── Plugin Key ───────────────────────────────────────── */

export const aiHighlightPluginKey = new PluginKey<HighlightRange | null>('aiHighlight');

/* ── Helper functions (direct access via editor reference) ── */

export function setAiHighlightRange(editor: Editor, range: HighlightRange): void {
  const { from, to } = range;
  if (from < 0 || to > editor.state.doc.content.size || from >= to) return;
  const tr = editor.state.tr;
  tr.setMeta(aiHighlightPluginKey, { from, to });
  editor.view.dispatch(tr);
}

export function clearAiHighlightRange(editor: Editor): void {
  const tr = editor.state.tr;
  tr.setMeta(aiHighlightPluginKey, null);
  editor.view.dispatch(tr);
}

/* ── Extension ────────────────────────────────────────── */

export const AiHighlight = Extension.create({
  name: 'aiHighlight',

  addCommands() {
    return {
      setHighlightRange:
        (range: HighlightRange) =>
        ({ tr, dispatch }) => {
          const { from, to } = range;
          if (from < 0 || to > tr.doc.content.size || from >= to) return false;
          if (dispatch) {
            tr.setMeta(aiHighlightPluginKey, { from, to });
            dispatch(tr);
          }
          return true;
        },
      clearHighlightRange:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(aiHighlightPluginKey, null);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: aiHighlightPluginKey,

        state: {
          init() {
            return null;
          },
          apply(tr, value) {
            const meta = tr.getMeta(aiHighlightPluginKey);
            if (meta !== undefined) {
              return meta;
            }
            // Clear highlight if the document changed (range is now stale)
            if (tr.docChanged && value) {
              return null;
            }
            return value;
          },
        },

        props: {
          decorations(state) {
            const range = aiHighlightPluginKey.getState(state);
            if (!range) return undefined;

            const { from, to } = range;
            // Guard against stale positions
            if (from < 0 || to > state.doc.content.size || from >= to) {
              return undefined;
            }

            return DecorationSet.create(state.doc, [
              Decoration.inline(from, to, { class: 'ai-tweak-highlight' }),
            ]);
          },
        },
      }),
    ];
  },
});

/* ── Command type augmentation ────────────────────────── */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiHighlight: {
      setHighlightRange: (range: HighlightRange) => ReturnType;
      clearHighlightRange: () => ReturnType;
    };
  }
}
