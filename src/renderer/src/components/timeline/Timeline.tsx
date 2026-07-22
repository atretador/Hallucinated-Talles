import { useEffect, useState, useMemo } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { TimelineEvent } from './TimelineEvent';
import { TimelineFilters } from './TimelineFilters';
import type { EventType } from '../../../../shared/types';

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

export function Timeline() {
  const { t } = useTranslation('app');
  const { events, fetchEvents, setActiveContent } = useAppStore();

  const [selectedType, setSelectedType] = useState<EventType | 'all'>('all');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [showBackground, setShowBackground] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.sortOrder - b.sortOrder),
    [events],
  );

  const shouldReduceMotion = useReducedMotion();

  const resolvedContainerVariants: Variants = shouldReduceMotion
    ? { hidden: {}, visible: { transition: { staggerChildren: 0, delayChildren: 0 } } }
    : containerVariants;

  const resolvedItemVariants: Variants = shouldReduceMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : itemVariants;

  const filteredEvents = useMemo(
    () =>
      sortedEvents.filter((event) => {
        if (!showBackground && event.type === 'background') {
          return false;
        }
        if (selectedType !== 'all' && event.type !== selectedType) {
          return false;
        }
        if (selectedCharacter && !event.characters.includes(selectedCharacter)) {
          return false;
        }
        return true;
      }),
    [sortedEvents, selectedType, selectedCharacter, showBackground],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-200">{t('timeline.title')}</h2>
        <TimelineFilters
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedCharacter={selectedCharacter}
          onCharacterChange={setSelectedCharacter}
          showBackground={showBackground}
          onShowBackgroundChange={setShowBackground}
        />
      </div>

      {/* Timeline scroll area */}
      <div className="flex-1 overflow-x-auto p-4">
        {filteredEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            {events.length === 0 ? t('timeline.noEvents') : t('timeline.noEventsMatch')}
          </div>
        ) : (
          <motion.div
            className="flex items-start gap-2 min-w-max timeline-scroll-container"
            variants={resolvedContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Leading spacer */}
            <div className="w-4 shrink-0" />

            {filteredEvents.map((event, index) => (
              <motion.div key={event.id} className="flex items-start" variants={resolvedItemVariants}>
                <TimelineEvent
                  event={event}
                  onClick={() => setActiveContent({ kind: 'event', bookId: event.bookId, eventId: event.id })}
                />
                {/* Connector between cards */}
                {index < filteredEvents.length - 1 && (
                  <div className="mx-2 mt-7 timeline-connector w-6 shrink-0" />
                )}
              </motion.div>
            ))}

            {/* Trailing spacer */}
            <div className="w-4 shrink-0" />
          </motion.div>
        )}
      </div>
    </div>
  );
}
