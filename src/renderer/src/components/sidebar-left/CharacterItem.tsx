import { motion, useReducedMotion } from 'motion/react';
import type { Character } from '../../../../shared/types';

interface CharacterItemProps {
  character: Character;
  isSelected: boolean;
  onClick: () => void;
}

export function CharacterItem({ character, isSelected, onClick }: CharacterItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const descPreview =
    character.description.length > 60
      ? character.description.slice(0, 60) + '…'
      : character.description;

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
      <div className="text-sm font-medium text-gray-100 truncate">{character.name}</div>
      {descPreview && (
        <div className="text-xs text-gray-400 truncate mt-0.5">{descPreview}</div>
      )}
    </motion.button>
  );
}
