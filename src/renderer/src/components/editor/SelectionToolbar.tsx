import { useState, useRef, useEffect, useCallback } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../stores';
import type { EditAction, EditContext } from './useAiEdit';
import type { AiEffort } from '../../../../shared/types';
import { AiTweakInput } from './AiTweakInput';
import { AiEditSidePanel } from './AiEditSidePanel';
import { setAiHighlightRange, clearAiHighlightRange } from '../../editor/extensions/aiHighlight';
import { useTranslation } from 'react-i18next';

/* ── Types ───────────────────────────────────────────── */

interface SelectionToolbarProps {
  editor: Editor;
  effort?: AiEffort;
}

type ToolbarMode = 'buttons' | 'tweak-input';

/* ── Main Toolbar ────────────────────────────────────── */

export function SelectionToolbar({ editor, effort }: SelectionToolbarProps) {
  const [mode, setMode] = useState<ToolbarMode>('buttons');
  const [tweakFeedback, setTweakFeedback] = useState('');
  const [editCtx, setEditCtx] = useState<EditContext | null>(null);
  // FIX #4: retryKey forces EditModal to re-run its streaming effect on retry.
  const [retryKey, setRetryKey] = useState(0);
  const tweakInputRef = useRef<HTMLInputElement>(null);

  const { isStreaming, activeSessionId, setAiEdit, clearAiEdit } = useAppStore();
  const { t } = useTranslation();

  // Focus tweak input when mode changes
  useEffect(() => {
    if (mode === 'tweak-input' && tweakInputRef.current) {
      tweakInputRef.current.focus();
    }
  }, [mode]);

  // Set/clear breathing highlight on selected text
  useEffect(() => {
    if (mode === 'tweak-input') {
      // Tweak input mode — highlight current selection
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setAiHighlightRange(editor, { from, to });
      }
    } else if (editCtx) {
      // AI edit active — highlight the range the user originally selected
      setAiHighlightRange(editor, { from: editCtx.from, to: editCtx.to });
    } else {
      clearAiHighlightRange(editor);
    }

    return () => {
      clearAiHighlightRange(editor);
    };
  }, [mode, editor, editCtx]);

  // Cleanup: clear stale AI edit entry when component unmounts mid-edit
  useEffect(() => {
    return () => {
      if (editCtx) {
        clearAiEdit('editor');
      }
    };
  }, [editCtx, clearAiEdit]);

  // Reset mode when selection changes (but not while modal is open)
  useEffect(() => {
    const handleSelectionUpdate = () => {
      if (!editCtx) {
        setMode('buttons');
        setTweakFeedback('');
      }
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, editCtx]);

  const buildPrompt = useCallback(
    (action: EditAction, feedback?: string) => {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, '\n');
      const doc = editor.state.doc;
      const contextBefore = Math.max(0, from - 2000);
      const contextAfter = Math.min(doc.content.size, to + 2000);
      const windowedText = doc.textBetween(contextBefore, contextAfter, '\n');

      const actionInstructions =
        action === 'rewrite'
          ? 'rewrite the following selected text. Keep the same meaning and tone, but improve the writing quality.'
          : action === 'remove'
            ? 'remove the following selected text from the document. If necessary, adjust the text before and after the removal to ensure the flow remains natural and coherent.'
            : 'tweak the following selected text based on my feedback.';

      const feedbackBlock = feedback ? `\n**My feedback:** ${feedback}\n` : '';

      const prompt = `I need you to ${actionInstructions}

**Selection range:** characters ${from} to ${to}
${feedbackBlock}
**Selected text:**
---
${selectedText}
---

**Context around selection (for context):**
---
${windowedText}
---

**IMPORTANT HTML FORMATTING RULES:**
- The replacement text MUST be valid HTML.
- Wrap EACH paragraph in <p> tags. Example: <p>First paragraph.</p><p>Second paragraph.</p>
- Use <br> for line breaks within a paragraph.
- Use <strong> for bold, <em> for italic.
- Do NOT return plain text without HTML tags.

Please ${action === 'remove' ? 'remove the selected text and adjust surrounding text' : 'rewrite the selected text'} and use the editRange tool to apply the changes. Make sure to preserve the surrounding text.`;

      return { prompt, selectedText, fullContent: windowedText, from, to };
    },
    [editor],
  );

  const handleAction = useCallback(
    (action: EditAction, feedback?: string) => {
      const { prompt, selectedText, fullContent, from, to } = buildPrompt(action, feedback);
      setRetryKey((k) => k + 1);
      setEditCtx({ action, prompt, selectedText, fullContent, from, to, feedback });
      setMode('buttons');
      setTweakFeedback('');
      // Lock editor immediately — don't wait for the React render cycle
      editor.setEditable(false);
      setAiEdit('editor', {
        editId: 'editor',
        action,
        startedAt: new Date().toISOString(),
        minimized: false,
        selectionFrom: from,
      });
    },
    [buildPrompt, setAiEdit, editor],
  );

  // FIX #4: Try Again no longer uses setTimeout. It just bumps retryKey,
  // which the EditModal's useEffect depends on, causing a fresh streaming run.
  const handleTryAgain = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const handleTweakKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAction('tweak', tweakFeedback);
    }
    if (e.key === 'Escape') {
      setMode('buttons');
      setTweakFeedback('');
    }
  };

  return (
    <>
      {!isStreaming && !editCtx && (
      <BubbleMenu
        editor={editor}
        options={{
          placement: 'top',
          offset: 8,
        }}
        shouldShow={({ editor: ed, from, to }) => {
          if (from === to) return false;
          if (ed.isEmpty) return false;
          // Don't show bubble menu while AI edit is active
          const activeEdits = useAppStore.getState().activeAiEdits;
          if (activeEdits.has('editor')) return false;
          return true;
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1.5 shadow-xl"
        >
          <AnimatePresence mode="wait">
            {mode === 'buttons' ? (
              <motion.div
                key="buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1"
              >
                <button
                  onClick={() => handleAction('rewrite')}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                  title={t('editor.selectionToolbar.rewriteTitle', { ns: 'app' })}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t('editor.selectionToolbar.rewrite', { ns: 'app' })}
                </button>

                <span className="w-px h-4 bg-gray-600" />

                <button
                  onClick={() => setMode('tweak-input')}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                  title={t('editor.selectionToolbar.tweakTitle', { ns: 'app' })}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  {t('editor.selectionToolbar.tweak', { ns: 'app' })}
                </button>

                <span className="w-px h-4 bg-gray-600" />

                <button
                  onClick={() => handleAction('remove')}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
                  title={t('editor.selectionToolbar.removeTitle', { ns: 'app' })}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('editor.selectionToolbar.remove', { ns: 'app' })}
                </button>
              </motion.div>
            ) : (
              <AiTweakInput
                key="tweak-input"
                value={tweakFeedback}
                onChange={setTweakFeedback}
                onKeyDown={handleTweakKeyDown}
                onSend={() => handleAction('tweak', tweakFeedback)}
                onCancel={() => {
                  setMode('buttons');
                  setTweakFeedback('');
                }}
                inputRef={tweakInputRef}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </BubbleMenu>
      )}

      {/* AI Edit Side Panel (non-blocking) */}
      <AnimatePresence>
        {editCtx && (
          <AiEditSidePanel
            key={retryKey}
            editCtx={editCtx}
            editor={editor}
            sessionId={activeSessionId}
            onClose={() => {
              clearAiEdit('editor');
              setEditCtx(null);
            }}
            onTryAgain={handleTryAgain}
            retryKey={retryKey}
            effort={effort}
          />
        )}
      </AnimatePresence>
    </>
  );
}
