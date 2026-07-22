import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { aiApi, api } from '../../api/client';
import type { AiProvider, CompactionSettings } from '../../../../shared/types';
import { notifySettingsChanged } from './utils';

// ── Defaults ──────────────────────────────────────────────────────────────

const DEFAULTS: CompactionSettings = {
  enabled: false,
  thresholdPercent: 70,
  strategy: 'summarize',
  keepRecent: 4,
  useCustomModel: false,
  compactorProviderId: '',
  compactorModel: '',
};

const STRATEGY_OPTIONS: Array<{ value: CompactionSettings['strategy']; labelKey: string }> = [
  { value: 'summarize', labelKey: 'settings.compaction.strategy.summarize' },
  { value: 'truncate', labelKey: 'settings.compaction.strategy.truncate' },
  { value: 'sliding-window', labelKey: 'settings.compaction.strategy.slidingWindow' },
];

// ── Component ─────────────────────────────────────────────────────────────

export function CompactionTab() {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();

  const [settings, setSettings] = useState<CompactionSettings>(DEFAULTS);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear message after 3 seconds
  const flashMessage = useCallback((msg: string) => {
    setMessage(msg);
    clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = setTimeout(() => setMessage(''), 3000);
  }, []);

  // Fetch providers for custom model dropdown
  const fetchProviders = useCallback(async () => {
    try {
      const res = await aiApi.getStatus();
      if (res.success) {
        setProviders(res.settings.providers);
      }
    } catch {
      console.debug('[CompactionTab] Fetch providers failed, ignoring');
    }
  }, []);

  // Fetch current compaction settings
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: CompactionSettings }>(
        '/settings/compaction',
      );
      if (res.success && res.data) {
        setSettings({ ...DEFAULTS, ...res.data });
      }
    } catch {
      console.debug('[CompactionTab] Fetch compaction settings failed, using defaults');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchProviders();
    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(messageTimeoutRef.current);
    };
  }, [fetchSettings, fetchProviders]);

  // Save settings to backend
  const saveSettings = useCallback(async (updated: CompactionSettings) => {
    setSaving(true);
    setMessage('');
    try {
      const json = await api.put<{ success: boolean; data?: CompactionSettings; error?: string }>(
        '/settings/compaction',
        updated,
      );
      if (json.success) {
        if (json.data) setSettings(json.data);
        flashMessage(t('settings.compaction.saved'));
        notifySettingsChanged();
      } else {
        flashMessage(json.error || t('settings.compaction.saveError'));
      }
    } catch (err) {
      flashMessage(
        err instanceof Error
          ? t('settings.compaction.saveError') + ': ' + err.message
          : t('settings.compaction.saveError'),
      );
    } finally {
      setSaving(false);
    }
  }, [t, flashMessage]);

  // Debounced save for slider/number inputs
  const debouncedSave = useCallback((updated: CompactionSettings) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => saveSettings(updated), 500);
  }, [saveSettings]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const updateField = <K extends keyof CompactionSettings>(
    key: K,
    value: CompactionSettings[K],
  ) => {
    const updated = { ...settings, [key]: value };
    // Reset compactor fields when custom model is turned off
    if (key === 'useCustomModel' && !value) {
      updated.compactorProviderId = '';
      updated.compactorModel = '';
    }
    setSettings(updated);
    saveSettings(updated);
  };

  const updateFieldDebounced = <K extends keyof CompactionSettings>(
    key: K,
    value: CompactionSettings[K],
  ) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    debouncedSave(updated);
  };

  // Derived state
  const selectedProvider = providers.find((p) => p.id === settings.compactorProviderId);
  const availableModels = selectedProvider?.models ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="text-xs text-gray-500">{t('settings.compaction.loading', 'Loading...')}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded bg-gray-700 p-3">
        <div>
          <h4 className="text-sm font-medium text-gray-200">
            {t('settings.compaction.enableCompaction', 'Enable Compaction')}
          </h4>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {t('settings.compaction.enableDescription', 'Automatically compress long conversations to stay within model context limits.')}
          </p>
        </div>
        <motion.button
          onClick={() => updateField('enabled', !settings.enabled)}
          disabled={saving}
          className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            settings.enabled ? 'bg-green-600' : 'bg-gray-600'
          } disabled:opacity-50`}
          whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </motion.button>
      </div>

      {/* Options (shown when enabled) */}
      {settings.enabled && (
        <div className="space-y-3">
          {/* Threshold slider */}
          <div className="rounded bg-gray-700 p-3">
            <label className="block text-xs text-gray-400">
              {t('settings.compaction.threshold', 'Context usage threshold')}
              <span className="ml-2 font-mono text-gray-200">{settings.thresholdPercent}%</span>
            </label>
            <p className="mb-2 text-[11px] text-gray-500">
              {t('settings.compaction.thresholdDescription', 'Compaction triggers when context usage reaches this percentage.')}
            </p>
            <input
              type="range"
              min={50}
              max={90}
              step={5}
              value={settings.thresholdPercent}
              onChange={(e) => updateFieldDebounced('thresholdPercent', Number(e.target.value))}
              disabled={saving}
              className="w-full accent-blue-500 disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>50%</span>
              <span>90%</span>
            </div>
          </div>

          {/* Strategy dropdown */}
          <div className="rounded bg-gray-700 p-3">
            <label className="block text-xs text-gray-400">
              {t('settings.compaction.strategy', 'Compaction strategy')}
            </label>
            <p className="mb-2 text-[11px] text-gray-500">
              {t('settings.compaction.strategyDescription', 'How to compress the conversation history.')}
            </p>
            <select
              value={settings.strategy}
              onChange={(e) => updateField('strategy', e.target.value as CompactionSettings['strategy'])}
              disabled={saving}
              className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 disabled:opacity-50"
            >
              {STRATEGY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Keep Recent */}
          <div className="rounded bg-gray-700 p-3">
            <label className="block text-xs text-gray-400">
              {t('settings.compaction.keepRecent', 'Messages to keep')}
            </label>
            <p className="mb-2 text-[11px] text-gray-500">
              {t('settings.compaction.keepRecentDescription', 'Recent messages that are always preserved during compaction.')}
            </p>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={settings.keepRecent}
              onChange={(e) => updateFieldDebounced('keepRecent', Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              disabled={saving}
              className="focus-ring w-24 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 disabled:opacity-50"
            />
          </div>

          {/* Use Custom Model toggle */}
          <div className="flex items-center justify-between rounded bg-gray-700 p-3">
            <div>
              <h4 className="text-sm font-medium text-gray-200">
                {t('settings.compaction.useCustomModel', 'Use custom model for compaction')}
              </h4>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {t('settings.compaction.useCustomModelDescription', 'Use a dedicated model instead of the chat model for summarization.')}
              </p>
            </div>
            <motion.button
              onClick={() => updateField('useCustomModel', !settings.useCustomModel)}
              disabled={saving}
              className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                settings.useCustomModel ? 'bg-green-600' : 'bg-gray-600'
              } disabled:opacity-50`}
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  settings.useCustomModel ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </motion.button>
          </div>

          {/* Custom model provider + model selectors */}
          {settings.useCustomModel && (
            <div className="rounded bg-gray-700 p-3">
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-400">
                    {t('settings.compaction.compactorProvider', 'Provider')}
                  </label>
                  <select
                    value={settings.compactorProviderId}
                    onChange={(e) => {
                      const updated: CompactionSettings = {
                        ...settings,
                        compactorProviderId: e.target.value,
                        compactorModel: '',
                      };
                      setSettings(updated);
                      saveSettings(updated);
                    }}
                    disabled={saving}
                    className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 disabled:opacity-50"
                  >
                    <option value="">{t('settings.compaction.selectProvider', 'Select provider...')}</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400">
                    {t('settings.compaction.compactorModel', 'Model')}
                  </label>
                  <select
                    value={settings.compactorModel}
                    onChange={(e) => updateField('compactorModel', e.target.value)}
                    disabled={availableModels.length === 0 || saving}
                    className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 disabled:opacity-50"
                  >
                    {availableModels.length === 0
                      ? <option value="">{t('validation.selectModel', { ns: 'common' })}</option>
                      : availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status message */}
      {(message || saving) && (
        <div className="text-xs text-gray-300">
          {saving ? '...' : message}
        </div>
      )}
    </div>
  );
}
