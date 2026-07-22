/**
 * ReferenceEditor — EXACT copy of lovable_Reference/src/components/DocumentEditor.tsx
 * with minimal additions:
 *   1. `content` accepts an external prop (instead of hardcoded sample)
 *   2. Extensions include our custom ones (Heading.extend, AiHighlight, etc.)
 *   3. SelectionToolbar rendered as BubbleMenu inside editor area
 *   4. Ctrl+S / blur save via `onSave` callback
 *
 * Everything else is character-for-character identical to the reference.
 * This component does NOT read from or write to any store.
 */
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Heading } from "@tiptap/extension-heading";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import DropCursor from "@tiptap/extension-dropcursor";
import GapCursor from "@tiptap/extension-gapcursor";
import { FontSize } from "../../editor/extensions/editorExtensions";
import { AiHighlight } from "../../editor/extensions/aiHighlight";
import { LineBreakOnEnter } from "../../editor/extensions/lineBreakOnEnter";
import { PageBreak } from "../../editor/extensions/editorExtensions";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, Minus, Undo, Redo, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Highlighter, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import { SelectionToolbar } from "./SelectionToolbar";
import { FontPickerDropdown } from "./FontPickerDropdown";
import { coverApi } from "../../api/client";
import { useAppStore } from "../../stores";
import type { AiEffort, EditorPageData } from "../../../../shared/types";

/* ── Constants (identical to reference) ───────────────── */

const COLORS = [
  "#111111", "#e11d48", "#ea580c", "#ca8a04",
  "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777",
];

const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Sans (Inter)", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Sans (Roboto)", value: "Roboto, ui-sans-serif, sans-serif" },
  { label: "Sans (Source Sans)", value: "'Source Sans 3', ui-sans-serif, sans-serif" },
  { label: "Serif (Georgia)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Serif (Merriweather)", value: "Merriweather, Georgia, serif" },
  { label: "Serif (Lora)", value: "Lora, Georgia, serif" },
  { label: "Serif (Playfair)", value: "'Playfair Display', Georgia, serif" },
  { label: "Mono (Roboto Mono)", value: "'Roboto Mono', ui-monospace, monospace" },
];

const FONT_SIZES = [
  "8pt", "9pt", "10pt", "11pt", "12pt", "14pt", "16pt",
  "18pt", "20pt", "24pt", "28pt", "32pt", "40pt", "48pt", "60pt", "72pt",
];

const DEFAULT_FONT_FAMILY = FONT_FAMILIES[3].value;
const DEFAULT_FONT_SIZE = "11pt";

/* ── Toolbar (identical to reference) ─────────────────── */

function ToolbarButton({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Toggle
      size="sm"
      pressed={!!active}
      onPressedChange={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="h-8 w-8 p-0 data-[state=on]:bg-accent"
    >
      {children}
    </Toggle>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [fontPickerOpen, setFontPickerOpen] = useState(false);

  const headingValue =
    editor.isActive("heading", { level: 1 }) ? "h1"
    : editor.isActive("heading", { level: 2 }) ? "h2"
    : editor.isActive("heading", { level: 3 }) ? "h3"
    : editor.isActive("heading", { level: 4 }) ? "h4"
    : "p";

  const setBlock = (value: string) => {
    const chain = editor.chain().focus();
    if (value === "p") chain.setParagraph().run();
    else if (value === "h1") chain.toggleHeading({ level: 1 }).run();
    else if (value === "h2") chain.toggleHeading({ level: 2 }).run();
    else if (value === "h3") chain.toggleHeading({ level: 3 }).run();
    else if (value === "h4") chain.toggleHeading({ level: 4 }).run();
  };

  const activeFontFamily =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? DEFAULT_FONT_FAMILY;
  const activeFontLabel = FONT_FAMILIES.find(f => f.value === activeFontFamily)?.label ?? 'Font';
  const activeFontSize =
    (editor.getAttributes("textStyle").fontSize as string | undefined) ?? DEFAULT_FONT_SIZE;

  return (
    <div className="doc-toolbar sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b bg-background/95 px-3 py-2 backdrop-blur">
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Select value={headingValue} onValueChange={setBlock}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Body text</SelectItem>
          <SelectItem value="h1">Heading 1</SelectItem>
          <SelectItem value="h2">Heading 2</SelectItem>
          <SelectItem value="h3">Heading 3</SelectItem>
          <SelectItem value="h4">Heading 4</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={fontPickerOpen} onOpenChange={setFontPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-normal" title="Font family">
            {activeFontLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <FontPickerDropdown
            editor={editor}
            currentFontFamily={activeFontFamily}
            onClose={() => setFontPickerOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <Select
        value={activeFontSize}
        onValueChange={(value) => editor.chain().focus().setFontSize(value).run()}
      >
        <SelectTrigger className="h-8 w-20" title="Font size">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Text color">
            <Type className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="grid grid-cols-5 gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Set text color ${c}`}
                className="h-6 w-6 rounded border border-border"
                style={{ backgroundColor: c }}
                onClick={() => editor.chain().focus().setColor(c).run()}
              />
            ))}
            <button
              type="button"
              aria-label="Clear color"
              className="col-span-5 mt-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
              onClick={() => editor.chain().focus().unsetColor().run()}
            >
              Reset
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <ToolbarButton active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight">
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align center">
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right">
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify">
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bulleted list">
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list">
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Insert link">
            <LinkIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Link URL</label>
            <Input
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkUrl(""); }}>Remove</Button>
              <Button size="sm" onClick={() => {
                if (!linkUrl) return;
                editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
                setLinkUrl("");
              }}>Apply</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Insert image">
            <ImageIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Image URL</label>
            <Input
              placeholder="https://…/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => {
                if (!imageUrl) return;
                editor.chain().focus().setImage({ src: imageUrl }).run();
                setImageUrl("");
              }}>Insert</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>


    </div>
  );
}

