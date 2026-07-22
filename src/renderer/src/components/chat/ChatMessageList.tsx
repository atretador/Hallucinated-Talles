import { useTranslation } from 'react-i18next';
import { CommitCard } from './CommitCard';
import { CommitTimeline } from './CommitTimeline';
import { ChatMessage } from './ChatMessage';
import { StreamingMessage } from './StreamingMessage';
import { PendingEdit } from './PendingEdit';
import { TaskProgress } from './TaskProgress';
import type { ChatMessage as ChatMessageType, ChatMessagePart, PendingEdit as PendingEditType, AgentTask, SessionCommit } from '../../../../shared/types';

interface ChatMessageListProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  streamingParts: ChatMessagePart[];
  pendingEdits: PendingEditType[];
  agentTasks: AgentTask[];
  streamCommits: SessionCommit[];
  showCommits: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onAcceptEdit: (editId: string) => Promise<void>;
  onRejectEdit: (editId: string) => Promise<void>;
  onViewChanges: (commit: SessionCommit) => void;
}

export function ChatMessageList({
  messages,
  isStreaming,
  streamingParts,
  pendingEdits,
  agentTasks,
  streamCommits,
  showCommits,
  messagesEndRef,
  onAcceptEdit,
  onRejectEdit,
  onViewChanges,
}: ChatMessageListProps) {
  const { t } = useTranslation();
  if (showCommits) {
    return <CommitTimeline onViewChanges={onViewChanges} />;
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          {messages.length === 0 && !isStreaming && (
            <div className="py-8 text-center text-sm text-gray-500">
              {t('chat.emptyState', { ns: 'app' })}
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isStreaming && (
            <StreamingMessage parts={streamingParts} />
          )}
          {streamCommits.map((commit) => (
            <CommitCard
              key={commit.id}
              commit={commit}
              onViewChanges={onViewChanges}
            />
          ))}
          {pendingEdits.map((edit) => (
            <PendingEdit
              key={edit.id}
              edit={edit}
              onAccept={onAcceptEdit}
              onReject={onRejectEdit}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Agent Task Progress */}
      {agentTasks.length > 0 && <TaskProgress tasks={agentTasks} />}
    </>
  );
}
