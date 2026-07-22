/**
 * FontManager — client-side font loading via FontFace API.
 */

const WEIGHT_MAP: Record<string, number> = {
  thin: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

export class FontManager {
  private loaded = new Map<string, { family: string; weight: number; style: string }>();

  static variantKey(weight: number, style: string): string {
    return `${weight}-${style}`;
  }

  static detectVariantFromFilename(filename: string): { weight: number; style: string } {
    const base = filename.replace(/\.(ttf|otf|woff|woff2)$/i, '');
    const lower = base.toLowerCase();

    let style = 'normal';
    if (/\b(italic|oblique)\b/i.test(lower)) {
      style = 'italic';
    }

    let weight = 400;
    for (const [name, value] of Object.entries(WEIGHT_MAP)) {
      if (lower.includes(name)) {
        weight = value;
        break;
      }
    }

    return { weight, style };
  }

  async loadFont(
    family: string,
    buffer: ArrayBuffer,
    opts: { weight?: number; style?: string } = {},
  ): Promise<boolean> {
    try {
      const weight = opts.weight ?? 400;
      const style = opts.style ?? 'normal';
      const key = `${family}-${FontManager.variantKey(weight, style)}`;

      if (this.loaded.has(key)) return true;

      const fontFace = new FontFace(family, buffer, {
        weight: String(weight),
        style,
      });
      await fontFace.load();
      document.fonts.add(fontFace);
      this.loaded.set(key, { family, weight, style });
      return true;
    } catch {
      return false;
    }
  }

  removeFont(family: string, key: string): void {
    const fullKey = `${family}-${key}`;
    const entry = this.loaded.get(fullKey);
    if (!entry) return;

    for (const face of document.fonts) {
      if (
        face.family === entry.family &&
        face.weight === String(entry.weight) &&
        face.style === entry.style
      ) {
        document.fonts.delete(face);
        break;
      }
    }
    this.loaded.delete(fullKey);
  }

  getLoadedFamilies(): string[] {
    const families = new Set<string>();
    for (const entry of this.loaded.values()) {
      families.add(entry.family);
    }
    return [...families];
  }

  async loadPersistedFonts(): Promise<number> {
    try {
      const stored = await (window as any).electron?.getImportedFonts?.();
      if (!stored || !Array.isArray(stored) || stored.length === 0) return 0;

      let loaded = 0;
      for (const entry of stored) {
        try {
          const buffer = await (window as any).electron?.readFontFile?.(entry.storedPath);
          if (!buffer) continue;
          const ok = await this.loadFont(entry.family, buffer, {
            weight: entry.weight,
            style: entry.style,
          });
          if (ok) loaded++;
        } catch {
          // Skip individual font errors
        }
      }
      return loaded;
    } catch {
      return 0;
    }
  }
}

export const fontManager = new FontManager();
