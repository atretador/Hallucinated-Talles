import { motion, useReducedMotion } from 'motion/react';
import type { StoryEvent } from '../../../../shared/types';

const typeStyles: Record<string, string> = {
  major: 'bg-red-900 text-red-300',
  minor: 'bg-blue-900 text-blue-300',
  background: 'bg-gray-700 text-gray-300',
};

interface EventItemProps {
  event: StoryEvent;
  isSelected: boolean;
  onClick: () => void;
}

export function EventItem({ event, isSelected, onClick }: EventItemProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md ${
        isSelected
          ? 'bg-gray-700 border-l-2 border-blue-400'
          : 'bg-gray-800 hover:bg-gray-700 border-l-2 border-transparent'
      }`}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-100 truncate">{event.title}</span>
        <span
          className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
            typeStyles[event.type] ?? 'bg-gray-700 text-gray-300'
          }`}
        >
          {event.type}
        </span>
      </div>
      {event.timestamp && (
        <div className="text-xs text-gray-500 mt-0.5 truncate">{event.timestamp}</div>
      )}
    </motion.button>
  );
}
