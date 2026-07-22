import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoryRelation, Character, StoryEvent, WorldData, EntityRef } from '../../../../shared/types';

const COMMON_TYPES = [
  'ally', 'enemy', 'family', 'mentor', 'romantic',
  'member_of', 'located_in', 'owns', 'affected_by', 'created_by', 'heard_of',
];

interface RelationEditorProps {
  /** Entity ID this relation is for (will be the "from" entity) */
  characterId: string;
  /** Entity kind of the "from" entity — defaults to 'character' for backward compatibility */
  fromEntityType?: 'character' | 'event' | 'worldData';
  /** Existing relations to display/edit */
  relations: StoryRelation[];
  /** Called when a relation is added */
  onAdd: (relation: Omit<StoryRelation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  /** Called when a relation is deleted */
  onDelete: (relationId: string) => void;
  /** Available characters for target selection */
  characters: Character[];
  /** Available events for target selection */
  events: StoryEvent[];
  /** Available world data for target selection */
  worldData: WorldData[];
}

function resolveEntityName(ref: EntityRef, characters: Character[], events: StoryEvent[], worldData: WorldData[]): string {
  switch (ref.type) {
    case 'character':
      return characters.find((c) => c.id === ref.id)?.name ?? ref.id;
    case 'event':
      return events.find((e) => e.id === ref.id)?.title ?? ref.id;
    case 'worldData':
      return worldData.find((w) => w.id === ref.id)?.name ?? ref.id;
    default:
      return ref.id;
  }
}

export function RelationEditor({
  characterId,
  fromEntityType = 'character',
  relations,
  onAdd,
  onDelete,
  characters,
  events,
  worldData,
}: RelationEditorProps) {
  const { t } = useTranslation('app');
  const [targetType, setTargetType] = useState<'character' | 'event' | 'worldData'>('character');
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [typeSuggestions, setTypeSuggestions] = useState(false);

  const filteredTargets = useMemo(() => {
    switch (targetType) {
      case 'character':
        return characters.filter((c) => c.id !== characterId).map((c) => ({ id: c.id, name: c.name }));
      case 'event':
        return events.map((e) => ({ id: e.id, name: e.title }));
      case 'worldData':
        return worldData.map((w) => ({ id: w.id, name: w.name }));
      default:
        return [];
    }
  }, [targetType, characters, events, worldData, characterId]);

  const filteredTypeSuggestions = useMemo(() => {
    if (!relType) return COMMON_TYPES;
    return COMMON_TYPES.filter((t) => t.includes(relType.toLowerCase()));
  }, [relType]);

  const handleAdd = () => {
    if (!targetId || !relType.trim() || !description.trim()) return;
    onAdd({
      bookId: '',
      from: { type: fromEntityType, id: characterId },
      to: { type: targetType, id: targetId },
      type: relType.trim(),
      label: label.trim() || undefined,
      description: description.trim(),
    });
    setTargetId('');
    setRelType('');
    setLabel('');
    setDescription('');
    setTypeSuggestions(false);
  };

  const canAdd = targetId && relType.trim().length > 0 && description.trim().length > 0;

  return (
    <div>
      {/* Existing relations */}
      {relations.length > 0 && (
        <div className="space-y-1 mb-2">
          {relations.map((rel) => (
            <div key={rel.id} className="rounded bg-gray-800 border border-gray-700 px-2 py-1.5 flex items-start gap-1.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs uppercase text-purple-400 shrink-0">{rel.type}</span>
                  <span className="text-xs text-gray-400">
                    {rel.from.id === characterId ? '\u2192' : '\u2190'}{' '}
                    {resolveEntityName(rel.from.id === characterId ? rel.to : rel.from, characters, events, worldData)}
                  </span>
                  {rel.label && <span className="text-xs text-gray-500">({rel.label})</span>}
                </div>
                {rel.description && (
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{rel.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDelete(rel.id)}
                className="text-xs text-red-400 hover:text-red-300 px-1 shrink-0"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="space-y-2">
        {/* Target type */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.relationEditor.targetType')}</label>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as 'character' | 'event' | 'worldData');
              setTargetId('');
            }}
            className="w-full rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 focus-ring"
          >
            <option value="character">{t('sidebarLeft.relationEditor.character')}</option>
            <option value="event">{t('sidebarLeft.relationEditor.event')}</option>
            <option value="worldData">{t('sidebarLeft.relationEditor.worldData')}</option>
          </select>
        </div>

        {/* Target entity */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.relationEditor.target')}</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 focus-ring"
          >
            <option value="">{t('sidebarLeft.relationEditor.selectTarget')}</option>
            {filteredTargets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Relation type with autocomplete */}
        <div className="relative">
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.relationEditor.relationType')}</label>
          <input
            type="text"
            value={relType}
            onChange={(e) => {
              setRelType(e.target.value);
              setTypeSuggestions(true);
            }}
            onFocus={() => setTypeSuggestions(true)}
            onBlur={() => setTimeout(() => setTypeSuggestions(false), 150)}
            placeholder={t('sidebarLeft.relationEditor.relationTypePlaceholder')}
            className="w-full rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
          />
          {typeSuggestions && filteredTypeSuggestions.length > 0 && (
            <div className="absolute z-10 mt-0.5 w-full rounded bg-gray-800 border border-gray-600 max-h-28 overflow-y-auto">
              {filteredTypeSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setRelType(s);
                    setTypeSuggestions(false);
                  }}
                  className="block w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Label */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.relationEditor.label')}</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('sidebarLeft.relationEditor.labelPlaceholder')}
            className="w-full rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.relationEditor.description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('sidebarLeft.relationEditor.descriptionPlaceholder')}
            rows={2}
            className="w-full rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring resize-none"
          />
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('sidebarLeft.relationEditor.addRelation')}
        </button>
      </div>
    </div>
  );
}
