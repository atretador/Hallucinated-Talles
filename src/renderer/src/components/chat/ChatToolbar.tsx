import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { AiEffort, AgentSession, WritingSkill, SubAgent } from '../../../../shared/types';
import { APPROVABLE_TOOLS, type ToolApprovalMap } from '../../hooks/useToolApprovals';

interface ChatToolbarProps {
  // Session
  sessions: AgentSession[];
  activeSessionId: string | null;
  activeSession: AgentSession | undefined;
  bookMap: Map<string, string>;
  sessionDropdownOpen: boolean;
  setSessionDropdownOpen: (open: boolean) => void;
  setSessionListOpen: (open: boolean) => void;
  handleNewSession: () => Promise<void>;
  handleSwitchSession: (id: string) => Promise<void>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;

  // Skills
  skills: WritingSkill[];
  activeSkillIds: string[];
  skillsDropdownOpen: boolean;
  setSkillsDropdownOpen: (open: boolean) => void;
  handleToggleSkill: (skillId: string) => Promise<void>;
  skillsDropdownRef: React.RefObject<HTMLDivElement | null>;

  // MCP
  mcpServers: { config: { id: string; name: string; command: string; args?: string[]; enabled: boolean }; status: string; toolCount: number }[];
  activeMcpIds: string[];
  mcpDropdownOpen: boolean;
  setMcpDropdownOpen: (open: boolean) => void;
  handleToggleMcpServer: (serverId: string) => Promise<void>;
  mcpDropdownRef: React.RefObject<HTMLDivElement | null>;

  // Sub-Agents (config)
  subAgents: SubAgent[];
  activeSubAgentIds: string[];
  subAgentsDropdownOpen: boolean;
  setSubAgentsDropdownOpen: (open: boolean) => void;
  handleToggleSubAgent: (agentId: string) => Promise<void>;
  subAgentsDropdownRef: React.RefObject<HTMLDivElement | null>;

  // Provider / Model / Effort
  activeProviderId: string;
  providers: Array<{ id: string; name: string; models: string[] }>;
  models: string[];
  activeModel: string;
  effort: AiEffort;
  effortOptions: { efforts: string[]; default: string };
  effortDisabled: boolean;
  handleProviderChange: (newProviderId: string) => Promise<void>;
  handleModelChange: (newModel: string) => Promise<void>;
  setEffort: (effort: AiEffort) => void;
  saveProjectSelections: (providerId: string, model: string, effort: AiEffort) => Promise<void>;

  // Context usage
  chatUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
    model: string;
    contextWindow: number;
  } | null;
  chatUsageUpdating: boolean;

  // Commits
  showCommits: boolean;
  setShowCommits: (show: boolean) => void;

  // Tool Approvals
  toolApprovals: ToolApprovalMap;
  toggleApproval: (toolName: string) => void;
  setAllApprovals: (value: boolean) => void;
  enabledApprovalCount: number;
}

