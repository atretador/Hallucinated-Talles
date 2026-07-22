import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { aiApi, type AiStatusResponse } from '../../api/client';

export function AiSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await aiApi.getStatus();
      if (res.success) {
        setStatus(res);
        setSelectedProviderId(res.activeProvider?.id ?? '');
        setSelectedModel(res.activeModel);
      }
    } catch {
      // ignore
      console.debug('[AiSettings] Fetch status failed, ignoring');
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchStatus();
    }
  }, [open, fetchStatus]);

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

  const activeProvider = status?.settings.providers.find(
    p => p.id === status.activeProvider?.id,
  );
  const models = activeProvider?.models ?? [];

  const handleSetActive = async () => {
    if (!selectedProviderId || !selectedModel) return;
    setSaving(true);
    setMessage('');
    try {
      await aiApi.setActive(selectedProviderId, selectedModel);
      setMessage(t('chat.aiSettings.activeChanged', { ns: 'app' }));
      await fetchStatus();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = !!activeProvider;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className="focus-ring rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        title={t('chat.aiSettings.title', { ns: 'app' })}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {isConfigured && (
          <span className="ml-1 text-xs text-green-400">
            {activeProvider?.name}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 w-80 rounded-lg border border-gray-600 bg-gray-800 p-4 shadow-xl"
          style={{
            top: (triggerRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: (triggerRef.current?.getBoundingClientRect().right ?? 0) - 320,
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">{t('chat.aiSettings.title', { ns: 'app' })}</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current Status */}
          <div className="mb-3 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300">
            {activeProvider ? (
              <>
                <span className="text-green-400">{t('chat.aiSettings.active', { ns: 'app' })}</span>{' '}
                {activeProvider.name} / {status?.activeModel}
              </>
            ) : (
              <span className="text-yellow-400">{t('chat.aiSettings.noActiveProvider', { ns: 'app' })}</span>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400">{t('chat.aiSettings.provider', { ns: 'app' })}</label>
              <select
                value={selectedProviderId}
                onChange={(e) => {
                  setSelectedProviderId(e.target.value);
                  // Auto-select first model of the new provider
                  const prov = status?.settings.providers.find(p => p.id === e.target.value);
                  if (prov && prov.models.length > 0) {
                    setSelectedModel(prov.models[0]);
                  }
                }}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-100"
              >
                <option value="">{t('chat.aiSettings.selectProvider', { ns: 'app' })}</option>
                {status?.settings.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400">{t('chat.aiSettings.model', { ns: 'app' })}</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!selectedProviderId || models.length === 0}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-100 disabled:opacity-50"
              >
                {models.length === 0 ? (
                  <option value="">{t('chat.aiSettings.noModels', { ns: 'app' })}</option>
                ) : (
                  models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {message && (
            <div className="mt-2 text-xs text-gray-300">{message}</div>
          )}

          <button
            onClick={handleSetActive}
            disabled={saving || !selectedProviderId || !selectedModel}
            className="focus-ring mt-3 w-full rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? t('buttons.saving', { ns: 'common' }) : t('chat.aiSettings.setActive', { ns: 'app' })}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
