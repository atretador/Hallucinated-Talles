import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { AiEffort } from '../../../../shared/types';

export interface EditorAiSettingsProps {
  activeProviderId: string | null;
  providers: Array<{ id: string; name: string; models: string[] }>;
  models: string[];
  activeModel: string | null;
  effort: AiEffort;
  effortOptions: { efforts: string[]; default: string };
  effortDisabled: boolean;
  onProviderChange: (providerId: string) => void;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: AiEffort) => void;
}

/** Abbreviate provider/model for the trigger label (e.g. "Claude/Opus"). */
function abbreviateLabel(
  providers: EditorAiSettingsProps['providers'],
  activeProviderId: string | null,
  activeModel: string | null,
): string {
  if (!activeProviderId) return 'AI';
  const provider = providers.find((p) => p.id === activeProviderId);
  if (!provider) return 'AI';
  const providerShort = provider.name.length > 6 ? provider.name.slice(0, 5) + '…' : provider.name;
  if (!activeModel) return providerShort;
  // Use last segment of model id (e.g. "claude-opus-4-20250514" → "Opus")
  const modelParts = activeModel.split('/');
  const rawModel = modelParts[modelParts.length - 1];
  const modelShort = rawModel.length > 8 ? rawModel.slice(0, 7) + '…' : rawModel;
  return `${providerShort}/${modelShort}`;
}

export function EditorAiSettings({
  activeProviderId,
  providers,
  models,
  activeModel,
  effort,
  effortOptions,
  effortDisabled,
  onProviderChange,
  onModelChange,
  onEffortChange,
}: EditorAiSettingsProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();

  // Close on click outside
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    },
    [open],
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [handleMouseDown]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const label = abbreviateLabel(providers, activeProviderId, activeModel);

  return (
    <div className="relative flex items-center">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className={`rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] transition-colors cursor-pointer ${
          open
            ? 'bg-gray-600 text-gray-100'
            : activeProviderId
              ? 'text-gray-200 hover:bg-gray-600'
              : 'text-gray-500 hover:bg-gray-600 hover:text-gray-300'
        }`}
        title={t('editor.aiSettings.title', { ns: 'app' })}
      >
        {label}
      </button>

      {/* Floating panel */}
      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed left-0 z-50 w-52 rounded-lg border border-gray-600 bg-gray-800 p-2 shadow-xl"
          style={{
            top: (triggerRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: triggerRef.current?.getBoundingClientRect().left ?? 0,
          }}
        >
            {/* Panel header */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                {t('editor.aiSettings.title', { ns: 'app' })}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Provider select */}
            <div className="mb-2">
              <label className="mb-1 block text-[10px] text-gray-400">{t('editor.aiSettings.provider', { ns: 'app' })}</label>
              <select
                value={activeProviderId ?? ''}
                onChange={(e) => onProviderChange(e.target.value)}
                className="rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{t('editor.aiSettings.provider', { ns: 'app' })}</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Model select */}
            <div className="mb-2">
              <label className="mb-1 block text-[10px] text-gray-400">{t('editor.aiSettings.model', { ns: 'app' })}</label>
              <select
                value={activeModel ?? ''}
                onChange={(e) => onModelChange(e.target.value)}
                disabled={!activeProviderId || models.length === 0}
                className="rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
              >
                {models.length === 0 ? (
                  <option value="">{t('editor.aiSettings.model', { ns: 'app' })}</option>
                ) : (
                  models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Effort select */}
            <div>
              <label className="mb-1 block text-[10px] text-gray-400">{t('editor.aiSettings.effort', { ns: 'app' })}</label>
              {effortDisabled ? (
                <div className="rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] text-gray-500 w-full">
                  {t('editor.aiSettings.alwaysOn', { ns: 'app' })}
                </div>
              ) : (
                <select
                  value={effort}
                  onChange={(e) => onEffortChange(e.target.value as AiEffort)}
                  className="rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {effortOptions.efforts.map((e) => (
                    <option key={e} value={e}>
                      {e.charAt(0).toUpperCase() + e.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </div>
        </div>,
        document.body
      )}
    </div>
  );
}
