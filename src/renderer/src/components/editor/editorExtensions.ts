import { Extension, Node } from '@tiptap/core';

/* ── Custom FontSize extension (pairs with TextStyle) ── */
export const FontSizeExtension = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize?.replace(/['"]+/g, '') || null,
            renderHTML: (attrs) => {
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
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

/* ── Augment Tiptap's Commands type for insertPageBreak ── */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}

/* ── Page Break node ── */
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