export function ChatToolbar({
  // Session
  sessions,
  activeSessionId,
  activeSession,
  bookMap,
  sessionDropdownOpen,
  setSessionDropdownOpen,
  setSessionListOpen,
  handleNewSession,
  handleSwitchSession,
  dropdownRef,

  // Skills
  skills,
  activeSkillIds,
  skillsDropdownOpen,
  setSkillsDropdownOpen,
  handleToggleSkill,
  skillsDropdownRef,

  // MCP
  mcpServers,
  activeMcpIds,
  mcpDropdownOpen,
  setMcpDropdownOpen,
  handleToggleMcpServer,
  mcpDropdownRef,

  // Sub-Agents
  subAgents,
  activeSubAgentIds,
  subAgentsDropdownOpen,
  setSubAgentsDropdownOpen,
  handleToggleSubAgent,
  subAgentsDropdownRef,

  // Provider / Model / Effort
  activeProviderId,
  providers,
  models,
  activeModel,
  effort,
  effortOptions,
  effortDisabled,
  handleProviderChange,
  handleModelChange,
  setEffort,
  saveProjectSelections,

  // Context usage
  chatUsage,
  chatUsageUpdating,

  // Commits
  showCommits,
  setShowCommits,

  // Tool Approvals
  toolApprovals,
  toggleApproval,
  setAllApprovals,
  enabledApprovalCount,
}: ChatToolbarProps) {
  const { t } = useTranslation();
  const [approvalDropdownOpen, setApprovalDropdownOpen] = useState(false);
  const approvalDropdownRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-gray-700 px-3 py-2 min-w-0">
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setSessionDropdownOpen(!sessionDropdownOpen)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-semibold text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <span className="truncate max-w-[160px]">
              {activeSession?.title || t('chat.toolbar.newSession', { ns: 'app' })}
            </span>
            {activeSession?.bookId && bookMap.has(activeSession.bookId) && (
              <span className="rounded bg-gray-600/50 px-1 py-0.5 text-[10px] text-gray-400 shrink-0">
                {bookMap.get(activeSession.bookId)}
              </span>
            )}
            <svg className="h-3 w-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {sessionDropdownOpen && createPortal(
            <div
              className="fixed z-50 w-64 rounded border border-gray-700 bg-gray-800 shadow-lg"
              style={{
                top: (dropdownRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                left: dropdownRef.current?.getBoundingClientRect().left ?? 0,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-2">
                <button
                  onClick={handleNewSession}
                  className="w-full rounded px-2 py-1.5 text-left text-sm text-blue-400 hover:bg-gray-700"
                >
                  {t('chat.toolbar.newSession', { ns: 'app' })}
                </button>
              </div>
              {sessions.length > 0 && (
                <div className="border-t border-gray-700 p-2">
                  <div className="mb-1 px-2 text-xs text-gray-500">{t('chat.toolbar.recentSessions', { ns: 'app' })}</div>
                  <div className="max-h-48 overflow-y-auto">
                    {sessions.slice(0, 10).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSwitchSession(s.id)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
                          s.id === activeSessionId
                            ? 'bg-blue-600/20 text-blue-300'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <div className="truncate font-medium">{s.title}</div>
                        <div className="text-xs text-gray-500">
                          {s.bookId && bookMap.has(s.bookId) && (
                            <span className="mr-1 rounded bg-gray-600/50 px-1 py-0.5 text-[10px] text-gray-400">
                              {bookMap.get(s.bookId)}
                            </span>
                          )}
                          {t('chat.toolbar.sessionMessages', { ns: 'app', count: s.messageCount })} · {t('chat.toolbar.sessionCommits', { ns: 'app', count: s.commitCount })}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <button
                      onClick={() => {
                        setSessionDropdownOpen(false);
                        setSessionListOpen(true);
                      }}
                      className="w-full rounded px-2 py-1.5 text-left text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                    >
                      {t('chat.toolbar.allSessions', { ns: 'app' })}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ,
          document.body
        )}
        </div>

        {/* Spacer pushes center group to center */}
        <div className="flex-1" />

        {/* Center: toggle buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Skills button */}
          <div className="relative shrink-0" ref={skillsDropdownRef}>
            <button
              onClick={() => setSkillsDropdownOpen(!skillsDropdownOpen)}
              className={`rounded p-1.5 transition-colors ${
                activeSkillIds.length > 0
                  ? 'bg-purple-600/20 text-purple-400'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
              title={t('chat.toolbar.skillsActive', { ns: 'app', count: activeSkillIds.length })}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>

            {skillsDropdownOpen && createPortal(
              <div
                className="fixed z-50 w-64 rounded border border-gray-600 bg-gray-800 shadow-lg"
                style={{
                  top: (skillsDropdownRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                  left: (skillsDropdownRef.current?.getBoundingClientRect().right ?? 0) - 256,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  <div className="mb-1 text-xs font-medium text-gray-400">{t('chat.toolbar.skills', { ns: 'app' })}</div>
                  {skills.length > 0 ? skills.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => handleToggleSkill(skill.id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                        activeSkillIds.includes(skill.id)
                          ? 'bg-purple-600/20 text-purple-300'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${
                        activeSkillIds.includes(skill.id) ? 'bg-purple-400' : 'bg-gray-600'
                      }`} />
                      <span className="truncate">{skill.name}</span>
                    </button>
                  )) : (
                    <div className="py-2 text-center text-xs text-gray-500">{t('chat.toolbar.noSkills', { ns: 'app' })}</div>
                  )}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* MCP Servers button */}
          <div className="relative shrink-0" ref={mcpDropdownRef}>
            <button
              onClick={() => setMcpDropdownOpen(!mcpDropdownOpen)}
              className={`rounded p-1.5 transition-colors ${
                activeMcpIds.length > 0
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
              title={t('chat.toolbar.mcpActive', { ns: 'app', count: activeMcpIds.length })}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </button>

            {mcpDropdownOpen && createPortal(
              <div
                className="fixed z-50 w-72 rounded border border-gray-600 bg-gray-800 shadow-lg"
                style={{
                  top: (mcpDropdownRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                  left: (mcpDropdownRef.current?.getBoundingClientRect().right ?? 0) - 288,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  <div className="mb-1 text-xs font-medium text-gray-400">{t('chat.toolbar.mcpServers', { ns: 'app' })}</div>
                  {mcpServers.length > 0 ? mcpServers.map((server) => {
                    const isActive = activeMcpIds.includes(server.config.id);
                    const statusDot: Record<string, string> = {
                      connected: 'bg-green-400',
                      connecting: 'bg-yellow-400',
                      error: 'bg-red-400',
                      disconnected: 'bg-gray-500',
                    };
                    return (
                      <button
                        key={server.config.id}
                        onClick={() => handleToggleMcpServer(server.config.id)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-indigo-600/20 text-indigo-300'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${statusDot[server.status] ?? 'bg-gray-500'}`} />
                        <span className="flex-1 truncate">{server.config.name}</span>
                        <span className="text-[10px] text-gray-500">{t('chat.toolbar.toolCount', { ns: 'app', count: server.toolCount })}</span>
                      </button>
                    );
                  }) : (
                    <div className="py-2 text-center text-xs text-gray-500">{t('chat.toolbar.noMcpServers', { ns: 'app' })}</div>
                  )}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Approval lock button */}
          <div className="relative shrink-0" ref={approvalDropdownRef}>
            <button
              onClick={() => setApprovalDropdownOpen(!approvalDropdownOpen)}
              className={`relative rounded p-1.5 transition-colors ${
                enabledApprovalCount > 0
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
              title={enabledApprovalCount > 0 ? t('chat.toolbar.toolApprovalActive', { ns: 'app', count: enabledApprovalCount }) : t('chat.toolbar.toolApproval', { ns: 'app' })}
            >
              {enabledApprovalCount > 0 ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
              {enabledApprovalCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                  {enabledApprovalCount}
                </span>
              )}
            </button>

            {approvalDropdownOpen && createPortal(
              <div
                className="fixed z-50 w-64 rounded border border-gray-600 bg-gray-800 shadow-lg"
                style={{
                  top: (approvalDropdownRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                  left: (approvalDropdownRef.current?.getBoundingClientRect().right ?? 0) - 256,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">{t('chat.toolbar.toolApproval', { ns: 'app' })}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAllApprovals(true)}
                        className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                          enabledApprovalCount === APPROVABLE_TOOLS.length
                            ? 'bg-amber-600/30 text-amber-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {t('buttons.allOn', { ns: 'common' })}
                      </button>
                      <button
                        onClick={() => setAllApprovals(false)}
                        className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                          enabledApprovalCount === 0
                            ? 'bg-green-600/30 text-green-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {t('buttons.allOff', { ns: 'common' })}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {APPROVABLE_TOOLS.map((tool) => {
                      const isApproved = toolApprovals[tool.name] ?? tool.default;
                      return (
                        <button
                          key={tool.name}
                          title={tool.label}
                          onClick={() => toggleApproval(tool.name)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-700"
                        >
                          <span className={`h-2 w-2 rounded-full shrink-0 ${
                            isApproved ? 'bg-amber-400' : 'bg-green-400'
                          }`} />
                          <span className="flex-1 truncate text-gray-300">{tool.label}</span>
                          <div className={`relative h-4 w-7 rounded-full transition-colors ${
                            isApproved ? 'bg-amber-500/50' : 'bg-gray-600'
                          }`}>
                            <div className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                              isApproved ? 'translate-x-3' : 'translate-x-0'
                            }`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Sub-agents button + dropdown */}
          <div className="relative shrink-0" ref={subAgentsDropdownRef}>
            <button
              onClick={() => setSubAgentsDropdownOpen(!subAgentsDropdownOpen)}
              className={`rounded p-1.5 transition-colors ${
                activeSubAgentIds.length > 0
                  ? 'bg-orange-600/20 text-orange-400'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
              title={t('chat.toolbar.subAgentsActive', { ns: 'app', count: activeSubAgentIds.length })}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>

            {subAgentsDropdownOpen && createPortal(
              <div
                className="fixed z-50 w-64 rounded border border-gray-600 bg-gray-800 shadow-lg"
                style={{
                  top: (subAgentsDropdownRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                  left: (subAgentsDropdownRef.current?.getBoundingClientRect().right ?? 0) - 256,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  <div className="mb-1 text-xs font-medium text-gray-400">{t('chat.toolbar.subAgents', { ns: 'app' })}</div>
                  {subAgents.length > 0 ? subAgents.map((agent) => {
                    const isActive = activeSubAgentIds.includes(agent.id);
                    const hue = agent.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => handleToggleSubAgent(agent.id)}
                        className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-orange-600/20 text-orange-300'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                        title={agent.description || agent.name}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: isActive ? `hsl(${hue}, 70%, 55%)` : undefined }}
                        />
                        <span className="truncate">{agent.name}</span>
                      </button>
                    );
                  }) : (
                    <div className="py-2 text-center text-xs text-gray-500">
                      {t('chat.toolbar.noSubAgents', { ns: 'app' })}
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Commits button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowCommits(!showCommits)}
              className={`rounded p-1.5 transition-colors ${
                showCommits
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
              title={t('chat.toolbar.viewCommits', { ns: 'app' })}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Provider / Model / Effort selectors */}
      <div className="border-t border-gray-700 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          {/* Provider selector */}
          <select
            value={activeProviderId}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[100px] truncate shrink-0"
            title={t('chat.toolbar.providerLabel', { ns: 'app' })}
          >
            <option value="">{t('labels.provider', { ns: 'common' })}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Model selector */}
          <select
            value={activeModel}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={!activeProviderId || models.length === 0}
            className="rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[120px] truncate shrink-0 disabled:opacity-40"
            title={t('chat.toolbar.modelLabel', { ns: 'app' })}
          >
            {models.length === 0 ? (
              <option value="">{t('labels.model', { ns: 'common' })}</option>
            ) : (
              models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>

          {/* Effort selector */}
          {effortDisabled ? (
            <div className="rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] text-gray-500 shrink-0" title={t('chat.toolbar.effortLabel', { ns: 'app' })}>
              {t('chat.toolbar.alwaysOn', { ns: 'app' })}
            </div>
          ) : (
            <select
              value={effort}
              onChange={(e) => {
                const newEffort = e.target.value as AiEffort;
                setEffort(newEffort);
                saveProjectSelections(activeProviderId, activeModel, newEffort);
              }}
              className="rounded border border-gray-600 bg-gray-700 px-1.5 py-[3px] text-[11px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
              title={t('chat.toolbar.effortLabel', { ns: 'app' })}
            >
              {effortOptions.efforts.map((e) => (
                <option key={e} value={e}>
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </option>
              ))}
            </select>
          )}

          {/* Context usage indicator */}
          {chatUsage && (
            <div
              className={`ml-auto flex items-center gap-1.5 text-[10px] text-gray-400 shrink-0 transition-opacity ${chatUsageUpdating ? 'opacity-60' : 'opacity-100'}`}
              title={`${chatUsageUpdating ? t('chat.toolbar.contextUpdating', { ns: 'app' }) + ' · ' : ''}${t('chat.toolbar.prompt', { ns: 'app' })}: ${chatUsage.promptTokens.toLocaleString()} · ${t('chat.toolbar.completion', { ns: 'app' })}: ${chatUsage.completionTokens.toLocaleString()}${chatUsage.cachedTokens > 0 ? ` · ${t('chat.toolbar.cached', { ns: 'app' })}: ${chatUsage.cachedTokens.toLocaleString()}` : ''}`}
            >
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    chatUsage.totalTokens / chatUsage.contextWindow > 0.9
                      ? 'bg-red-500'
                      : chatUsage.totalTokens / chatUsage.contextWindow > 0.7
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, (chatUsage.totalTokens / chatUsage.contextWindow) * 100)}%` }}
                />
              </div>
              <span>
                {chatUsageUpdating ? '~' : ''}
                {chatUsage.totalTokens < 1000
                  ? chatUsage.totalTokens
                  : chatUsage.totalTokens < 1_000_000
                    ? `${(chatUsage.totalTokens / 1000).toFixed(chatUsage.totalTokens < 10_000 ? 1 : 0)}k`
                    : `${(chatUsage.totalTokens / 1_000_000).toFixed(1)}M`}
                {' / '}
                {chatUsage.contextWindow < 1_000_000
                  ? `${chatUsage.contextWindow / 1000}k`
                  : `${chatUsage.contextWindow / 1_000_000}M`}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
