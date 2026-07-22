import { Extension } from "@tiptap/core";

/**
 * LineBreakOnEnter — makes Enter insert a `<br>` (hard break) within
 * paragraphs and headings instead of splitting into a new block.
 *
 * This gives a "line-by-line" editing feel: pressing Enter shifts the
 * text below the cursor down by one line, not by a full paragraph block.
 *
 * Context-aware: only overrides Enter inside paragraphs and headings.
 * In lists, blockquotes, code blocks, etc., the default Enter behavior
 * (splitting/creating new items) is preserved.
 */
export const LineBreakOnEnter = Extension.create({
  name: "lineBreakOnEnter",

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        const nodeType = $from.parent.type.name;

        // Only override for paragraphs and headings — these are the
        // "plain text" blocks where line-by-line feel is desired.
        if (nodeType !== "paragraph" && nodeType !== "heading") {
          return false; // fall through to default behavior (lists, etc.)
        }

        // Use the built-in setHardBreak command — it handles mark
        // preservation, exit-code fallback, and edge cases correctly.
        return editor.commands.setHardBreak();
      },
    };
  },
});
