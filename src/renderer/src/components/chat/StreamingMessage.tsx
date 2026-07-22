import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { ChatMessagePart, ToolCall } from '../../../../shared/types';
import { ToolCallDisplay } from './ToolCallDisplay';
import { MarkdownRenderer } from './MarkdownRenderer';

function appendTextPart(parts: ChatMessagePart[], type: 'text' | 'thinking', content: string): ChatMessagePart[] {
  const next = [...parts];
  const last = next[next.length - 1];
  if (last?.type === type) {
    next[next.length - 1] = { ...last, content: last.content + content };
  } else {
    next.push({ type, content });
  }
  return next;
}

function appendToolPart(parts: ChatMessagePart[], toolCall: ToolCall): ChatMessagePart[] {
  return [...parts, { type: 'tool_call', toolCall }];
}

function updateToolPart(parts: ChatMessagePart[], id: string, result: unknown): ChatMessagePart[] {
  return parts.map((part) =>
    part.type === 'tool_call' && part.toolCall.id === id
      ? { ...part, toolCall: { ...part.toolCall, result } }
      : part,
  );
}

export { appendTextPart, appendToolPart, updateToolPart };

interface StreamingMessageProps {
  parts: ChatMessagePart[];
}

export function StreamingMessage({ parts }: StreamingMessageProps) {
  const { t } = useTranslation('app');
  const shouldReduceMotion = useReducedMotion();
  const [openThinking, setOpenThinking] = useState<Set<number>>(() => new Set());

  // Show thinking dots when there's no content AND no reasoning yet
  if (parts.length === 0) {
    return (
      <div className="flex justify-start">
        <div className="rounded-lg bg-gray-700 px-3 py-2 text-gray-100">
          {shouldReduceMotion ? (
            <span>{t('chat.streaming.thinkingEllipsis')}</span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 animate-bounce-dot rounded-full bg-gray-400" style={{ animationDelay: '0s' }} />
              <span className="inline-block h-1.5 w-1.5 animate-bounce-dot rounded-full bg-gray-400" style={{ animationDelay: '0.16s' }} />
              <span className="inline-block h-1.5 w-1.5 animate-bounce-dot rounded-full bg-gray-400" style={{ animationDelay: '0.32s' }} />
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2 rounded-lg bg-gray-700 px-3 py-2 text-gray-100">
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <div key={`text-${index}`} className="break-words text-sm">
                <MarkdownRenderer content={part.content} />
              </div>
            );
          }

          if (part.type === 'tool_call') {
            return <ToolCallDisplay key={part.toolCall.id} toolCall={part.toolCall} />;
          }

          const isOpen = openThinking.has(index);
          return (
            <div key={`thinking-${index}`} className="rounded-lg border border-purple-500/20 bg-purple-950/20 px-2.5 py-2">
              <button
                onClick={() => {
                  setOpenThinking(prev => {
                    const next = new Set(prev);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  });
                }}
                className="flex items-center gap-1.5 text-xs text-purple-200/80 hover:text-purple-100 transition-colors"
              >
                <svg
                  className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>{t('chat.streaming.thinking')}</span>
                {!isOpen && !shouldReduceMotion && index === parts.length - 1 && (
                  <span className="ml-1 flex items-center gap-0.5">
                    <span className="inline-block h-1 w-1 animate-bounce-dot rounded-full bg-purple-300/70" style={{ animationDelay: '0s' }} />
                    <span className="inline-block h-1 w-1 animate-bounce-dot rounded-full bg-purple-300/70" style={{ animationDelay: '0.16s' }} />
                    <span className="inline-block h-1 w-1 animate-bounce-dot rounded-full bg-purple-300/70" style={{ animationDelay: '0.32s' }} />
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="mt-1.5 max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded bg-gray-950/30 px-2.5 py-2 text-xs text-purple-100/70">
                  {part.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
