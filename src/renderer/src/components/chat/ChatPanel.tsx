import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useAppStore } from '../../stores';
import { useChatSession } from '../../hooks/useChatSession';
import { useChatConfig } from '../../hooks/useChatConfig';
import { useSubAgentManager } from '../../hooks/useSubAgentManager';
import { useChatStream } from '../../hooks/useChatStream';
import { useToolApprovals } from '../../hooks/useToolApprovals';
import { ChatToolbar } from './ChatToolbar';
import { ChatInput } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { SubAgentStreaming } from './SubAgentStreaming';
import { SessionListModal } from './SessionListModal';
import { CommitDiffModal } from './CommitDiffModal';
import type { SubAgentRun, SessionCommit } from '../../../../shared/types';

export function ChatPanel() {
  const { activeBookId, messages, streamCommits } = useAppStore();

  const session = useChatSession();
  const config = useChatConfig();
  const subAgent = useSubAgentManager();
  const toolApprovalsHook = useToolApprovals();
  const stream = useChatStream({
    effort: config.effort,
    subAgentsEnabled: config.subAgentsEnabled,
    activeBookId,
    streamExistingRun: subAgent.streamExistingRun,
    setActiveRuns: subAgent.setActiveRuns,
    setSelectedTab: subAgent.setSelectedTab,
    toolApprovals: toolApprovalsHook.approvals,
  });

  const shouldReduceMotion = useReducedMotion();
  const [viewingCommit, setViewingCommit] = useState<SessionCommit | null>(null);
  const [showCommits, setShowCommits] = useState(false);

  // Load session data when active session changes or session data is refreshed
  useEffect(() => {
    if (session.currentSessionData && session.activeSessionId) {
      useAppStore.getState().setMessages(session.currentSessionData.messages);
      stream.setAgentTasks(session.currentSessionData.tasks ?? []);
      // Initialize active runs from persisted session data
      const initialRuns = new Map<string, SubAgentRun>();
      for (const run of (session.currentSessionData.subAgentRuns ?? [])) {
        initialRuns.set(run.id, run);
      }
      subAgent.setActiveRuns(initialRuns);
    }
  }, [session.activeSessionId, session.currentSessionData, stream.setAgentTasks, subAgent.setActiveRuns]);

  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-100">
      <ChatToolbar
        // Session
        sessions={session.sessions}
        activeSessionId={session.activeSessionId}
        activeSession={session.activeSession}
        bookMap={session.bookMap}
        sessionDropdownOpen={session.sessionDropdownOpen}
        setSessionDropdownOpen={session.setSessionDropdownOpen}
        setSessionListOpen={session.setSessionListOpen}
        handleNewSession={session.handleNewSession}
        handleSwitchSession={session.handleSwitchSession}
        dropdownRef={session.dropdownRef}
        // Skills
        skills={config.skills}
        activeSkillIds={config.activeSkillIds}
        skillsDropdownOpen={config.skillsDropdownOpen}
        setSkillsDropdownOpen={config.setSkillsDropdownOpen}
        handleToggleSkill={config.handleToggleSkill}
        skillsDropdownRef={config.skillsDropdownRef}
        // MCP
        mcpServers={config.mcpServers}
        activeMcpIds={config.activeMcpIds}
        mcpDropdownOpen={config.mcpDropdownOpen}
        setMcpDropdownOpen={config.setMcpDropdownOpen}
        handleToggleMcpServer={config.handleToggleMcpServer}
        mcpDropdownRef={config.mcpDropdownRef}
        // Sub-Agents
        subAgents={config.subAgents}
        activeSubAgentIds={config.activeSubAgentIds}
        subAgentsDropdownOpen={config.subAgentsDropdownOpen}
        setSubAgentsDropdownOpen={config.setSubAgentsDropdownOpen}
        handleToggleSubAgent={config.handleToggleSubAgent}
        subAgentsDropdownRef={config.subAgentsDropdownRef}
        // Provider / Model / Effort
        activeProviderId={config.activeProviderId}
        providers={config.providers}
        models={config.models}
        activeModel={config.activeModel}
        effort={config.effort}
        effortOptions={config.effortOptions}
        effortDisabled={config.effortDisabled}
        handleProviderChange={config.handleProviderChange}
        handleModelChange={config.handleModelChange}
        setEffort={config.setEffort}
        saveProjectSelections={config.saveProjectSelections}
        // Context usage
        chatUsage={stream.chatUsage}
        chatUsageUpdating={stream.chatUsageUpdating}
        // Commits
        showCommits={showCommits}
        setShowCommits={setShowCommits}
        // Tool Approvals
        toolApprovals={toolApprovalsHook.approvals}
        toggleApproval={toolApprovalsHook.toggleApproval}
        setAllApprovals={toolApprovalsHook.setAll}
        enabledApprovalCount={toolApprovalsHook.enabledCount}
      />

      <SubAgentStreaming
        activeRuns={subAgent.activeRuns}
        subAgentMessages={subAgent.subAgentMessages}
        subAgentStreaming={subAgent.subAgentStreaming}
        selectedTab={subAgent.selectedTab}
        setSelectedTab={subAgent.setSelectedTab}
        subAgentTabsExpanded={subAgent.subAgentTabsExpanded}
        setSubAgentTabsExpanded={subAgent.setSubAgentTabsExpanded}
        cancelSubAgentRun={subAgent.cancelSubAgentRun}
        agentTasks={stream.agentTasks}
        // Task input modal
        subAgentTaskInput={subAgent.subAgentTaskInput}
        setSubAgentTaskInput={subAgent.setSubAgentTaskInput}
        pendingRunAgentId={subAgent.pendingRunAgentId}
        setPendingRunAgentId={subAgent.setPendingRunAgentId}
        selectedContext={subAgent.selectedContext}
        setSelectedContext={subAgent.setSelectedContext}
        subAgentTaskInputRef={subAgent.subAgentTaskInputRef}
        subAgents={config.subAgents}
        activeSessionId={session.activeSessionId}
        startSubAgentRun={subAgent.startSubAgentRun}
      />

      <ChatMessageList
        messages={messages}
        isStreaming={stream.isStreaming}
        streamingParts={stream.streamingParts}
        pendingEdits={stream.pendingEdits}
        agentTasks={stream.agentTasks}
        streamCommits={streamCommits}
        showCommits={showCommits}
        messagesEndRef={stream.messagesEndRef}
        onAcceptEdit={stream.handleAcceptEdit}
        onRejectEdit={stream.handleRejectEdit}
        onViewChanges={(commit) => setViewingCommit(commit)}
      />

      {!showCommits && (
        <ChatInput
          input={stream.input}
          setInput={stream.setInput}
          pendingImages={stream.pendingImages}
          setPendingImages={stream.setPendingImages}
          isStreaming={stream.isStreaming}
          shouldReduceMotion={shouldReduceMotion ?? false}
          handleSend={stream.handleSend}
          handleCancel={stream.handleCancel}
          handleKeyDown={stream.handleKeyDown}
        />
      )}

      {/* Commit Diff Modal */}
      <CommitDiffModal
        commit={viewingCommit}
        onClose={() => setViewingCommit(null)}
      />

      {/* Session List Modal */}
      {session.sessionListOpen && (
        <SessionListModal onClose={() => session.setSessionListOpen(false)} />
      )}
    </div>
  );
}

export default ChatPanel;
