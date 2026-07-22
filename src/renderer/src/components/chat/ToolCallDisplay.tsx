import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { ToolCall } from '../../../../shared/types';

interface ToolCallDisplayProps {
  toolCall: ToolCall;
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const { t } = useTranslation('app');
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const argsStr = JSON.stringify(toolCall.args, null, 2);
  const resultStr = toolCall.result !== undefined
    ? JSON.stringify(toolCall.result, null, 2)
    : null;

  return (
    <div className="mt-2 rounded border border-gray-600 bg-gray-800 text-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-1 px-2 py-1 font-mono text-gray-300 hover:text-gray-100"
      >
        <span
          className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
        <span className="font-semibold text-cyan-400">{toolCall.name}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={toolCall.id}
            layout={shouldReduceMotion ? false : true}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            className="border-t border-gray-700 px-2 py-1"
          >
            <div className="mb-1 font-medium text-gray-400">{t('chat.toolCall.arguments')}</div>
            <pre className="overflow-x-auto text-gray-300">{argsStr}</pre>

            {resultStr !== null && (
              <>
                <div className="mb-1 mt-2 font-medium text-gray-400">{t('chat.toolCall.result')}</div>
                <pre className="overflow-x-auto text-gray-300">{resultStr}</pre>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
