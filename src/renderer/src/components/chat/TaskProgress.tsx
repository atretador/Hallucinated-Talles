import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { AgentTask } from '../../../../shared/types';

interface TaskProgressProps {
  tasks: AgentTask[];
}

export function TaskProgress({ tasks }: TaskProgressProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  if (tasks.length === 0) return null;

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const current = tasks.find(t => t.status === 'in_progress' || t.status === 'pending');
  const progressPct = total > 0 ? (completed / total) * 100 : 0;
  const allDone = completed === total;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="border-t border-gray-700"
    >
      {/* Header bar — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        <motion.svg
          className="h-3 w-3"
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </motion.svg>

        {/* Animated progress indicator */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {allDone ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-green-400"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </motion.span>
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
          <span className="font-medium">
            {allDone ? t('chat.taskProgress.allComplete', { ns: 'app' }) : t('chat.taskProgress.taskXofY', { ns: 'app', current: completed + 1, total })}
          </span>
          {current && !allDone && (
            <span className="text-gray-500 truncate">— {current.displayName}</span>
          )}
        </div>

        {/* Mini progress bar */}
        <div className="w-16 h-1.5 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
          <motion.div
            className={`h-full rounded-full ${allDone ? 'bg-green-500' : 'bg-blue-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <span className="text-gray-500 flex-shrink-0">{completed}/{total}</span>
      </button>

      {/* Expanded task list — scrollable */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="max-h-40 overflow-y-auto px-3 pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="flex items-start gap-2 py-1"
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {task.status === 'completed' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <svg className="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    ) : task.status === 'in_progress' ? (
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500" />
                      </span>
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-gray-600" />
                    )}
                  </div>

                  {/* Task label */}
                  <span
                    className={`text-xs leading-tight ${
                      task.status === 'completed'
                        ? 'text-gray-500 line-through'
                        : task.status === 'in_progress'
                        ? 'text-gray-200 font-medium'
                        : 'text-gray-400'
                    }`}
                  >
                    {task.displayName}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
