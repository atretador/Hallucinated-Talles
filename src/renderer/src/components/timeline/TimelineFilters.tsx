import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import type { EventType } from '../../../../shared/types';

interface TimelineFiltersProps {
  selectedType: EventType | 'all';
  onTypeChange: (type: EventType | 'all') => void;
  selectedCharacter: string | null;
  onCharacterChange: (characterId: string | null) => void;
  showBackground: boolean;
  onShowBackgroundChange: (show: boolean) => void;
}

const filterButtonBase =
  'rounded px-2 py-1 text-xs font-medium transition-colors';
const filterButtonActive = 'bg-gray-700 text-gray-100';
const filterButtonInactive =
  'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200';

export function TimelineFilters({
  selectedType,
  onTypeChange,
  selectedCharacter,
  onCharacterChange,
  showBackground,
  onShowBackgroundChange,
}: TimelineFiltersProps) {
  const { characters } = useAppStore();
  const shouldReduceMotion = useReducedMotion();
  const { t } = useTranslation('app');

  const typeOptions: { value: EventType | 'all'; label: string }[] = [
    { value: 'all', label: t('timeline.filters.all') },
    { value: 'major', label: t('timeline.filters.major') },
    { value: 'minor', label: t('timeline.filters.minor') },
    { value: 'background', label: t('timeline.filters.background') },
  ];

  return (
    <div className="flex items-center gap-3">
      {/* Type filter */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">{t('timeline.filters.type')}</span>
        {typeOptions.map((opt) => (
          <motion.button
            key={opt.value}
            type="button"
            onClick={() => onTypeChange(opt.value)}
            className={`${filterButtonBase} ${
              selectedType === opt.value ? filterButtonActive : filterButtonInactive
            } focus-ring`}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            {opt.label}
          </motion.button>
        ))}
      </div>

      {/* Character filter */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">{t('timeline.filters.character')}</span>
        <select
          value={selectedCharacter ?? ''}
          onChange={(e) => onCharacterChange(e.target.value || null)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus-ring"
        >
          <option value="">{t('timeline.filters.all')}</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Background toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={showBackground}
          onChange={(e) => onShowBackgroundChange(e.target.checked)}
          className="rounded border-gray-600 bg-gray-800 text-blue-500 focus-ring"
        />
        <span className="text-xs text-gray-400">{t('timeline.filters.showBackground')}</span>
      </label>
    </div>
  );
}
