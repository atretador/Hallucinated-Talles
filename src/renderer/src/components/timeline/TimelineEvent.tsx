import { motion, useReducedMotion } from 'motion/react';
import { useAppStore } from '../../stores';
import type { StoryEvent } from '../../../../shared/types';

const typeBadge: Record<string, string> = {
  major: 'bg-red-900 text-red-300',
  minor: 'bg-blue-900 text-blue-300',
  background: 'bg-gray-700 text-gray-400',
};

interface TimelineEventProps {
  event: StoryEvent;
  onClick: () => void;
}

export function TimelineEvent({ event, onClick }: TimelineEventProps) {
  const { characters } = useAppStore();
  const shouldReduceMotion = useReducedMotion();

  const involvedCharacters = characters.filter((c) => event.characters.includes(c.id));
  const characterNames = involvedCharacters.map((c) => c.name).join(', ');

  const truncatedDescription =
    event.description.length > 80
      ? event.description.slice(0, 80) + '…'
      : event.description;

  return (
    <div className="relative flex flex-col items-center">
      {/* Connector dot and line */}
      <div className="flex items-center">
        <div className="timeline-connector w-4" />
        <button
          type="button"
          onClick={onClick}
          className="timeline-dot"
          data-type={event.type}
          title={event.title}
        />
        <div className="timeline-connector w-4" />
      </div>

      {/* Event card */}
      <motion.button
        type="button"
        onClick={onClick}
        className="timeline-card mt-2 w-48"
        data-type={event.type}
        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-semibold text-gray-100">{event.title}</h4>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
              typeBadge[event.type] ?? 'bg-gray-700 text-gray-400'
            }`}
          >
            {event.type}
          </span>
        </div>

        {event.timestamp && (
          <p className="mb-1 text-xs text-gray-500">{event.timestamp}</p>
        )}

        {characterNames && (
          <p className="mb-1 truncate text-xs text-blue-400">{characterNames}</p>
        )}

        <p className="text-xs text-gray-400">{truncatedDescription}</p>
      </motion.button>
    </div>
  );
}
