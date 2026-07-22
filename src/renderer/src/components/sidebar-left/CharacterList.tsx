import { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { CharacterItem } from './CharacterItem';

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

export function CharacterList({ selectedId, onSelect, onAdd }: { selectedId: string | null; onSelect: (id: string) => void; onAdd: () => void }) {
  const { t } = useTranslation('app');
  const { characters, charactersLoading, charactersError, fetchCharacters } =
    useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const shouldReduceMotion = useReducedMotion();

  const filteredCharacters = characters.filter((char) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      char.name.toLowerCase().includes(q) ||
      char.description.toLowerCase().includes(q) ||
      char.aliases.some(a => a.toLowerCase().includes(q)) ||
      char.attributes.some(attr =>
        attr.key.toLowerCase().includes(q) ||
        attr.values.some(v => v.toLowerCase().includes(q))
      )
    );
  });

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const resolvedContainerVariants: Variants = shouldReduceMotion
    ? { hidden: {}, visible: { transition: { staggerChildren: 0, delayChildren: 0 } } }
    : containerVariants;

  const resolvedItemVariants: Variants = shouldReduceMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : itemVariants;

  return (
    <div>
      <motion.div key="list">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-100">{t('sidebarLeft.characters.title')}</h3>
          <button
            type="button"
            onClick={onAdd}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('sidebarLeft.characters.add')}
          </button>
        </div>

        <div className="mb-2">
          <input
            type="text"
            placeholder={t('sidebarLeft.characters.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-gray-800 text-gray-200 rounded px-2 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {charactersLoading && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.characters.loading')}</div>
        )}

        {charactersError && (
          <div className="text-xs text-red-400 py-2">{t('sidebarLeft.characters.error', { error: charactersError })}</div>
        )}

        {!charactersLoading && !charactersError && characters.length === 0 && !searchQuery.trim() && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.characters.empty')}</div>
        )}

        {!charactersLoading && !charactersError && searchQuery.trim() && filteredCharacters.length === 0 && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.characters.noSearchResults')}</div>
        )}

        <motion.div
          className="space-y-1"
          variants={resolvedContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredCharacters.map((char) => (
            <motion.div key={char.id} variants={resolvedItemVariants}>
              <CharacterItem
                character={char}
                isSelected={selectedId === char.id}
                onClick={() => onSelect(char.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
