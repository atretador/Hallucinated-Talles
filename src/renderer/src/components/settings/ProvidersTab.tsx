import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { aiApi } from '../../api/client';
import type { AiProvider } from '../../../../shared/types';
import { notifySettingsChanged } from './utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';

// ── Helpers ──────────────────────────────────────────────────────────────────

interface EditableProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeyDisplay: string;
  models: string[];
  contextLengths?: Record<string, number>;
}

function maskKey(key: string): string {
  if (!key || key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

function toEditable(p: AiProvider, realApiKey?: string): EditableProvider {
  return {
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    apiKey: realApiKey ?? p.apiKey,
    apiKeyDisplay: maskKey(p.apiKey),
    models: [...p.models],
    contextLengths: p.contextLengths,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProvidersTab() {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();
  const [providers, setProviders] = useState<EditableProvider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState('');
  const [activeModel, setActiveModel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  const [formName, setFormName] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formModelsText, setFormModelsText] = useState('');
  const [formContextLengths, setFormContextLengths] = useState<Record<string, number>>({});
  const [discovering, setDiscovering] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [firstChunkTimeoutSec, setFirstChunkTimeoutSec] = useState(300);
  const [timeoutSaving, setTimeoutSaving] = useState(false);

  const fetchAiStatus = useCallback(async () => {
    try {
      const res = await aiApi.getStatus();
      if (res.success) {
        setProviders(res.settings.providers.map(p => toEditable(p)));
        setActiveProviderId(res.settings.activeProviderId);
        // Normalize activeModel: if it doesn't belong to the active provider, default to first model
        const activeProv = res.settings.providers.find(p => p.id === res.settings.activeProviderId);
        const modelValid = activeProv && res.settings.activeModel && activeProv.models.includes(res.settings.activeModel);
        setActiveModel(modelValid ? res.settings.activeModel : (activeProv?.models[0] ?? ''));
        setFirstChunkTimeoutSec(res.settings.firstChunkTimeoutSec ?? 300);
      }
    } catch {
      /* ignore */
      console.debug('[ProvidersTab] Fetch AI status failed, ignoring');
    }
  }, []);

  useEffect(() => { fetchAiStatus(); }, [fetchAiStatus]);

  const startEdit = (p: EditableProvider) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormBaseUrl(p.baseUrl);
    setFormApiKey('');
    setFormModelsText(p.models.join(', '));
    setFormContextLengths(p.contextLengths || {});
  };

  const startAdd = () => {
    setEditingId('__new__');
    setFormName('');
    setFormBaseUrl('');
    setFormApiKey('');
    setFormModelsText('');
    setFormContextLengths({});
  };

  const cancelForm = () => setEditingId(null);

  const handleDiscoverModels = async () => {
      if (!formBaseUrl) { setAiMessage(t('settings.providers.enterBaseUrlFirst')); return; }
    setDiscovering(true); setAiMessage('');
    try {
      const res = await aiApi.discoverModels(formBaseUrl, formApiKey || undefined);
      if (res.success && res.models && res.models.length > 0) {
        setFormModelsText(res.models.join(', '));
        setFormContextLengths(res.contextLengths || {});
        setAiMessage(t('settings.providers.foundModels', { count: res.models.length }));
      } else {
        setAiMessage(res.error || t('settings.providers.noModelsFound'));
      }
    } catch (err) {
      setAiMessage(t('settings.providers.discoveryFailed', { error: err instanceof Error ? err.message : String(err) }));
    } finally { setDiscovering(false); }
  };

  const handleSaveForm = async () => {
    const models = formModelsText.split(',').map(s => s.trim()).filter(Boolean);
    if (!formName || !formBaseUrl || models.length === 0) {
      setAiMessage(t('settings.providers.nameBaseUrlModelsRequired')); return;
    }
    setAiSaving(true); setAiMessage('');
    try {
      if (editingId === '__new__') {
        const provider: AiProvider = {
          id: `provider-${Date.now()}`, name: formName, baseUrl: formBaseUrl, apiKey: formApiKey, models,
          contextLengths: Object.keys(formContextLengths).length > 0 ? formContextLengths : undefined,
        };
        await aiApi.addProvider(provider);
      } else if (editingId) {
        const updates: Partial<AiProvider> = { name: formName, baseUrl: formBaseUrl, models };
        if (formApiKey) updates.apiKey = formApiKey;
        if (Object.keys(formContextLengths).length > 0) updates.contextLengths = formContextLengths;
        await aiApi.updateProvider(editingId, updates);
      }
      cancelForm();
      await fetchAiStatus();
      setAiMessage(t('settings.providers.providerSaved'));
      notifySettingsChanged();
    } catch (err) { setAiMessage(String(err)); }
    finally { setAiSaving(false); }
  };

  const handleDeleteProvider = async (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDeleteProvider = async () => {
    if (!deleteTargetId) return;
    try { await aiApi.deleteProvider(deleteTargetId); await fetchAiStatus(); notifySettingsChanged(); }
    catch (err) { setAiMessage(String(err)); }
    finally { setDeleteTargetId(null); }
  };

  const handleSetActive = async () => {
    if (!activeProviderId || !activeModel) return;
    setAiSaving(true); setAiMessage('');
    try {
      await aiApi.setActive(activeProviderId, activeModel);
      setAiMessage(t('settings.providers.activeUpdated'));
      await fetchAiStatus();
      notifySettingsChanged();
    } catch (err) { setAiMessage(String(err)); }
    finally { setAiSaving(false); }
  };

  const handleSaveTimeout = async () => {
    setTimeoutSaving(true); setAiMessage('');
    try {
      await aiApi.setTimeout(firstChunkTimeoutSec);
      setAiMessage(t('settings.providers.timeoutUpdated'));
      notifySettingsChanged();
    } catch (err) { setAiMessage(String(err)); }
    finally { setTimeoutSaving(false); }
  };

  const activeProv = providers.find(p => p.id === activeProviderId);
  const availableModels = activeProv?.models ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">{t('settings.providers.title')}</h3>
        <motion.button
          onClick={startAdd}
          disabled={editingId !== null}
          className="focus-ring rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50"
          whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        >
          {t('settings.providers.addProvider')}
        </motion.button>
      </div>

      {providers.length === 0 && !editingId && (
        <p className="text-xs text-gray-500">{t('settings.providers.noProviders')}</p>
      )}

      {editingId && (
        <div className="mb-3 rounded border border-blue-600 bg-gray-700 p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-200">
            {editingId === '__new__' ? t('settings.providers.newProvider') : t('settings.providers.editProvider')}
          </h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400">{t('labels.name', { ns: 'common' })}</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">{t('settings.providers.baseUrl')}</label>
              <input type="text" value={formBaseUrl} onChange={(e) => setFormBaseUrl(e.target.value)}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">
                {t('settings.providers.apiKey')} {editingId !== '__new__' && <span className="text-gray-500">{t('settings.providers.apiKeyHint')}</span>}
              </label>
              <input type="password" value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)}
                placeholder={editingId !== '__new__' ? t('settings.providers.apiKeyPlaceholder') : ''}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">
                {t('settings.providers.models')} <span className="text-gray-500">{t('settings.providers.modelsHint')}</span>
              </label>
              <div className="flex gap-2">
                <input type="text" value={formModelsText} onChange={(e) => setFormModelsText(e.target.value)}
                  placeholder={t('settings.providers.modelsPlaceholder')}
                  className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
                <motion.button type="button" onClick={handleDiscoverModels}
                  disabled={discovering || !formBaseUrl}
                  className="focus-ring shrink-0 rounded bg-gray-600 px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-500 disabled:opacity-50"
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  title={t('buttons.discoverModels', { ns: 'common' })}>
                  {discovering ? t('settings.providers.discovering') : t('buttons.fetch', { ns: 'common' })}
                </motion.button>
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <motion.button onClick={handleSaveForm} disabled={aiSaving}
              className="focus-ring rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}>
              {aiSaving ? t('buttons.saving', { ns: 'common' }) : t('buttons.save', { ns: 'common' })}
            </motion.button>
            <motion.button onClick={cancelForm}
              className="focus-ring rounded bg-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-500"
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}>
              {t('buttons.cancel', { ns: 'common' })}
            </motion.button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {providers.map((p) => (
          <div key={p.id}
            className={`rounded border px-3 py-2 ${p.id === activeProviderId ? 'border-green-600 bg-gray-700' : 'border-gray-600 bg-gray-800'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-100">{p.name}</span>
                  {p.id === activeProviderId && (
                    <span className="rounded bg-green-800 px-1.5 py-0.5 text-[10px] text-green-300">{t('status.active', { ns: 'common' })}</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-gray-400">
                  {p.baseUrl} &middot; {t('settings.providers.providerCount', { count: p.models.length })}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">{t('settings.providers.apiKeyDisplay', { key: p.apiKeyDisplay })}</div>
              </div>
              <div className="ml-2 flex gap-1">
                <button onClick={() => startEdit(p)} disabled={editingId !== null}
                  className="focus-ring rounded bg-gray-600 px-2 py-0.5 text-xs text-gray-200 hover:bg-gray-500 disabled:opacity-30">
                  {t('buttons.edit', { ns: 'common' })}
                </button>
                <button onClick={() => handleDeleteProvider(p.id)} disabled={editingId !== null}
                  className="focus-ring rounded bg-red-800 px-2 py-0.5 text-xs text-red-200 hover:bg-red-700 disabled:opacity-30">
                  {t('buttons.del', { ns: 'common' })}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded bg-gray-700 p-3">
        <h4 className="mb-2 text-xs font-semibold text-gray-300">{t('settings.providers.activeProviderSection')}</h4>
        <div className="flex gap-2">
          <div className="flex-1">
            <select value={activeProviderId}
              onChange={(e) => {
                setActiveProviderId(e.target.value);
                const prov = providers.find(p => p.id === e.target.value);
                if (prov && prov.models.length > 0) setActiveModel(prov.models[0]);
              }}
              className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100">
              <option value="">{t('settings.providers.selectProvider')}</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)}
              disabled={availableModels.length === 0}
              className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 disabled:opacity-50">
              {availableModels.length === 0
                ? <option value="">{t('validation.selectModel', { ns: 'common' })}</option>
                : availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <motion.button onClick={handleSetActive}
            disabled={aiSaving || !activeProviderId || !activeModel}
            className="focus-ring rounded bg-green-700 px-3 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50"
            whileTap={prefersReduced ? undefined : { scale: 0.97 }}>
            {aiSaving ? '...' : t('buttons.apply', { ns: 'common' })}
          </motion.button>
        </div>
      </div>

      <div className="mt-4 rounded bg-gray-700 p-3">
        <h4 className="mb-2 text-xs font-semibold text-gray-300">{t('settings.providers.responseTimeout')}</h4>
        <p className="mb-2 text-[11px] text-gray-500">
          {t('settings.providers.timeoutDescription')}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={3600}
            value={firstChunkTimeoutSec}
            onChange={(e) => setFirstChunkTimeoutSec(Math.max(5, Math.min(3600, Number(e.target.value) || 5)))}
            className="focus-ring w-24 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100"
          />
          <span className="text-xs text-gray-400">{t('settings.providers.seconds')}</span>
          <motion.button onClick={handleSaveTimeout}
            disabled={timeoutSaving}
            className="focus-ring rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
            whileTap={prefersReduced ? undefined : { scale: 0.97 }}>
            {timeoutSaving ? '...' : t('buttons.save', { ns: 'common' })}
          </motion.button>
        </div>
      </div>

      {aiMessage && <div className="mt-2 text-xs text-gray-300">{aiMessage}</div>}

      <ConfirmDialog
        open={deleteTargetId !== null}
        message={t('settings.providers.deleteConfirm')}
        confirmLabel={t('buttons.delete', { ns: 'common' })}
        onConfirm={handleConfirmDeleteProvider}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
