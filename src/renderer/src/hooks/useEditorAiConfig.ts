import { useState, useEffect, useCallback, useMemo } from 'react';
import { aiApi } from '../api/aiApi';
import { projectAiSelectionsApi } from '../api/projectAiSelectionsApi';
import { effortConfigApi } from '../api/effortConfigApi';
import { getEffortsForModel } from '../../../shared/effortUtils';
import type { AiEffort, EffortConfig, AiProvider } from '../../../shared/types';

const DEFAULT_EFFORT_OPTIONS: { efforts: string[]; default: string } = {
  efforts: ['low', 'medium', 'high'],
  default: 'medium',
};

export function useEditorAiConfig() {
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [effort, setEffort] = useState<AiEffort>('medium');
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [effortConfig, setEffortConfig] = useState<EffortConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [statusRes, effortConfigRes, selectionsRes] = await Promise.all([
          aiApi.getStatus(),
          effortConfigApi.get(),
          projectAiSelectionsApi.get(),
        ]);

        if (cancelled) return;

        const statusProviders = statusRes.settings.providers ?? [];
        const statusProviderId = statusRes.settings.activeProviderId;
        const statusModel = statusRes.settings.activeModel;
        setProviders(statusProviders);
        setActiveProviderId(statusProviderId);
        setActiveModel(statusModel);

        if (effortConfigRes.success && effortConfigRes.data) {
          setEffortConfig(effortConfigRes.data);
        }

        if (selectionsRes.success && selectionsRes.data) {
          const sel = selectionsRes.data;
          setActiveProviderId(sel.providerId);
          setActiveModel(sel.model);
          setEffort(sel.effort);
          aiApi.setActive(sel.providerId, sel.model).catch(() => {});
        } else {
          if (effortConfigRes.success && effortConfigRes.data && statusModel) {
            const opts = getEffortsForModel(effortConfigRes.data, statusModel);
            setEffort(opts.default as AiEffort);
          }
        }
      } catch (err) {
        console.error('[useEditorAiConfig] Failed to load:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const models = useMemo(() => {
    const provider = providers.find((p) => p.id === activeProviderId);
    return provider?.models ?? [];
  }, [providers, activeProviderId]);

  const effortOptions = useMemo(() => {
    if (!effortConfig || !activeModel) return DEFAULT_EFFORT_OPTIONS;
    return getEffortsForModel(effortConfig, activeModel);
  }, [effortConfig, activeModel]);

  const effortDisabled = effortOptions.efforts.length <= 1;

  const saveProjectSelections = useCallback(
    (providerId: string | null, model: string | null, currentEffort: AiEffort) => {
      if (!providerId || !model) return;
      projectAiSelectionsApi.save({ providerId, model, effort: currentEffort }).catch(() => {});
    },
    [],
  );

  const onProviderChange = useCallback(
    (providerId: string) => {
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return;
      const firstModel = provider.models[0] ?? '';
      setActiveProviderId(providerId);
      setActiveModel(firstModel);
      aiApi.setActive(providerId, firstModel).catch(() => {});
      saveProjectSelections(providerId, firstModel, effort);
    },
    [providers, effort, saveProjectSelections],
  );

  const onModelChange = useCallback(
    (model: string) => {
      setActiveModel(model);
      if (activeProviderId) {
        aiApi.setActive(activeProviderId, model).catch(() => {});
      }
      saveProjectSelections(activeProviderId, model, effort);
    },
    [activeProviderId, effort, saveProjectSelections],
  );

  const onEffortChange = useCallback(
    (newEffort: AiEffort) => {
      setEffort(newEffort);
      saveProjectSelections(activeProviderId, activeModel, newEffort);
    },
    [activeProviderId, activeModel, saveProjectSelections],
  );

  return {
    activeProviderId,
    activeModel,
    effort,
    providers,
    models,
    effortOptions,
    effortDisabled,
    onProviderChange,
    onModelChange,
    onEffortChange,
    loading,
  };
}
