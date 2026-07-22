import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { fontManager } from '../../fonts/FontManager';

/* ── Font picker dropdown ──────────────────────────────────── */

interface FontPickerDropdownProps {
  editor: Editor | null;
  currentFontFamily: string | null;
  onClose: () => void;
}

interface RenderItem {
  kind: 'header' | 'item';
  label: string;
  family?: string;
  selectableIndex?: number;
}

const BUILT_IN_FONTS: { label: string; value: string }[] = [
  { label: "Sans (Inter)", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Sans (Roboto)", value: "Roboto, ui-sans-serif, sans-serif" },
  { label: "Sans (Source Sans)", value: "'Source Sans 3', ui-sans-serif, sans-serif" },
  { label: "Serif (Georgia)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Serif (Merriweather)", value: "Merriweather, Georgia, serif" },
  { label: "Serif (Lora)", value: "Lora, Georgia, serif" },
  { label: "Serif (Playfair)", value: "'Playfair Display', Georgia, serif" },
  { label: "Mono (Roboto Mono)", value: "'Roboto Mono', ui-monospace, monospace" },
];

export function FontPickerDropdown({ editor, currentFontFamily, onClose }: FontPickerDropdownProps) {
  const [search, setSearch] = useState('');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch system fonts once (cached in state)
  useEffect(() => {
    window.electron?.getSystemFonts().then((fonts) => {
      setSystemFonts([...fonts].sort((a, b) => a.localeCompare(b)));
    }).catch(() => {
      // silently ignore — system fonts unavailable
    });
  }, []);

  const importedFonts = fontManager.getLoadedFamilies();

  // Filter by search term
  const lowerSearch = search.toLowerCase();
  const filteredBuiltIn = BUILT_IN_FONTS.filter((f) => f.label.toLowerCase().includes(lowerSearch));
  const filteredImported = importedFonts.filter((f) => f.toLowerCase().includes(lowerSearch));
  const filteredSystem = systemFonts.filter((f) => f.toLowerCase().includes(lowerSearch));

  const showBuiltInSection = filteredBuiltIn.length > 0;
  const showImportedSection = filteredImported.length > 0;
  const showSystemSection = filteredSystem.length > 0;

  // Build flat list for rendering + keyboard navigation
  const renderItems: RenderItem[] = useMemo(() => {
    const items: RenderItem[] = [];
    let selIdx = 0;

    // Default option
    items.push({ kind: 'item', label: 'Default', family: '', selectableIndex: selIdx++ });

    // Built-in fonts section
    if (showBuiltInSection) {
      items.push({ kind: 'header', label: 'Built-in' });
      for (const f of filteredBuiltIn) {
        items.push({ kind: 'item', label: f.label, family: f.value, selectableIndex: selIdx++ });
      }
    }

    // Imported fonts section
    if (showImportedSection) {
      items.push({ kind: 'header', label: 'Imported' });
      for (const f of filteredImported) {
        items.push({ kind: 'item', label: f, family: f, selectableIndex: selIdx++ });
      }
    }

    // System fonts section
    if (showSystemSection) {
      items.push({ kind: 'header', label: 'System' });
      for (const f of filteredSystem) {
        items.push({ kind: 'item', label: f, family: f, selectableIndex: selIdx++ });
      }
    }

    return items;
  }, [showBuiltInSection, filteredBuiltIn, showImportedSection, filteredImported, showSystemSection, filteredSystem]);

  const selectableCount = useMemo(
    () => renderItems.filter((i) => i.kind === 'item').length,
    [renderItems],
  );

  // Reset active index when search changes
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  // Focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[data-selectable-index="' + activeIndex + '"]') as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (family: string) => {
      if (!editor) return;
      if (family === '') {
        editor.chain().focus().unsetFontFamily().run();
      } else {
        editor.chain().focus().setFontFamily(family).run();
      }
      onClose();
    },
    [editor, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, selectableCount - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = renderItems.find((i) => i.selectableIndex === activeIndex);
        if (item && item.family !== undefined) {
          handleSelect(item.family);
        }
      }
    },
    [activeIndex, selectableCount, renderItems, handleSelect],
  );

  return (
    <div
      className="w-[220px] rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Search input */}
      <div className="p-1.5 border-b border-border">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fonts..."
          className="w-full bg-background text-foreground text-xs rounded px-2 py-1.5 border border-border outline-none focus:border-ring placeholder:text-muted-foreground"
        />
      </div>

      {/* Font list */}
      <div ref={listRef} className="max-h-[260px] overflow-y-auto">
        {renderItems.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">No fonts found</div>
        ) : (
          renderItems.map((item, i) => {
            if (item.kind === 'header') {
              return (
                <div
                  key={`hdr-${item.label}-${i}`}
                  className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium"
                >
                  {item.label}
                </div>
              );
            }

            const isActive = item.selectableIndex === activeIndex;
            const isCurrent = item.family !== undefined && item.family === (currentFontFamily ?? '');

            return (
              <button
                key={item.family ?? 'default'}
                type="button"
                data-selectable-index={item.selectableIndex}
                className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors relative ${
                  isActive ? 'bg-accent' : 'hover:bg-accent'
                } ${isCurrent ? 'text-foreground' : 'text-foreground'}`}
                onClick={() => {
                  if (item.family !== undefined) handleSelect(item.family);
                }}
                onMouseEnter={() => {
                  if (item.selectableIndex !== undefined) setActiveIndex(item.selectableIndex);
                }}
              >
                {item.family === '' || !item.family ? (
                  <span className="text-muted-foreground truncate text-[15px] pr-5">Default</span>
                ) : (
                  <span className="truncate text-[15px] pr-5" style={{ fontFamily: item.family }}>{item.label}</span>
                )}
                {item.family === '' || !item.family ? (
                  <span className="truncate text-[11px] text-muted-foreground">Aa Bb Cc 123</span>
                ) : (
                  <span className="truncate text-[11px] text-muted-foreground" style={{ fontFamily: item.family }}>Aa Bb Cc 123</span>
                )}
                {isCurrent && (
                  <svg className="w-3 h-3 text-primary absolute top-2 right-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
