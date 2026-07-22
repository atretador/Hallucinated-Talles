import { useTranslation } from 'react-i18next';

/* ── Zoom control ───────────────────────────────────── */
export function ZoomControl({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
}: {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={onZoomOut}
        title={t('editor.zoom.zoomOut', { ns: 'app' })}
        className="rounded px-1 py-0.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onReset}
        title={t('editor.zoom.reset', { ns: 'app' })}
        className="rounded px-2 py-0.5 text-[11px] tabular-nums text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors min-w-[3.5ch] text-center"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        title={t('editor.zoom.zoomIn', { ns: 'app' })}
        className="rounded px-1 py-0.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
