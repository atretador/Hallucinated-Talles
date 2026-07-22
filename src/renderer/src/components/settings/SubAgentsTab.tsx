import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { aiApi, subAgentApi, skillsApi, effortConfigApi } from '../../api/client';
import type { AiStatusResponse } from '../../api/client';
import type { WritingSkill, SubAgent, SubAgentModelConfig, EffortConfig } from '../../../../shared/types';
import { getEffortsForModel } from '../../../../shared/effortUtils';
import { notifySettingsChanged } from './utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

interface SubAgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
  skillIds: string[];
  defaultModel: SubAgentModelConfig;
  fallbackModels: SubAgentModelConfig[];
  maxStreams: number;
}

const EMPTY_FORM: SubAgentFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  skillIds: [],
  defaultModel: { providerId: '', model: '', effort: 'medium' },
  fallbackModels: [],
  maxStreams: 0,
};

// ── Component ────────────────────────────────────────────────────────────────

export function SubAgentsTab() {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [editing, setEditing] = useState<SubAgent | null>(null);
  const [form, setForm] = useState<SubAgentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);
  const [skills, setSkills] = useState<WritingSkill[]>([]);
  const [effortConfig, setEffortConfig] = useState<EffortConfig | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [agentsRes, aiRes, skillsRes, effortRes] = await Promise.all([
        subAgentApi.list(),
        aiApi.getStatus(),
        skillsApi.list(),
        effortConfigApi.get(),
      ]);
      if (agentsRes.success) setSubAgents(agentsRes.data ?? []);
      if (aiRes.success) setAiStatus(aiRes);
      if (skillsRes.success) setSkills(skillsRes.data ?? []);
      if (effortRes.success && effortRes.data) setEffortConfig(effortRes.data);
    } catch {
      // ignore
      console.debug('[SubAgentsTab] Load data failed, ignoring');
    }
  };

  const providers = aiStatus?.settings.providers ?? [];

  const getModelsForProvider = (providerId: string): string[] =>
    providers.find(p => p.id === providerId)?.models ?? [];

  const [openRouterCache, setOpenRouterCache] = useState<Map<string, { efforts: string[]; default: string }>>(new Map());

  useEffect(() => {
    const activeProvider = providers.find(p => p.id === aiStatus?.settings.activeProviderId);
    if (!activeProvider?.baseUrl?.includes('openrouter.ai')) return;

    let cancelled = false;
    const models = activeProvider.models ?? [];
    if (models.length === 0) return;

    const fetchAll = async () => {
      const entries = await Promise.all(
        models.map(async (m) => {
          try {
            const res = await effortConfigApi.resolve(m, activeProvider.baseUrl, activeProvider.apiKey);
            if (res.success && res.data) return [m, { efforts: res.data.efforts, default: res.data.default }] as const;
          } catch {
            /* fallback below */
            console.debug('[SubAgentsTab] OpenRouter resolve failed, falling back to config');
          }
          if (effortConfig) {
            const resolved = getEffortsForModel(effortConfig, m);
            return [m, { efforts: resolved.efforts as string[], default: resolved.default }] as const;
          }
          return [m, { efforts: ['low', 'medium', 'high'] as string[], default: 'medium' }] as const;
        })
      );
      if (!cancelled) {
        setOpenRouterCache(new Map(entries));
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [aiStatus?.settings.activeProviderId, effortConfig]);

  const getEffortOptionsForModel = (modelName: string): { efforts: string[]; default: string; disabled: boolean } => {
    const cached = openRouterCache.get(modelName);
    if (cached) {
      return { ...cached, disabled: cached.efforts.length === 0 };
    }
    if (!effortConfig || !modelName) {
      return { efforts: ['low', 'medium', 'high'], default: 'medium', disabled: false };
    }
    const resolved = getEffortsForModel(effortConfig, modelName);
    return { ...resolved, disabled: resolved.efforts.length === 0 };
  };

  const handleNew = () => {
    setEditing(null);
    setIsCreating(true);
    setForm({
      ...EMPTY_FORM,
      defaultModel: {
        providerId: providers[0]?.id ?? '',
        model: providers[0]?.models[0] ?? '',
        effort: 'medium',
      },
    });
    setError('');
  };

  const handleEdit = (agent: SubAgent) => {
    setEditing(agent);
    setIsCreating(false);
    setForm({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      skillIds: [...agent.skillIds],
      defaultModel: { ...agent.defaultModel },
      fallbackModels: agent.fallbackModels.map(m => ({ ...m })),
      maxStreams: agent.maxStreams ?? 0,
    });
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('settings.subAgents.deleteConfirm'))) return;
    try {
      await subAgentApi.delete(id);
      setSubAgents(prev => prev.filter(a => a.id !== id));
      if (editing?.id === id) {
        setEditing(null);
        setForm(EMPTY_FORM);
      }
      notifySettingsChanged();
    } catch {
      setError(t('settings.subAgents.failedToDelete'));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('settings.subAgents.nameRequired')); return; }
    if (!form.systemPrompt.trim()) { setError(t('settings.subAgents.systemPromptRequired')); return; }
    if (!form.defaultModel.providerId || !form.defaultModel.model) {
      setError(t('settings.subAgents.defaultModelRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editing) {
        const res = await subAgentApi.update(editing.id, form);
        if (res.success && res.data) {
          setSubAgents(prev => prev.map(a => a.id === editing.id ? res.data! : a));
          setEditing(res.data);
          notifySettingsChanged();
        }
      } else {
        const res = await subAgentApi.create(form);
        if (res.success && res.data) {
          setSubAgents(prev => [...prev, res.data!]);
          handleEdit(res.data);
          notifySettingsChanged();
        }
      }
    } catch {
      setError(t('settings.subAgents.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const addFallback = () => {
    setForm(prev => ({
      ...prev,
      fallbackModels: [...prev.fallbackModels, { providerId: '', model: '', effort: 'medium' }],
    }));
  };

  const removeFallback = (index: number) => {
    setForm(prev => ({
      ...prev,
      fallbackModels: prev.fallbackModels.filter((_, i) => i !== index),
    }));
  };

  const updateFallback = (index: number, field: keyof SubAgentModelConfig, value: string) => {
    setForm(prev => {
      const updated = [...prev.fallbackModels];
      const fb = { ...updated[index], [field]: value };
      if (field === 'providerId') {
        const models = getModelsForProvider(value);
        fb.model = models[0] ?? '';
      }
      updated[index] = fb;
      return { ...prev, fallbackModels: updated };
    });
  };

  const updateDefaultModel = (field: keyof SubAgentModelConfig, value: string) => {
    setForm(prev => {
      const dm = { ...prev.defaultModel, [field]: value };
      if (field === 'providerId') {
        const models = getModelsForProvider(value);
        dm.model = models[0] ?? '';
      }
      return { ...prev, defaultModel: dm };
    });
  };

  const toggleSkill = (skillId: string) => {
    setForm(prev => ({
      ...prev,
      skillIds: prev.skillIds.includes(skillId)
        ? prev.skillIds.filter(id => id !== skillId)
        : [...prev.skillIds, skillId],
    }));
  };

  return (
    <div>
      {/* ── List View ──────────────────────────────────────────────────────── */}
      {!(editing || isCreating) && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">{t('settings.subAgents.title')}</h3>
            <motion.button
              onClick={handleNew}
              className="focus-ring rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600"
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}
            >
              {t('settings.subAgents.newSubAgent')}
            </motion.button>
          </div>

          {subAgents.length === 0 && (
            <p className="text-xs text-gray-500">{t('settings.subAgents.noAgents')}</p>
          )}

          <div className="space-y-2">
            {subAgents.map(agent => (
              <div
                key={agent.id}
                className="rounded border border-gray-600 bg-gray-800 px-3 py-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-100 truncate">{agent.name}</div>
                    {agent.description && (
                      <div className="mt-0.5 text-xs text-gray-400 truncate">{agent.description}</div>
                    )}
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {t('settings.subAgents.modelInfo', { provider: agent.defaultModel.providerId, model: agent.defaultModel.model })}
                      {(agent.maxStreams ?? 0) > 0 && <span className="ml-2 text-gray-600">{t('settings.subAgents.maxStreamsInfo', { count: agent.maxStreams })}</span>}
                    </div>
                    {agent.skillIds.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {agent.skillIds.map(sid => {
                          const skill = skills.find(s => s.id === sid);
                          return skill ? (
                            <span key={sid} className="rounded bg-purple-600/20 px-1.5 py-0.5 text-[9px] text-purple-300 border border-purple-500/20">
                              {skill.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="ml-2 flex gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(agent)}
                      className="focus-ring rounded bg-gray-600 px-2 py-0.5 text-xs text-gray-200 hover:bg-gray-500"
                    >
                      {t('buttons.edit', { ns: 'common' })}
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="focus-ring rounded bg-red-800 px-2 py-0.5 text-xs text-red-200 hover:bg-red-700"
                    >
                      {t('buttons.del', { ns: 'common' })}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Editor View ────────────────────────────────────────────────────── */}
      {(editing || isCreating) && (
        <>
          {/* Top bar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => { setEditing(null); setIsCreating(false); setForm(EMPTY_FORM); setError(''); }}
                className="focus-ring shrink-0 rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-sm font-semibold text-gray-300 truncate">
                {isCreating ? t('settings.subAgents.newSubAgentForm') : editing?.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                onClick={() => { setEditing(null); setIsCreating(false); setForm(EMPTY_FORM); setError(''); }}
                className="focus-ring rounded bg-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-500"
                whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              >
                {t('buttons.cancel', { ns: 'common' })}
              </motion.button>
              <motion.button
                onClick={handleSave}
                disabled={saving}
                className="focus-ring rounded bg-green-700 px-3 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50"
                whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              >
                {saving ? t('buttons.saving', { ns: 'common' }) : editing ? t('buttons.save', { ns: 'common' }) : t('buttons.create', { ns: 'common' })}
              </motion.button>
              {editing && (
                <motion.button
                  onClick={() => handleDelete(editing.id)}
                  className="focus-ring rounded bg-red-800 px-3 py-1 text-xs text-red-200 hover:bg-red-700"
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                >
                  {t('buttons.delete', { ns: 'common' })}
                </motion.button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-3 rounded bg-red-900/30 px-3 py-2 text-xs text-red-400">{error}</div>
          )}

          {/* Form fields — full width */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('labels.name', { ns: 'common' })}</label>
              <input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('settings.subAgents.namePlaceholder')}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {t('labels.description', { ns: 'common' })} <span className="text-gray-500">{t('settings.subAgents.descriptionHint', { count: form.description.length })}</span>
              </label>
              <input
                value={form.description}
                onChange={(e) => {
                  if (e.target.value.length <= 100) {
                    setForm(prev => ({ ...prev, description: e.target.value }));
                  }
                }}
                placeholder={t('settings.subAgents.descriptionPlaceholder')}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500"
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('settings.subAgents.systemPrompt')}</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder={t('settings.subAgents.systemPromptPlaceholder')}
                rows={8}
                className="focus-ring w-full resize-y rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500"
              />
            </div>

            {/* Skills */}
            {skills.length > 0 && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">{t('settings.subAgents.skills')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map(skill => (
                    <button
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                        form.skillIds.includes(skill.id)
                          ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                          : 'bg-gray-700 text-gray-400 border border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {skill.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Default Model */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">{t('settings.subAgents.defaultModel')}</label>
              <div className="flex gap-2">
                <select
                  value={form.defaultModel.providerId}
                  onChange={(e) => updateDefaultModel('providerId', e.target.value)}
                  className="focus-ring flex-1 rounded border border-gray-600 bg-gray-800 px-2.5 py-2 text-sm text-gray-200"
                >
                  <option value="">{t('settings.subAgents.provider')}</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={form.defaultModel.model}
                  onChange={(e) => updateDefaultModel('model', e.target.value)}
                  className="focus-ring flex-1 rounded border border-gray-600 bg-gray-800 px-2.5 py-2 text-sm text-gray-200"
                >
                  <option value="">{t('settings.subAgents.model')}</option>
                  {getModelsForProvider(form.defaultModel.providerId).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {(() => {
                  const opts = getEffortOptionsForModel(form.defaultModel.model);
                  return opts.disabled ? (
                    <div className="w-24 rounded border border-gray-600 bg-gray-800 px-2.5 py-2 text-sm text-gray-500">
                      {t('settings.subAgents.alwaysOn')}
                    </div>
                  ) : (
                    <select
                      value={form.defaultModel.effort}
                      onChange={(e) => updateDefaultModel('effort', e.target.value)}
                      className="focus-ring w-24 rounded border border-gray-600 bg-gray-800 px-2.5 py-2 text-sm text-gray-200"
                    >
                      {opts.efforts.map((e) => (
                        <option key={e} value={e}>
                          {e.charAt(0).toUpperCase() + e.slice(1)}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>

            {/* Fallback Models */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400">{t('settings.subAgents.fallbackModels')}</label>
                <button
                  onClick={addFallback}
                  className="text-[11px] text-blue-400 hover:text-blue-300"
                >
                  {t('settings.subAgents.addFallback')}
                </button>
              </div>
              {form.fallbackModels.length === 0 ? (
                <div className="text-[11px] text-gray-500">{t('settings.subAgents.noFallbacks')}</div>
              ) : (
                <div className="space-y-2">
                  {form.fallbackModels.map((fb, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-[10px] text-gray-600 w-4 shrink-0">{i + 1}.</span>
                      <select
                        value={fb.providerId}
                        onChange={(e) => updateFallback(i, 'providerId', e.target.value)}
                        className="focus-ring flex-1 rounded border border-gray-600 bg-gray-800 px-2.5 py-2 text-sm text-gray-200"
                      >
                        <option value="">{t('settings.subAgents.provider')}</option>
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <select
                        value={fb.model}
                        onChange={(e) => updateFallback(i, 'model', e.target.value)}
                        className="focus-ring flex-1 rounded border border-gray-600 bg-gray-800 px-2.5 py-2 text-sm text-gray-200"
                      >
                        <option value="">{t('settings.subAgents.model')}</option>
                        {getModelsForProvider(fb.providerId).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      {(() => {
                        const opts = getEffortOptionsForModel(fb.model);
                        return opts.disabled ? (
                          <div className="w-24 rounded border border-gray-600 bg-gray-800 px-2.5 py-2 text-sm text-gray-500">
                            {t('settings.subAgents.alwaysOn')}
                          </div>
                        ) : (
                          <select
                            value={fb.effort}
                            onChange={(e) => updateFallback(i, 'effort', e.target.value)}
                            className="focus-ring w-24 rounded border border-gray-600 bg-gray-800 px-2.5 py-2 text-sm text-gray-200"
                          >
                            {opts.efforts.map((e) => (
                              <option key={e} value={e}>
                                {e.charAt(0).toUpperCase() + e.slice(1)}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                      <button
                        onClick={() => removeFallback(i)}
                        className="shrink-0 rounded p-1 text-gray-500 hover:text-red-400"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Max Streams */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {t('settings.subAgents.maxStreams')} <span className="text-gray-500">{t('settings.subAgents.maxStreamsHint')}</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.maxStreams}
                onChange={(e) => setForm(prev => ({ ...prev, maxStreams: Math.max(0, parseInt(e.target.value) || 0) }))}
                placeholder={t('settings.subAgents.maxStreamsPlaceholder')}
                className="focus-ring w-32 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500"
              />
              <div className="mt-1 text-[11px] text-gray-500">
                {t('settings.subAgents.maxStreamsDescription')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
