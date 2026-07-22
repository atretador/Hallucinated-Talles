/**
 * DocumentEditor — renders ReferenceEditor directly into the page.
 * This component is the thinnest possible wrapper: it handles data
 * loading/saving and event wiring, but adds ZERO DOM wrappers.
 *
 * The reference editor must render into the page with the same nesting
 * depth as the reference app — no extra parent divs, no transforms,
 * no wrappers of any kind.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { useAppStore } from "../../stores";
import ReferenceEditor from "./ReferenceEditor";
import { useEditorAiConfig } from "../../hooks/useEditorAiConfig";
import type { Editor } from "@tiptap/react";
import type { EditorPageData } from "../../../../shared/types";

export function DocumentEditor() {
  const { book, updateBookContent, activeContent } = useAppStore();
  const editorRef = useRef<Editor | null>(null);
  const editorAiConfig = useEditorAiConfig();

  // Content to pass to ReferenceEditor — set once per book, NOT reactive
  const [editorContent, setEditorContent] = useState(book?.content || "<p></p>");
  const lastBookIdRef = useRef(book?.id);
  const lastContentRef = useRef(book?.content || "<p></p>");

  // When book ID changes, reload content (full remount)
  // When content changes externally (e.g. from fetchBook after AI edit), update editor directly
  useEffect(() => {
    if (book?.id !== lastBookIdRef.current) {
      // Book switched — full reload
      lastBookIdRef.current = book?.id;
      lastContentRef.current = book?.content || "<p></p>";
      setEditorContent(book?.content || "<p></p>");
    } else if (book?.content && book.content !== lastContentRef.current) {
      // Same book, content changed externally (AI edit saved to disk, fetchBook refreshed store)
      lastContentRef.current = book.content;
      if (editorRef.current) {
        editorRef.current.commands.setContent(book.content);
      }
    }
  }, [book?.id, book?.content]);

  // Save handler — called by ReferenceEditor on Ctrl+S
  const handleSave = useCallback(async (html: string) => {
    try {
      await updateBookContent(html);
    } catch {
      console.warn("[DocumentEditor] Save failed");
    }
  }, [updateBookContent]);

  // Page data update — called by ReferenceEditor when pagination recomputes
  const handlePageDataUpdate = useCallback((data: EditorPageData) => {
    useAppStore.getState().setEditorPageData(data);
  }, []);

  // AI edit accept — when AI edit is accepted, update editor + save
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (editorRef.current && detail?.content) {
        editorRef.current.commands.setContent(detail.content);
        handleSave(detail.content);
      }
    };
    window.addEventListener("document-content-updated", handler);
    return () => window.removeEventListener("document-content-updated", handler);
  }, [handleSave]);

  // Chapter insert/delete — dispatched by ChapterTree
  useEffect(() => {
    const handleInsert = (e: Event) => {
      const { chapterId, title } = (e as CustomEvent).detail;
      editorRef.current?.chain().focus().insertContent(`<h1 data-chapter-id="${chapterId}">${title}</h1>`).run();
    };
    const handleDelete = (e: Event) => {
      const { chapterId } = (e as CustomEvent).detail;
      editorRef.current?.commands.command(({ state, dispatch }) => {
        let found = false;
        state.doc.descendants((node, pos) => {
          if (node.type.name === "heading" && node.attrs.chapterId === chapterId) {
            const tr = state.tr.delete(pos, pos + node.nodeSize);
            if (dispatch) dispatch(tr);
            found = true;
            return false;
          }
        });
        return found;
      });
    };
    window.addEventListener("insert-chapter-heading", handleInsert);
    window.addEventListener("delete-chapter-heading", handleDelete);
    return () => {
      window.removeEventListener("insert-chapter-heading", handleInsert);
      window.removeEventListener("delete-chapter-heading", handleDelete);
    };
  }, []);

  // Scroll to chapter
  useEffect(() => {
    if (!editorRef.current || !activeContent || activeContent.kind !== "chapter") return;
    const el = editorRef.current.view.dom.querySelector(`[data-chapter-id="${activeContent.chapterId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeContent]);

  // Scroll to page position
  useEffect(() => {
    if (!editorRef.current || !activeContent || activeContent.kind !== "page") return;
    const pageIndex = parseInt(activeContent.pageId, 10);
    if (isNaN(pageIndex)) return;
    const { editorPageData } = useAppStore.getState();
    if (!editorPageData || !editorPageData.pageHeightPx) return;
    // Find the scroll container (.doc-canvas)
    const scrollEl = editorRef.current.view.dom.closest('.doc-canvas') as HTMLElement | null;
    if (scrollEl) {
      scrollEl.scrollTo({ top: pageIndex * editorPageData.pageHeightPx, behavior: 'smooth' });
    }
  }, [activeContent]);

  // Settings sync — DOM mutation only, no editor commands
  useEffect(() => {
    if (!editorRef.current || !book?.settings) return;
    const dom = editorRef.current.view.dom;
    if (book.settings.fontFamily) dom.style.fontFamily = `'${book.settings.fontFamily}', Georgia, 'Times New Roman', serif`;
    if (book.settings.fontSize) dom.style.fontSize = `${book.settings.fontSize}pt`;
    if (book.settings.lineSpacing) dom.style.lineHeight = String(book.settings.lineSpacing);
  }, [book?.settings]);

  // Render ReferenceEditor DIRECTLY — no wrapper divs, no transforms, no extra toolbars.
  // This matches the reference app's rendering pattern exactly.
  return (
    <ReferenceEditor
      content={editorContent}
      onSave={handleSave}
      onEditorReady={(editor) => { editorRef.current = editor; }}
      effort={editorAiConfig.effort}
      onPageDataUpdate={handlePageDataUpdate}
    />
  );
}
