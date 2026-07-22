import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores';
import { aiApi, skillsApi, mcpApi, subAgentApi, effortConfigApi, projectAiSelectionsApi } from '../api/client';
import { getEffortsForModel } from '../../../shared/effortUtils';
import type { AiEffort, WritingSkill, SubAgent, EffortConfig } from '../../../shared/types';
import type { AiStatusResponse } from '../api/client';

export function useChatConfig() {
  const { activeProjectId } = useAppStore();

  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);
  const [activeProviderId, setActiveProviderId] = useState('');
  const [activeModel, setActiveModel] = useState('');
  const [effort, setEffort] = useState<AiEffort>('medium');
  const [effortConfig, setEffortConfig] = useState<EffortConfig | null>(null);
  const [effortOptions, setEffortOptions] = useState<{ efforts: string[]; default: string }>({ efforts: ['low', 'medium', 'high'], default: 'medium' });
  const [effortDisabled, setEffortDisabled] = useState(false);

  // Skills state
  const [skills, setSkills] = useState<WritingSkill[]>([]);
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([]);
  const [skillsDropdownOpen, setSkillsDropdownOpen] = useState(false);

  // MCP Servers state
  const [mcpServers, setMcpServers] = useState<{ config: { id: string; name: string; command: string; args?: string[]; enabled: boolean }; status: string; toolCount: number }[]>([]);
  const [activeMcpIds, setActiveMcpIds] = useState<string[]>([]);
  const [mcpDropdownOpen, setMcpDropdownOpen] = useState(false);

  // Sub-agent state (config)
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [activeSubAgentIds, setActiveSubAgentIds] = useState<string[]>([]);
  const [subAgentsDropdownOpen, setSubAgentsDropdownOpen] = useState(false);

  const subAgentsEnabled = activeSubAgentIds.length > 0;

  const skillsDropdownRef = useRef<HTMLDivElement>(null);
  const mcpDropdownRef = useRef<HTMLDivElement>(null);
  const subAgentsDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch AI status for provider/model dropdowns
  const fetchAiStatus = useCallback(async () => {
    try {
      const res = await aiApi.getStatus();
      if (res.success) {
        setAiStatus(res);
        setActiveProviderId(res.activeProvider?.id ?? '');
        setActiveModel(res.activeModel);
      }
    } catch {
      // AI service might not be ready yet
      console.debug('[useChatConfig] AI service not ready, skipping');
    }
  }, []);

  // Fetch on mount
  useEffect(() => { fetchAiStatus(); }, [fetchAiStatus]);

  // Re-fetch when settings change in the SettingsPanel
  useEffect(() => {
    const handleSettingsChanged = () => { fetchAiStatus(); };
    window.addEventListener('settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('settings-changed', handleSettingsChanged);
  }, [fetchAiStatus]);

  // Load per-project AI selections on mount and when project switches
  const loadProjectSelections = useCallback(async () => {
    try {
      const res = await projectAiSelectionsApi.get();
      if (res.success && res.data) {
        const { providerId, model, effort: savedEffort } = res.data;
        // Apply provider/model to global backend so the next chat uses them
        if (providerId && model) {
          await aiApi.setActive(providerId, model);
          // Refresh AI status so the dropdowns reflect the per-project choice
          await fetchAiStatus();
        }
        // Apply effort locally
        if (savedEffort) {
          setEffort(savedEffort as AiEffort);
        }
      }
    } catch {
      // Non-fatal: project may not have selections yet
      console.debug('[useChatConfig] Project selections not available yet');
    }
  }, [fetchAiStatus]);

  // Load per-project selections on mount and project switch
  useEffect(() => {
    if (activeProjectId) {
      loadProjectSelections();
    }
  }, [activeProjectId, loadProjectSelections]);

  // Persist provider/model/effort to per-project selections
  const saveProjectSelections = useCallback(async (providerId: string, model: string, currentEffort: AiEffort) => {
    try {
      await projectAiSelectionsApi.save({ providerId, model, effort: currentEffort });
    } catch {
      // Non-fatal
      console.debug('[useChatConfig] Failed to save project selections');
    }
  }, []);

  // Fetch effort config on mount
  useEffect(() => {
    let cancelled = false;
    const fetchEffortConfig = async () => {
      try {
        const res = await effortConfigApi.get();
        if (!cancelled && res.success && res.data) {
          setEffortConfig(res.data);
        }
      } catch {
        // Effort config service might not be ready yet
        console.debug('[useChatConfig] Effort config service not ready, skipping');
      }
    };
    fetchEffortConfig();
    return () => { cancelled = true; };
  }, []);

  // Update effort options when model or config changes
  useEffect(() => {
    if (!effortConfig || !activeModel) return;

    let cancelled = false;

    const resolveOptions = async () => {
      // If provider is OpenRouter, use server-side resolution with live metadata
      const providerUrl = aiStatus?.config?.baseUrl;
      const providerApiKey = aiStatus?.config?.apiKey;
      const isOpenRouter = providerUrl && (
        providerUrl.includes('openrouter.ai') || providerUrl.includes('openrouter')
      );

      let resolved: { efforts: string[]; default: string };
      if (isOpenRouter) {
        try {
          const res = await effortConfigApi.resolve(activeModel, providerUrl, providerApiKey);
          if (cancelled) return;
          if (res.success && res.data) {
            resolved = { efforts: res.data.efforts, default: res.data.default };
          } else {
            resolved = getEffortsForModel(effortConfig, activeModel);
          }
        } catch {
          if (cancelled) return;
          resolved = getEffortsForModel(effortConfig, activeModel);
        }
      } else {
        resolved = getEffortsForModel(effortConfig, activeModel);
      }

      if (cancelled) return;
      setEffortOptions(resolved);
      setEffortDisabled(resolved.efforts.length === 0);

      // If current effort isn't in the new model's supported list, reset to default
      if (resolved.efforts.length > 0 && !resolved.efforts.includes(effort)) {
        setEffort(resolved.default as AiEffort);
      } else if (resolved.efforts.length === 0) {
        // Always-on model: set effort to empty string
        setEffort('' as AiEffort);
      }
    };

    resolveOptions();
    return () => { cancelled = true; };
  }, [activeModel, effortConfig, aiStatus?.config?.baseUrl, aiStatus?.config?.apiKey, effort]);

  // Fetch skills on mount
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const [skillsRes, activeRes] = await Promise.all([
          skillsApi.list(),
          skillsApi.getActive(),
        ]);
        if (skillsRes.success) setSkills(skillsRes.data ?? []);
        if (activeRes.success) setActiveSkillIds(activeRes.data ?? []);
      } catch {
        // Skills service might not be ready yet
        console.debug('[useChatConfig] Skills service not ready, skipping');
      }
    };
    fetchSkills();
  }, []);

  // Fetch MCP servers on mount
  useEffect(() => {
    const fetchMcpServers = async () => {
      try {
        const [serversRes, activeRes] = await Promise.all([
          mcpApi.list(),
          mcpApi.getActive(),
        ]);
        if (serversRes.success) setMcpServers(serversRes.data ?? []);
        if (activeRes.success) setActiveMcpIds(activeRes.data ?? []);
      } catch {
        // MCP service might not be ready yet
        console.debug('[useChatConfig] MCP service not ready, skipping');
      }
    };
    fetchMcpServers();
  }, []);

  // Load sub-agents on mount
  useEffect(() => {
    const fetchSubAgents = async () => {
      try {
        const res = await subAgentApi.list();
        if (res.success) setSubAgents(res.data ?? []);
      } catch {
        // Sub-agent service might not be ready
        console.debug('[useChatConfig] Sub-agent service not ready, skipping');
      }
    };
    fetchSubAgents();
  }, []);

  // Load active sub-agent IDs
  useEffect(() => {
    const fetchActiveSubAgents = async () => {
      try {
        const res = await subAgentApi.getActive();
        if (res.success) setActiveSubAgentIds(res.data ?? []);
      } catch {
        // Sub-agent API might not be ready
        console.debug('[useChatConfig] Sub-agent API not ready, skipping');
      }
    };
    fetchActiveSubAgents();
  }, []);

  // Close skills dropdown on outside click
  useEffect(() => {
    if (!skillsDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (skillsDropdownRef.current && !skillsDropdownRef.current.contains(e.target as Node)) {
        setSkillsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [skillsDropdownOpen]);

  // Close MCP dropdown on outside click
  useEffect(() => {
    if (!mcpDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (mcpDropdownRef.current && !mcpDropdownRef.current.contains(e.target as Node)) {
        setMcpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mcpDropdownOpen]);

  // Close sub-agents dropdown on outside click
  useEffect(() => {
    if (!subAgentsDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (subAgentsDropdownRef.current && !subAgentsDropdownRef.current.contains(e.target as Node)) {
        setSubAgentsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [subAgentsDropdownOpen]);

  const providers = aiStatus?.settings.providers ?? [];
  const models = providers.find(p => p.id === activeProviderId)?.models ?? [];

  const handleProviderChange = useCallback(async (newProviderId: string) => {
    setActiveProviderId(newProviderId);
    const provider = providers.find(p => p.id === newProviderId);
    if (provider && provider.models.length > 0) {
      const newModel = provider.models[0];
      setActiveModel(newModel);
      try {
        await aiApi.setActive(newProviderId, newModel);
      } catch {
        // ignore setActive errors in header dropdown
        console.debug('[useChatConfig] setActive failed in provider dropdown');
      }
      saveProjectSelections(newProviderId, newModel, effort);
    }
  }, [providers, saveProjectSelections, effort]);

  const handleModelChange = useCallback(async (newModel: string) => {
    setActiveModel(newModel);
    try {
      await aiApi.setActive(activeProviderId, newModel);
    } catch {
      // ignore setActive errors in header dropdown
      console.debug('[useChatConfig] setActive failed in model dropdown');
    }
    saveProjectSelections(activeProviderId, newModel, effort);
  }, [activeProviderId, saveProjectSelections, effort]);

  const handleToggleSkill = useCallback(async (skillId: string) => {
    const newIds = activeSkillIds.includes(skillId)
      ? activeSkillIds.filter(id => id !== skillId)
      : [...activeSkillIds, skillId];
    setActiveSkillIds(newIds);
    try {
      await skillsApi.setActive(newIds);
      } catch {
        // ignore errors in header toggle
        console.debug('[useChatConfig] Failed to toggle skill');
      }
    }, [activeSkillIds]);

  const handleToggleMcpServer = useCallback(async (serverId: string) => {
    const newIds = activeMcpIds.includes(serverId)
      ? activeMcpIds.filter(id => id !== serverId)
      : [...activeMcpIds, serverId];
    setActiveMcpIds(newIds);
    try {
      await mcpApi.setActive(newIds);
      } catch {
        // ignore errors in header toggle
        console.debug('[useChatConfig] Failed to toggle MCP server');
      }
    }, [activeMcpIds]);

  const handleToggleSubAgent = useCallback(async (agentId: string) => {
    const newIds = activeSubAgentIds.includes(agentId)
      ? activeSubAgentIds.filter(id => id !== agentId)
      : [...activeSubAgentIds, agentId];
    setActiveSubAgentIds(newIds);
    try {
      await subAgentApi.setActive(newIds);
      } catch {
        // ignore errors in header toggle
        console.debug('[useChatConfig] Failed to toggle sub-agent');
      }
    }, [activeSubAgentIds]);

  return {
    aiStatus,
    activeProviderId,
    setActiveProviderId,
    activeModel,
    setActiveModel,
    providers,
    models,
    effort,
    setEffort,
    effortConfig,
    effortOptions,
    effortDisabled,
    skills,
    activeSkillIds,
    setActiveSkillIds,
    skillsDropdownOpen,
    setSkillsDropdownOpen,
    mcpServers,
    activeMcpIds,
    setActiveMcpIds,
    mcpDropdownOpen,
    setMcpDropdownOpen,
    subAgents,
    setSubAgents,
    activeSubAgentIds,
    setActiveSubAgentIds,
    subAgentsDropdownOpen,
    setSubAgentsDropdownOpen,
    subAgentsEnabled,
    skillsDropdownRef,
    mcpDropdownRef,
    subAgentsDropdownRef,
    handleProviderChange,
    handleModelChange,
    handleToggleSkill,
    handleToggleMcpServer,
    handleToggleSubAgent,
    saveProjectSelections,
    fetchAiStatus,
    loadProjectSelections,
  };
}
