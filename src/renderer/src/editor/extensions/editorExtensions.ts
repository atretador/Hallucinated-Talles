import { Extension, Node } from '@tiptap/core';

/* ── FontSize Extension ── */
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] as string[] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) =>
              el.style.fontSize?.replace(/['"]+/g, '') || null,
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: any }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: any }) =>
          chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

/* ── PageBreak Node ── */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML() {
    return [{ tag: 'hr.page-break' }, { tag: 'hr[data-page-break]' }];
  },
  renderHTML() {
    return ['hr', { class: 'page-break', 'data-page-break': 'true' }];
  },
  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ chain }: { chain: any }) =>
          chain().insertContent({ type: 'pageBreak' }).run(),
    } as any;
  },
});
