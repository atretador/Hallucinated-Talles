import { motion, useReducedMotion } from 'motion/react';
import type { WorldData } from '../../../../shared/types';

interface WorldDataItemProps {
  entry: WorldData;
  isSelected: boolean;
  onClick: () => void;
}

export function WorldDataItem({ entry, isSelected, onClick }: WorldDataItemProps) {
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
      <div className="text-sm font-medium text-gray-100 truncate">
        {entry.name}
        {entry.category && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 ml-1">
            {entry.category}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-400 truncate mt-0.5">{entry.shortDescription}</div>
    </motion.button>
  );
}
