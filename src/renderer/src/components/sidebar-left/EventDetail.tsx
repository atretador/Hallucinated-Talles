import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { EventType } from '../../../../shared/types';
import { useAppStore } from '../../stores';

const typeBadge: Record<string, string> = {
  major: 'bg-red-900 text-red-300',
  minor: 'bg-blue-900 text-blue-300',
  background: 'bg-gray-700 text-gray-300',
};

interface EventDetailProps {
  eventId: string;
  onBack: () => void;
}

export function EventDetail({ eventId, onBack }: EventDetailProps) {
  const { t } = useTranslation('app');
  const { events, characters, setActiveContent, updateEvent, deleteEvent, relations } = useAppStore();
  const event = events.find((e) => e.id === eventId);
  const storyLinks = relations.filter((r) => r.from.id === eventId || r.to.id === eventId);
  const shouldReduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<EventType>('major');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!event) {
    return (
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-blue-400 hover:text-blue-300 mb-3 block"
        >
          {t('sidebarLeft.events.detail.back')}
        </button>
        <div className="text-sm text-gray-500">{t('sidebarLeft.events.detail.notFound')}</div>
      </div>
    );
  }

  const involvedCharacters = characters.filter((c) => event.characters.includes(c.id));

  const handleEdit = () => {
    setEditTitle(event.title);
    setEditDescription(event.description);
    setEditType(event.type);
    setEditTimestamp(event.timestamp || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editDescription.trim()) return;
    setSaving(true);
    try {
      await updateEvent(eventId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        type: editType,
        timestamp: editTimestamp.trim() || undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteEvent(eventId);
      onBack();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <motion.div
      key={eventId}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-blue-400 hover:text-blue-300 mb-3 block"
      >
        {t('sidebarLeft.events.detail.back')}
      </button>

      {editing ? (
        /* ---- Inline edit mode ---- */
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.events.detail.title')}</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.events.detail.description')}</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={5}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.events.detail.type')}</label>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value as EventType)}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            >
              <option value="major">{t('sidebarLeft.events.detail.major')}</option>
              <option value="minor">{t('sidebarLeft.events.detail.minor')}</option>
              <option value="background">{t('sidebarLeft.events.detail.background')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.events.detail.timestamp')}</label>
            <input
              type="text"
              value={editTimestamp}
              onChange={(e) => setEditTimestamp(e.target.value)}
              placeholder={t('sidebarLeft.events.detail.timestampPlaceholder')}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-1.5 text-sm text-white transition-colors"
            >
              {saving ? t('sidebarLeft.events.detail.saving') : t('sidebarLeft.events.detail.save')}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-sm text-gray-300 transition-colors"
            >
              {t('sidebarLeft.events.detail.cancel')}
            </button>
          </div>
        </div>
      ) : (
        /* ---- View mode ---- */
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-gray-100">{event.title}</h3>
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  typeBadge[event.type] ?? 'bg-gray-700 text-gray-300'
                }`}
              >
                {event.type}
              </span>
              <button
                type="button"
                onClick={handleEdit}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {t('sidebarLeft.events.detail.edit')}
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                  >
                    {deleting ? t('sidebarLeft.events.detail.deleting') : t('sidebarLeft.events.detail.confirmDelete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-gray-500 hover:text-gray-400"
                  >
                    {t('sidebarLeft.events.detail.cancelDelete')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {t('sidebarLeft.events.detail.delete')}
                </button>
              )}
            </div>
          </div>

          {event.timestamp && (
            <p className="text-xs text-gray-500 mb-3">{event.timestamp}</p>
          )}

          <p className="text-sm text-gray-300 whitespace-pre-wrap mb-4">
            {event.description}
          </p>

          {/* Characters involved */}
          {involvedCharacters.length > 0 && (
            <section className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.events.detail.charactersInvolved')}
              </h4>
              <div className="space-y-1">
                {involvedCharacters.map((char) => (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => setActiveContent({ kind: 'character', bookId: event?.bookId || '', characterId: char.id })}
                    className="w-full text-left rounded bg-gray-800 hover:bg-gray-700 px-2 py-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {char.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Consequences */}
          {event.consequences.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.events.detail.consequences')}
              </h4>
              <ul className="space-y-1">
                {event.consequences.map((consequence, idx) => (
                  <li
                    key={idx}
                    className="rounded bg-gray-800 px-2 py-1.5 text-sm text-gray-200"
                  >
                    {consequence}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Story Links */}
          {storyLinks.length > 0 && (
            <section className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.events.detail.storyLinks')}
              </h4>
              <div className="space-y-1">
                {storyLinks.map((rel) => (
                  <div key={rel.id} className="rounded bg-gray-800 px-2 py-1.5 text-sm text-gray-200">
                    <span className="text-xs uppercase text-purple-400 mr-2">{rel.type}</span>
                    <span className="text-gray-400">
                      {rel.from.id === eventId ? '\u2192' : '\u2190'}{' '}
                      {rel.from.id === eventId ? rel.to.type : rel.from.type}
                    </span>
                    {rel.label && <span className="text-gray-500 ml-1">({rel.label})</span>}
                    <div className="text-xs text-gray-400 mt-0.5">{rel.description}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {involvedCharacters.length === 0 && event.consequences.length === 0 && storyLinks.length === 0 && (
            <p className="text-xs text-gray-500 mt-4">
              {t('sidebarLeft.events.detail.noExtraData')}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
