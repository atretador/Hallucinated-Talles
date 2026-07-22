import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fontManager, FontManager } from '../../fonts/FontManager';
import type { ImportedFont } from '../../../../shared/types';

/**
 * Infer a human‑readable font family name from a filename.
 * e.g. "Roboto-Bold.ttf" → "Roboto", "SourceSansPro-Italic.otf" → "SourceSansPro"
 */
function inferFamilyFromFilename(filename: string): string {
  const base = filename.replace(/\.(ttf|otf|woff|woff2)$/i, '');
  // Strip known weight / style suffixes: -Bold, -Italic, -SemiBold, -ExtraLight, …
  const weightPat = /-(?:Thin|ExtraLight|UltraLight|Light|Regular|Normal|Medium|SemiBold|Demi|Bold|ExtraBold|UltraBold|Black|Heavy|Italic|Oblique)(?:Italic|Oblique)?$/i;
  const match = base.match(weightPat);
  if (match?.index !== undefined) {
    return base.slice(0, match.index);
  }
  return base;
}

export function FontsTab() {
  const { t } = useTranslation('app');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [importedFonts, setImportedFonts] = useState<ImportedFont[]>([]);
  const [search, setSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  /* ── Load persisted imported fonts from settings store ── */
  useEffect(() => {
    window.electron?.getImportedFonts?.().then((stored) => {
      if (stored && stored.length > 0) {
        setImportedFonts(stored);
      }
    }).catch(() => {});
  }, []);

  /* ── Fetch system fonts ── */
  useEffect(() => {
    window.electron?.getSystemFonts?.().then(setSystemFonts).catch(() => {});
  }, []);

  /* ── Persist helper ── */
  const persist = useCallback((fonts: ImportedFont[]) => {
    window.electron?.saveImportedFonts?.(fonts);
    setImportedFonts(fonts);
  }, []);

  /* ── Show a temporary status message ── */
  const flash = useCallback(
    (msg: string) => {
      setStatusMsg(msg);
      const id = setTimeout(() => setStatusMsg(null), 3000);
      return () => clearTimeout(id);
    },
    [],
  );

  /* ── Import one or more font files ── */
  const handleImport = useCallback(async () => {
    const result = await window.electron?.openFontDialog?.();
    if (!result || result.canceled || !result.filePaths?.length) return;

    setImporting(true);
    const filePaths = result.filePaths;
    const newEntries: ImportedFont[] = [];
    let errors = 0;

    for (const filePath of filePaths) {
      try {
        const filename = filePath.replace(/^.*[/\\]/, '');
        const buffer = await window.electron?.readFontFile?.(filePath);
        if (!buffer) {
          errors++;
          continue;
        }

        const detected = FontManager.detectVariantFromFilename(filename);
        const family = inferFamilyFromFilename(filename);

        const ok = await fontManager.loadFont(family, buffer, {
          weight: detected.weight,
          style: detected.style,
        });
        if (!ok) {
          errors++;
          continue;
        }

        // Copy font file to app storage
        const storageResult = await window.electron?.importFontToStorage?.(filePath, filename);
        const storedPath = storageResult?.storedPath ?? filePath;

        newEntries.push({
          family,
          filename,
          filePath,
          storedPath,
          weight: detected.weight,
          style: detected.style,
          importedAt: new Date().toISOString(),
        });
      } catch {
        errors++;
      }
    }

    if (newEntries.length > 0) {
      // Deduplicate: merge new entries with existing, replacing duplicates by family+weight+style key
      const existing = new Map(
        importedFonts.map((f) => [`${f.family}-${f.weight}-${f.style}`, f])
      );
      for (const entry of newEntries) {
        existing.set(`${entry.family}-${entry.weight}-${entry.style}`, entry);
      }
      persist([...existing.values()]);
    }

    setImporting(false);

    if (errors === 0 && newEntries.length > 0) {
      flash(t('settings.fonts.imported', '{{count}} font imported', { count: newEntries.length }));
    } else if (errors > 0 && newEntries.length === 0) {
      flash(t('settings.fonts.importFailed', 'Failed to import fonts'));
    } else if (errors > 0) {
      flash(t('settings.fonts.importPartial', 'Imported {{ok}} font(s), {{err}} failed', { ok: newEntries.length, err: errors }));
    }
  }, [importedFonts, persist, flash, t]);

  /* ── Remove an imported font ── */
  const handleRemove = useCallback(
    (entry: ImportedFont) => {
      const key = FontManager.variantKey(entry.weight, entry.style);
      fontManager.removeFont(entry.family, key);
      window.electron?.removeFromStorage?.(entry.storedPath);
      persist(importedFonts.filter((f) => f.family !== entry.family || f.filePath !== entry.filePath));
    },
    [importedFonts, persist],
  );

  /* ── Filter by search ── */
  const filtered = importedFonts.filter(
    (f) =>
      !search ||
      f.family.toLowerCase().includes(search.toLowerCase()) ||
      f.filename.toLowerCase().includes(search.toLowerCase()),
  );

  /* ── Sample text for preview ── */
  const SAMPLE = 'The quick brown fox jumps over the lazy dog.';

  return (
    <div className="space-y-4">
      {/* Status */}
      {statusMsg && (
        <div className="rounded bg-blue-900/40 px-3 py-2 text-xs text-blue-300">{statusMsg}</div>
      )}

      {/* Import bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('settings.fonts.searchPlaceholder', 'Search fonts…')}
          className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500"
        />
        <button
          onClick={handleImport}
          disabled={importing}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {importing
            ? t('settings.fonts.importing', 'Importing…')
            : t('settings.fonts.import', 'Import Font')}
        </button>
      </div>

      {/* Imported fonts */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {t('settings.fonts.importedHeading', 'Imported Fonts')} ({importedFonts.length})
        </h3>
        {filtered.length === 0 ? (
          <p className="text-xs italic text-gray-500">
            {search
              ? t('settings.fonts.noMatch', 'No matching fonts')
              : t('settings.fonts.noImported', 'No imported fonts yet')}
          </p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filtered.map((f) => (
              <div
                key={`${f.family}-${f.filePath}`}
                className="flex items-center gap-3 rounded border border-gray-700 bg-gray-800/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  {/* Family + weight */}
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                    <span className="truncate" style={{ fontFamily: `'${f.family}', serif` }}>
                      {f.family}
                    </span>
                    <span className="text-[10px] text-gray-500">w{f.weight}</span>
                    {f.style !== 'normal' && (
                      <span className="text-[10px] italic text-gray-500">{f.style}</span>
                    )}
                  </div>
                  {/* Filename */}
                  <div className="truncate text-[10px] text-gray-500">{f.filename}</div>
                  {/* Sample preview */}
                  <div
                    className="truncate text-[11px] text-gray-400"
                    style={{ fontFamily: `'${f.family}', serif` }}
                  >
                    {SAMPLE}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(f)}
                  className="shrink-0 rounded px-1.5 py-1 text-xs text-gray-400 transition-colors hover:text-red-400 hover:bg-red-900/30"
                >
                  {t('settings.fonts.remove', 'Remove')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System fonts */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {t('settings.fonts.systemFonts', 'System Fonts')} ({systemFonts.length})
        </h3>
        {systemFonts.length === 0 ? (
          <p className="text-xs italic text-gray-500">{t('settings.fonts.loading', 'Loading…')}</p>
        ) : (
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {systemFonts.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700/50"
              >
                <span className="truncate" style={{ fontFamily: `'${name}', serif` }}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
