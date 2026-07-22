import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { subAgentApi, aiApi, skillsApi, effortConfigApi } from '../../api/client';
import type { SubAgent, SubAgentModelConfig, WritingSkill, EffortConfig } from '../../../../shared/types';
import type { AiStatusResponse } from '../../api/client';
import { getEffortsForModel } from '../../../../shared/effortUtils';

interface SubAgentManagerProps {
  onClose: () => void;
  onSaved?: () => void;
  onRun?: (subAgentId: string) => void;
}

interface SubAgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
  skillIds: string[];
  defaultModel: SubAgentModelConfig;
  fallbackModels: SubAgentModelConfig[];
  maxStreams: number;  // 0 = unlimited
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

export function SubAgentManager({ onClose, onSaved, onRun }: SubAgentManagerProps) {
  const { t } = useTranslation();
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [editing, setEditing] = useState<SubAgent | null>(null);
  const [form, setForm] = useState<SubAgentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // AI providers/models for model selectors
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
      console.debug('[SubAgentManager] Load data failed, ignoring');
    }
  };

  const providers = aiStatus?.settings.providers ?? [];

  const getModelsForProvider = (providerId: string): string[] =>
    providers.find(p => p.id === providerId)?.models ?? [];

  // Cache for OpenRouter effort options (populated on mount if provider is OpenRouter)
  const [openRouterCache, setOpenRouterCache] = useState<Map<string, { efforts: string[]; default: string }>>(new Map());

  useEffect(() => {
    // If active provider is OpenRouter, pre-fetch effort options for all its models
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
            console.debug('[SubAgentManager] OpenRouter resolve failed, falling back to config');
          }
          // Fallback to config-based resolution
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
    // Check OpenRouter cache first
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
    if (!confirm(t('settings.subAgents.deleteConfirm', { ns: 'app' }))) return;
    try {
      await subAgentApi.delete(id);
      setSubAgents(prev => prev.filter(a => a.id !== id));
      if (editing?.id === id) {
        setEditing(null);
        setForm(EMPTY_FORM);
      }
    } catch {
      setError(t('settings.subAgents.failedToDelete', { ns: 'app' }));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('settings.subAgents.nameRequired', { ns: 'app' })); return; }
    if (!form.systemPrompt.trim()) { setError(t('settings.subAgents.systemPromptRequired', { ns: 'app' })); return; }
    if (!form.defaultModel.providerId || !form.defaultModel.model) {
      setError(t('settings.subAgents.defaultModelRequired', { ns: 'app' }));
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
        }
      } else {
        const res = await subAgentApi.create(form);
        if (res.success && res.data) {
          setSubAgents(prev => [...prev, res.data!]);
          handleEdit(res.data);
        }
      }
      onSaved?.();
    } catch {
      setError(t('settings.subAgents.failedToSave', { ns: 'app' }));
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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="flex h-[85vh] w-[900px] max-w-[95vw] flex-col rounded-xl border border-gray-600 bg-gray-850 shadow-2xl overflow-hidden"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{ backgroundColor: '#1a1d23' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-700 px-5 py-3">
            <h2 className="text-base font-semibold text-gray-100">{t('settings.subAgents.title', { ns: 'app' })}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNew}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
              >
{t('settings.subAgents.newSubAgent', { ns: 'app' })}
              </button>
              <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left: Agent list */}
            <div className="w-64 border-r border-gray-700 overflow-y-auto p-3">
              {subAgents.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  {t('settings.subAgents.noAgents', { ns: 'app' })}
                </div>
              ) : (
                <div className="space-y-1">
                  {subAgents.map(agent => (
                    <div key={agent.id} className="group relative">
                      <button
                        onClick={() => handleEdit(agent)}
                        className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                          editing?.id === agent.id
                            ? 'bg-blue-600/20 text-blue-300'
                            : 'text-gray-300 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="text-sm font-medium truncate">{agent.name}</div>
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">{agent.description || t('messages.noDescription', { ns: 'common' })}</div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          {agent.defaultModel.providerId}/{agent.defaultModel.model}
                        </div>
                      </button>
                      {onRun && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRun(agent.id); onClose(); }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-green-400 hover:bg-green-900/30"
                          title={t('chat.subAgent.run', { ns: 'app' })}
                        >
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Editor */}
            <div className="flex-1 overflow-y-auto p-5">
              {editing || isCreating ? (
                <div className="space-y-4">
                  {error && (
                    <div className="rounded bg-red-900/30 px-3 py-2 text-xs text-red-400">{error}</div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">{t('settings.subAgents.name', { ns: 'app' })}</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={t('settings.subAgents.namePlaceholder', { ns: 'app' })}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      {t('settings.subAgents.description', { ns: 'app' })} <span className="text-gray-600">{t('settings.subAgents.descriptionHint', { ns: 'app', count: form.description.length })}</span>
                    </label>
                    <input
                      value={form.description}
                      onChange={(e) => {
                        if (e.target.value.length <= 100) {
                          setForm(prev => ({ ...prev, description: e.target.value }));
                        }
                      }}
                      placeholder={t('settings.subAgents.descriptionPlaceholder', { ns: 'app' })}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                    />
                  </div>

                  {/* System Prompt */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">{t('settings.subAgents.systemPrompt', { ns: 'app' })}</label>
                    <textarea
                      value={form.systemPrompt}
                      onChange={(e) => setForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      placeholder={t('settings.subAgents.systemPromptPlaceholder', { ns: 'app' })}
                      rows={6}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none resize-none"
                    />
                  </div>

                  {/* Skills */}
                  {skills.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('settings.subAgents.skills', { ns: 'app' })}</label>
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
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('settings.subAgents.defaultModel', { ns: 'app' })}</label>
                    <div className="flex gap-2">
                      <select
                        value={form.defaultModel.providerId}
                        onChange={(e) => updateDefaultModel('providerId', e.target.value)}
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none"
                      >
                        <option value="">{t('labels.provider', { ns: 'common' })}</option>
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <select
                        value={form.defaultModel.model}
                        onChange={(e) => updateDefaultModel('model', e.target.value)}
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none"
                      >
                        <option value="">{t('labels.model', { ns: 'common' })}</option>
                        {getModelsForProvider(form.defaultModel.providerId).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      {(() => {
                        const opts = getEffortOptionsForModel(form.defaultModel.model);
                        return opts.disabled ? (
                          <div className="w-24 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-500">
                            {t('settings.subAgents.alwaysOn', { ns: 'app' })}
                          </div>
                        ) : (
                          <select
                            value={form.defaultModel.effort}
                            onChange={(e) => updateDefaultModel('effort', e.target.value)}
                            className="w-24 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none"
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
                      <label className="text-xs font-medium text-gray-400">{t('settings.subAgents.fallbackModels', { ns: 'app' })}</label>
                      <button
                        onClick={addFallback}
                        className="text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        {t('settings.subAgents.addFallback', { ns: 'app' })}
                      </button>
                    </div>
                    {form.fallbackModels.length === 0 ? (
                      <div className="text-[11px] text-gray-600">{t('settings.subAgents.noFallbacks', { ns: 'app' })}</div>
                    ) : (
                      <div className="space-y-2">
                        {form.fallbackModels.map((fb, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <span className="text-[10px] text-gray-600 w-4">{i + 1}.</span>
                            <select
                              value={fb.providerId}
                              onChange={(e) => updateFallback(i, 'providerId', e.target.value)}
                              className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none"
                            >
                              <option value="">{t('labels.provider', { ns: 'common' })}</option>
                              {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <select
                              value={fb.model}
                              onChange={(e) => updateFallback(i, 'model', e.target.value)}
                              className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none"
                            >
                              <option value="">{t('labels.model', { ns: 'common' })}</option>
                              {getModelsForProvider(fb.providerId).map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            {(() => {
                              const opts = getEffortOptionsForModel(fb.model);
                              return opts.disabled ? (
                                <div className="w-24 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-500">
                                  {t('settings.subAgents.alwaysOn', { ns: 'app' })}
                                </div>
                              ) : (
                                <select
                                  value={fb.effort}
                                  onChange={(e) => updateFallback(i, 'effort', e.target.value)}
                                  className="w-24 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none"
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
                              className="rounded p-1 text-gray-500 hover:text-red-400"
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
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      {t('settings.subAgents.maxStreams', { ns: 'app' })} <span className="text-gray-600">{t('settings.subAgents.maxStreamsHint', { ns: 'app' })}</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.maxStreams}
                      onChange={(e) => setForm(prev => ({ ...prev, maxStreams: Math.max(0, parseInt(e.target.value) || 0) }))}
                      placeholder={t('settings.subAgents.maxStreamsPlaceholder', { ns: 'app' })}
                      className="w-32 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                    />
                    <div className="mt-1 text-[11px] text-gray-600">
                      {t('settings.subAgents.maxStreamsDescription', { ns: 'app' })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {saving ? t('settings.subAgents.saving', { ns: 'app' }) : editing ? t('buttons.save', { ns: 'common' }) : t('settings.subAgents.create', { ns: 'app' })}
                    </button>
                    {editing && (
                      <button
                        onClick={() => handleDelete(editing.id)}
                        className="rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400 hover:bg-red-900/50 transition-colors"
                      >
                        {t('settings.subAgents.delete', { ns: 'app' })}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  {t('settings.subAgents.selectHint', { ns: 'app' })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
