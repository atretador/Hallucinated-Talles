import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage as ChatMessageType, ChatMessagePart } from '../../../../shared/types';
import { ToolCallDisplay } from './ToolCallDisplay';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [openThinking, setOpenThinking] = useState<Set<number>>(() => new Set());

  if (message.role === 'system') {
    // Hide sub-agent result messages — they're injected into session history for the LLM
    // but should not be visible in the chat UI
    if (message.content.startsWith('[Sub-Agent Result]')) {
      return null;
    }
    return (
      <motion.div
        className="text-center text-sm italic text-gray-500"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
      >
        {message.content}
      </motion.div>
    );
  }

  const isUser = message.role === 'user';
  const parts: ChatMessagePart[] = message.parts ?? [];

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-100'
        }`}
      >
        <div className="break-words text-sm">
          {/* Display images for user messages */}
          {isUser && message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.images.map((img, i) => (
                <img key={i} src={img} alt={t('chat.input.attachmentLabel', { ns: 'app', index: i + 1 })} className="max-h-48 rounded-lg object-cover" />
              ))}
            </div>
          )}
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="space-y-2">
              {parts.map((part, index) => {
                if (part.type === 'text') {
                  return <MarkdownRenderer key={`text-${index}`} content={part.content} />;
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
                      <span>{t('chat.message.thinking', { ns: 'app' })}</span>
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
          )}
        </div>
      </motion.div>
    </div>
  );
}
