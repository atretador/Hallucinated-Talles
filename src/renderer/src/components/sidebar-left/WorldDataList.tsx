import { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { WorldDataItem } from './WorldDataItem';

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

export function WorldDataList({ selectedId, onSelect, onAdd }: { selectedId: string | null; onSelect: (id: string) => void; onAdd: () => void }) {
  const { t } = useTranslation('app');
  const { worldData, worldDataLoading, worldDataError, fetchWorldData } =
    useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const shouldReduceMotion = useReducedMotion();

  const filteredWorldData = worldData.filter((entry) => {
    const matchesCategory = !categoryFilter || entry.category === categoryFilter;
    if (!searchQuery.trim()) return matchesCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      entry.name.toLowerCase().includes(q) ||
      entry.shortDescription.toLowerCase().includes(q) ||
      entry.content.toLowerCase().includes(q) ||
      (entry.aliases && entry.aliases.some(a => a.toLowerCase().includes(q))) ||
      (entry.tags && entry.tags.some(t => t.toLowerCase().includes(q))) ||
      (entry.attributes && entry.attributes.some(a =>
        a.key.toLowerCase().includes(q) || a.value.toLowerCase().includes(q)
      ))
    );
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    fetchWorldData();
  }, [fetchWorldData]);

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
          <h3 className="text-sm font-semibold text-gray-100">{t('sidebarLeft.worldData.title')}</h3>
          <button
            type="button"
            onClick={onAdd}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('sidebarLeft.worldData.add')}
          </button>
        </div>

        <div className="mb-2 flex gap-1">
          <input
            type="text"
            placeholder={t('sidebarLeft.worldData.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs bg-gray-800 text-gray-200 rounded px-2 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-gray-800 text-gray-200 rounded px-1.5 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">{t('sidebarLeft.worldData.categoryFilter.all')}</option>
            <option value="place">{t('sidebarLeft.worldData.categoryFilter.place')}</option>
            <option value="organization">{t('sidebarLeft.worldData.categoryFilter.organization')}</option>
            <option value="faction">{t('sidebarLeft.worldData.categoryFilter.faction')}</option>
            <option value="culture">{t('sidebarLeft.worldData.categoryFilter.culture')}</option>
            <option value="artifact">{t('sidebarLeft.worldData.categoryFilter.artifact')}</option>
            <option value="system">{t('sidebarLeft.worldData.categoryFilter.system')}</option>
            <option value="lore">{t('sidebarLeft.worldData.categoryFilter.lore')}</option>
            <option value="species">{t('sidebarLeft.worldData.categoryFilter.species')}</option>
            <option value="resource">{t('sidebarLeft.worldData.categoryFilter.resource')}</option>
            <option value="technology">{t('sidebarLeft.worldData.categoryFilter.technology')}</option>
            <option value="magic">{t('sidebarLeft.worldData.categoryFilter.magic')}</option>
            <option value="cultivation">{t('sidebarLeft.worldData.categoryFilter.cultivation')}</option>
            <option value="other">{t('sidebarLeft.worldData.categoryFilter.other')}</option>
          </select>
        </div>

        {worldDataLoading && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.worldData.loading')}</div>
        )}

        {worldDataError && (
          <div className="text-xs text-red-400 py-2">{t('sidebarLeft.worldData.error', { error: worldDataError })}</div>
        )}

        {!worldDataLoading && !worldDataError && worldData.length === 0 && !searchQuery.trim() && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.worldData.empty')}</div>
        )}

        {!worldDataLoading && !worldDataError && searchQuery.trim() && filteredWorldData.length === 0 && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.worldData.noSearchResults')}</div>
        )}

        <motion.div
          className="space-y-1"
          variants={resolvedContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredWorldData.map((entry) => (
            <motion.div key={entry.id} variants={resolvedItemVariants}>
              <WorldDataItem
                entry={entry}
                isSelected={selectedId === entry.id}
                onClick={() => onSelect(entry.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
