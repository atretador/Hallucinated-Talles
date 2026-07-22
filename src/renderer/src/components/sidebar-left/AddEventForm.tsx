import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import type { EventType } from '../../../../shared/types';

interface AddEventFormProps {
  onDone: () => void;
  onCancel: () => void;
}

export function AddEventForm({ onDone, onCancel }: AddEventFormProps) {
  const { t } = useTranslation('app');
  const { addEvent, activeBookId } = useAppStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('minor');
  const [timestamp, setTimestamp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await addEvent({
        bookId: activeBookId || '',
        title: title.trim(),
        description: description.trim(),
        type: eventType,
        timestamp: timestamp.trim() || 'unknown',
        characters: [],
        consequences: [],
        sortOrder: 0,
        locations: [],
      });
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = title.trim().length > 0 && description.trim().length > 0;

  return (
    <motion.div
      layout={!shouldReduceMotion}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
    >
      <h3 className="text-sm font-semibold text-gray-100 mb-3">{t('sidebarLeft.events.addForm.title')}</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.events.addForm.name')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('sidebarLeft.events.addForm.titlePlaceholder')}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.events.addForm.description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('sidebarLeft.events.addForm.descriptionPlaceholder')}
            rows={4}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.events.addForm.type')}</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
          >
            <option value="major">{t('sidebarLeft.events.addForm.major')}</option>
            <option value="minor">{t('sidebarLeft.events.addForm.minor')}</option>
            <option value="background">{t('sidebarLeft.events.addForm.background')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.events.addForm.timestamp')}</label>
          <input
            type="text"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            placeholder={t('sidebarLeft.events.addForm.timestampPlaceholder')}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-1.5 text-sm text-white transition-colors"
          >
            {submitting ? t('sidebarLeft.events.addForm.saving') : t('sidebarLeft.events.addForm.save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-sm text-gray-300 transition-colors"
          >
            {t('sidebarLeft.events.addForm.cancel')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