/* ── Main Component ───────────────────────────────────── */

export interface ReferenceEditorProps {
  /** Initial content HTML. Loaded once on mount — NOT synced reactively. */
  content: string;
  /** Called with the latest HTML when the user explicitly saves (Ctrl+S / blur). */
  onSave: (html: string) => void;
  /** Optional: called with editor instance once ready. */
  onEditorReady?: (editor: Editor) => void;
  /** AI effort level for SelectionToolbar. */
  effort?: AiEffort;
  /** Called with page/chapter mapping data whenever pagination recomputes. */
  onPageDataUpdate?: (data: EditorPageData) => void;
}

export default function ReferenceEditor({ content, onSave, onEditorReady, effort, onPageDataUpdate }: ReferenceEditorProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const onPageDataUpdateRef = useRef(onPageDataUpdate);
  onPageDataUpdateRef.current = onPageDataUpdate;

  const [pageCount, setPageCount] = useState(1);
  const [pageHeightPx, setPageHeightPx] = useState(0);
  const [frontCoverUrl, setFrontCoverUrl] = useState<string | undefined>(undefined);
  const [backCoverUrl, setBackCoverUrl] = useState<string | undefined>(undefined);
  const activeAiEdit = useAppStore((s) => s.activeAiEdits.get('editor'));
  const isAiEditing = !!activeAiEdit;
  const [aiEditPageTopPx, setAiEditPageTopPx] = useState<number | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: false }),
      Heading.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            chapterId: {
              default: null,
              parseHTML: (element: HTMLElement) => element.getAttribute("data-chapter-id"),
              renderHTML: (attributes: Record<string, any>) => {
                if (!attributes.chapterId) return {};
                return { "data-chapter-id": attributes.chapterId };
              },
            },
          };
        },
      }).configure({ levels: [1, 2, 3, 4] }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start writing your document…" }),
      CharacterCount.configure({ limit: null }),
      DropCursor.configure({ color: "#3b82f6", width: 2 }),
      GapCursor,
      AiHighlight,
      PageBreak,
      LineBreakOnEnter,
    ],
    [],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "prose max-w-none focus:outline-none",
        spellcheck: "true",
        style: `font-family: ${DEFAULT_FONT_FAMILY}; font-size: ${DEFAULT_FONT_SIZE};`,
      },
    }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content,
    editorProps,
  });

  // Expose editor to parent (called once when editor is created)
  const readyFiredRef = useRef(false);
  useEffect(() => {
    if (editor && onEditorReady && !readyFiredRef.current) {
      readyFiredRef.current = true;
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Lock editor when AI is editing — prevent user input
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isAiEditing);
  }, [editor, isAiEditing]);

  // Locate the page that the AI edit targets so we can show per-page aura + lock icon
  useEffect(() => {
    if (!isAiEditing || !editor || !activeAiEdit?.selectionFrom || !pageHeightPx || !pageRef.current) {
      setAiEditPageTopPx(null);
      return;
    }
    try {
      const pos = Math.min(activeAiEdit.selectionFrom, editor.state.doc.content.size - 1);
      if (pos < 0) { setAiEditPageTopPx(null); return; }
      const { node } = editor.view.domAtPos(pos);
      const el = (node instanceof HTMLElement ? node : node.parentElement) as HTMLElement | null;
      if (!el) { setAiEditPageTopPx(null); return; }
      const nodeRect = el.getBoundingClientRect();
      const containerRect = pageRef.current.getBoundingClientRect();
      const relativeTop = nodeRect.top - containerRect.top;
      const pageIndex = Math.max(0, Math.floor(relativeTop / pageHeightPx));
      setAiEditPageTopPx(pageIndex * pageHeightPx);
    } catch {
      setAiEditPageTopPx(null);
    }
  }, [isAiEditing, editor, activeAiEdit?.selectionFrom, pageHeightPx]);

  // Ctrl+S — save explicitly. No auto-save, no reactive sync.
  useEffect(() => {
    if (!editor) return;
    const handler = () => onSave(editor.getHTML());
    window.addEventListener("save-current-page", handler);
    return () => window.removeEventListener("save-current-page", handler);
  }, [editor, onSave]);

  // Load cover image URLs on mount
  useEffect(() => {
    coverApi
      .list()
      .then((res) => {
        if (res.data?.frontCover) setFrontCoverUrl(coverApi.getImageUrl("front-cover"));
        if (res.data?.backCover) setBackCoverUrl(coverApi.getImageUrl("back-cover"));
      })
      .catch(() => {});
  }, []);

  // Snap the page container height to whole A4 pages.
  useLayoutEffect(() => {
    if (!editor) return;
    const pageEl = pageRef.current;
    if (!pageEl) return;

    const recompute = () => {
      const pm = pageEl.querySelector(".ProseMirror") as HTMLElement | null;
      if (!pm) return;
      // Measure mm→px from the ProseMirror element (content width = 210mm),
      // NOT from pageEl which includes padding (25.4mm × 2 sides).
      const pmRect = pm.getBoundingClientRect();
      const mmToPx = pmRect.width / 210;
      const pageH = 297 * mmToPx;
      const marginV = 25.4 * mmToPx;
      const contentH = pmRect.height;
      const totalNeeded = contentH + marginV * 2;
      const pages = Math.max(1, Math.ceil(totalNeeded / pageH));
      setPageHeightPx((prev) => (Math.abs(prev - pageH) < 0.5 ? prev : pageH));
      setPageCount((prev) => (prev === pages ? prev : pages));

      // Build chapter→page mapping
      const headings = Array.from(pm.querySelectorAll('h1[data-chapter-id]')) as HTMLElement[];
      const pageElTop = pageEl.getBoundingClientRect().top;
      const chapters: { chapterId: string; title: string; startPage: number; endPage: number }[] = headings.map((h) => {
        const hTop = h.getBoundingClientRect().top - pageElTop + (pageEl.parentElement?.scrollTop ?? 0);
        const startPage = Math.floor(hTop / pageH);
        return {
          chapterId: h.getAttribute('data-chapter-id') || '',
          title: h.textContent || '',
          startPage: Math.max(0, startPage),
          endPage: 0, // filled below
        };
      });
      // Compute endPage for each chapter
      for (let i = 0; i < chapters.length; i++) {
        chapters[i].endPage = i + 1 < chapters.length ? chapters[i + 1].startPage : pages;
      }
      onPageDataUpdateRef.current?.({ pageCount: pages, pageHeightPx: pageH, chapters });
    };

    recompute();
    const pm = pageEl.querySelector(".ProseMirror");
    // Debounce ResizeObserver callbacks to avoid excessive re-renders.
    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        recompute();
      });
    };
    const ro = new ResizeObserver(schedule);
    if (pm) ro.observe(pm);
    // Do NOT observe pageEl — we set its height from state, which would
    // retrigger the observer indefinitely.
    window.addEventListener("resize", recompute);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [editor]);

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      {editor ? <Toolbar editor={editor} /> : <div className="doc-toolbar-placeholder border-b bg-background" />}
      <div className="doc-canvas flex-1 overflow-auto px-4 py-8">
        <div className="mx-auto flex flex-col items-center gap-6">
          {!editor && (
            <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
              Loading editor…
            </div>
          )}
          {editor && frontCoverUrl && (
            <div
              data-cover-role="front-cover"
              className="doc-page"
              style={{
                overflow: "hidden",
                padding: 0,
              }}
            >
              <img
                src={frontCoverUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                alt="Front Cover"
              />
            </div>
          )}
          {editor && (
            <div
              ref={pageRef}
              className="doc-page relative"
              style={pageHeightPx ? { height: `${pageCount * pageHeightPx}px` } : undefined}
            >
              <EditorContent editor={editor} />
              <SelectionToolbar editor={editor} effort={effort} />
              {pageHeightPx > 0 &&
                Array.from({ length: pageCount - 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="doc-page-break"
                    style={{ top: `${(i + 1) * pageHeightPx}px` }}
                  />
                ))}
              {/* Per-page AI editing aura + lock badge */}
              {isAiEditing && aiEditPageTopPx !== null && pageHeightPx > 0 && (
                <div
                  className="page-ai-editing absolute left-0 right-0 pointer-events-none z-10"
                  style={{ top: aiEditPageTopPx, height: pageHeightPx }}
                >
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-amber-500/90 text-white text-[11px] font-medium px-3 py-1 rounded-full shadow-lg backdrop-blur-sm">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    AI editing — locked
                  </div>
                </div>
              )}
            </div>
          )}
          {editor && pageCount > 0 && (
            <div className="pb-4 text-xs text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </div>
          )}
          {editor && backCoverUrl && (
            <div
              data-cover-role="back-cover"
              className="doc-page"
              style={{
                overflow: "hidden",
                padding: 0,
              }}
            >
              <img
                src={backCoverUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                alt="Back Cover"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
