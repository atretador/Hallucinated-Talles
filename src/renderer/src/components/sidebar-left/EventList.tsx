import { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { EventItem } from './EventItem';

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

export function EventList({ selectedId, onSelect, onAdd }: { selectedId: string | null; onSelect: (id: string) => void; onAdd: () => void }) {
  const { t } = useTranslation('app');
  const { events, eventsLoading, eventsError, fetchEvents } =
    useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const shouldReduceMotion = useReducedMotion();

  const filteredEvents = events.filter((evt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      evt.title.toLowerCase().includes(q) ||
      evt.description.toLowerCase().includes(q) ||
      evt.type.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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
          <h3 className="text-sm font-semibold text-gray-100">{t('sidebarLeft.events.title')}</h3>
          <button
            type="button"
            onClick={onAdd}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('sidebarLeft.events.add')}
          </button>
        </div>

        <div className="mb-2">
          <input
            type="text"
            placeholder={t('sidebarLeft.events.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-gray-800 text-gray-200 rounded px-2 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {eventsLoading && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.events.loading')}</div>
        )}

        {eventsError && (
          <div className="text-xs text-red-400 py-2">{t('sidebarLeft.events.error', { error: eventsError })}</div>
        )}

        {!eventsLoading && !eventsError && events.length === 0 && !searchQuery.trim() && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.events.empty')}</div>
        )}

        {!eventsLoading && !eventsError && searchQuery.trim() && filteredEvents.length === 0 && (
          <div className="text-xs text-gray-500 py-2">{t('sidebarLeft.events.noSearchResults')}</div>
        )}

        <motion.div
          className="space-y-1"
          variants={resolvedContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredEvents.map((evt) => (
            <motion.div key={evt.id} variants={resolvedItemVariants}>
              <EventItem
                event={evt}
                isSelected={selectedId === evt.id}
                onClick={() => onSelect(evt.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
