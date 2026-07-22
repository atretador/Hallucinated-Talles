import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { RelationEditor } from './RelationEditor';
import type { CharacterAttribute, StoryRelation } from '../../../../shared/types';

interface CharacterDetailProps {
  characterId: string;
  onBack: () => void;
}

export function CharacterDetail({ characterId, onBack }: CharacterDetailProps) {
  const { t } = useTranslation('app');
  const { characters, events, worldData, updateCharacter, deleteCharacter, relations, addRelation, deleteRelation } = useAppStore();
  const character = characters.find((c) => c.id === characterId);
  const storyLinks = relations.filter((r) => r.from.id === characterId || r.to.id === characterId);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAttributes, setEditAttributes] = useState<CharacterAttribute[]>([]);
  const [editRelations, setEditRelations] = useState<StoryRelation[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingStoryLinkId, setDeletingStoryLinkId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const resolveEntityName = (type: string, id: string): string => {
    switch (type) {
      case 'character':
        return characters.find((c) => c.id === id)?.name ?? id;
      case 'event':
        return events.find((e) => e.id === id)?.title ?? id;
      case 'worldData':
        return worldData.find((w) => w.id === id)?.name ?? id;
      default:
        return id;
    }
  };

  if (!character) {
    return (
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-blue-400 hover:text-blue-300 mb-3 block"
        >
          {t('sidebarLeft.characters.detail.back')}
        </button>
        <div className="text-sm text-gray-500">{t('sidebarLeft.characters.detail.notFound')}</div>
      </div>
    );
  }

  const handleEdit = () => {
    setEditName(character.name);
    setEditDescription(character.description);
    setEditAttributes((character.attributes ?? []).map((a) => ({ ...a })));
    setEditRelations(storyLinks.map((r) => ({ ...r })));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim() || !editDescription.trim()) return;
    setSaving(true);
    try {
      await updateCharacter(characterId, {
        name: editName.trim(),
        description: editDescription.trim(),
        attributes: editAttributes.filter((a) => a.key.trim()),
      });
      // Create any pending relations (those with temp IDs)
      const pending = editRelations.filter((r) => r.id.startsWith('pending-rel-'));
      for (const rel of pending) {
        await addRelation({
          bookId: rel.bookId,
          from: rel.from,
          to: rel.to,
          type: rel.type,
          label: rel.label,
          description: rel.description,
        });
      }
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
      await deleteCharacter(characterId);
      onBack();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <motion.div
      key={characterId}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-blue-400 hover:text-blue-300 mb-3 block"
      >
        {t('sidebarLeft.characters.detail.back')}
      </button>

      {editing ? (
        /* ---- Inline edit mode ---- */
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.characters.detail.name')}</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.characters.detail.description')}</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={5}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring resize-none"
            />
          </div>

          {/* Attributes editor */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.characters.detail.attributes')}</label>
            <div className="space-y-2">
              {editAttributes.map((attr, attrIdx) => (
                <div key={attr.id} className="rounded bg-gray-800 border border-gray-700 p-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    <input
                      type="text"
                      value={attr.key}
                      onChange={(e) => {
                        const next = [...editAttributes];
                        next[attrIdx] = { ...next[attrIdx], key: e.target.value };
                        setEditAttributes(next);
                      }}
                      placeholder={t('sidebarLeft.characters.detail.groupNamePlaceholder')}
                      className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setEditAttributes(editAttributes.filter((_, i) => i !== attrIdx))}
                      className="text-xs text-red-400 hover:text-red-300 px-1"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="space-y-1">
                    {attr.values.map((val, valIdx) => (
                      <div key={valIdx} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const next = [...editAttributes];
                            const newValues = [...next[attrIdx].values];
                            newValues[valIdx] = e.target.value;
                            next[attrIdx] = { ...next[attrIdx], values: newValues };
                            setEditAttributes(next);
                          }}
                          placeholder={t('sidebarLeft.characters.detail.valuePlaceholder')}
                          className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...editAttributes];
                            next[attrIdx] = {
                              ...next[attrIdx],
                              values: next[attrIdx].values.filter((_, i) => i !== valIdx),
                            };
                            setEditAttributes(next);
                          }}
                          className="text-xs text-gray-500 hover:text-red-400 px-1"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...editAttributes];
                        next[attrIdx] = { ...next[attrIdx], values: [...next[attrIdx].values, ''] };
                        setEditAttributes(next);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                    >
                      {t('sidebarLeft.characters.detail.addValue')}
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setEditAttributes([
                    ...editAttributes,
                    { id: `attr-new-${Date.now()}`, key: '', values: [''] },
                  ])
                }
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {t('sidebarLeft.characters.detail.addAttributeGroup')}
              </button>
            </div>
          </div>

          {/* Relations editor */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.characters.detail.storyLinks')}</label>
            <RelationEditor
              characterId={characterId}
              relations={editRelations}
              onAdd={(rel) =>
                setEditRelations((prev) => [
                  ...prev,
                  {
                    ...rel,
                    id: `pending-rel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ])
              }
              onDelete={(id) => {
                // If it's a pending relation (not yet saved), just remove from local state
                if (id.startsWith('pending-rel-')) {
                  setEditRelations((prev) => prev.filter((r) => r.id !== id));
                } else {
                  // It's an existing relation — delete via store immediately
                  deleteRelation(id);
                  setEditRelations((prev) => prev.filter((r) => r.id !== id));
                }
              }}
              characters={characters}
              events={events}
              worldData={worldData}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-1.5 text-sm text-white transition-colors"
            >
              {saving ? t('sidebarLeft.characters.detail.saving') : t('sidebarLeft.characters.detail.save')}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-sm text-gray-300 transition-colors"
            >
              {t('sidebarLeft.characters.detail.cancel')}
            </button>
          </div>
        </div>
      ) : (
        /* ---- View mode ---- */
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-gray-100">{character.name}</h3>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">{t('sidebarLeft.characters.detail.areYouSure')}</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                >
                  {deleting ? t('sidebarLeft.characters.detail.deleting') : t('sidebarLeft.characters.detail.confirmDelete')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-40"
                >
                  {t('sidebarLeft.characters.detail.cancelDelete')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {t('sidebarLeft.characters.detail.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {t('sidebarLeft.characters.detail.delete')}
                </button>
              </div>
            )}
          </div>

          {character.aliases.length > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              <span className="text-gray-400">{t('sidebarLeft.characters.detail.alsoKnownAs')}</span>{' '}
              {character.aliases.join(', ')}
            </p>
          )}

          <p className="text-sm text-gray-300 whitespace-pre-wrap mb-4">
            {character.description}
          </p>

          {/* Attributes */}
          {(character.attributes ?? []).length > 0 && (
            <section className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.characters.detail.attributes')}
              </h4>
              <div className="space-y-2">
                {(character.attributes ?? []).map((attr) => (
                  <div key={attr.id} className="rounded bg-gray-800 p-2">
                    <div className="text-xs font-medium text-gray-300 mb-1">{attr.key}</div>
                    <div className="flex flex-wrap gap-1">
                      {attr.values.map((val, i) => (
                        <span
                          key={i}
                          className="inline-block rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-200"
                        >
                          {val}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Entries */}
          {character.entries.length > 0 && (
            <section className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.characters.detail.entries')}
              </h4>
              <div className="space-y-2">
                {character.entries
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                  )
                  .map((entry) => (
                    <div key={entry.id} className="rounded bg-gray-800 p-2">
                      <div className="text-xs text-gray-500">{entry.timestamp}</div>
                      <div className="text-sm text-gray-200 mt-0.5">
                        {entry.description}
                      </div>
                      {entry.impact && (
                        <div className="text-xs text-gray-400 mt-0.5 italic">
                          {t('sidebarLeft.characters.detail.impact', { impact: entry.impact })}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Relations */}
          {character.relations.length > 0 && (
            <section className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.characters.detail.relations')}
              </h4>
              <div className="space-y-1">
                {character.relations.map((rel) => (
                  <div
                    key={rel.id}
                    className="rounded bg-gray-800 px-2 py-1.5 text-sm text-gray-200"
                  >
                    <span className="text-xs uppercase text-gray-500 mr-2">{rel.type}</span>
                    {rel.description}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Story Links */}
          {storyLinks.length > 0 && (
            <section className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.characters.detail.storyLinks')}
              </h4>
              <div className="space-y-1">
                {storyLinks.map((rel) => {
                  const otherRef = rel.from.id === characterId ? rel.to : rel.from;
                  const targetName = resolveEntityName(otherRef.type, otherRef.id);
                  return (
                    <div key={rel.id} className="rounded bg-gray-800 px-2 py-1.5 text-sm text-gray-200 flex items-start gap-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs uppercase text-purple-400 shrink-0">{rel.type}</span>
                          <span className="text-xs text-gray-400">
                            {rel.from.id === characterId ? '\u2192' : '\u2190'}{' '}
                            {targetName}
                          </span>
                          {rel.label && <span className="text-xs text-gray-500">({rel.label})</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{rel.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (deletingStoryLinkId === rel.id) {
                            deleteRelation(rel.id);
                            setDeletingStoryLinkId(null);
                          } else {
                            setDeletingStoryLinkId(rel.id);
                          }
                        }}
                        onBlur={() => setTimeout(() => setDeletingStoryLinkId(null), 200)}
                        className={`text-xs px-1 shrink-0 ${
                          deletingStoryLinkId === rel.id
                            ? 'text-red-300 font-semibold'
                            : 'text-red-400 hover:text-red-300'
                        }`}
                        title={deletingStoryLinkId === rel.id ? t('sidebarLeft.characters.detail.clickToConfirm') : t('sidebarLeft.characters.detail.delete')}
                      >
                        {deletingStoryLinkId === rel.id ? '?' : '\u00d7'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Story Points */}
          {character.storyPoints.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.characters.detail.storyPoints')}
              </h4>
              <div className="space-y-1">
                {character.storyPoints.map((sp) => (
                  <div
                    key={sp.id}
                    className="rounded bg-gray-800 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-100">{sp.title}</span>
                      <span className="text-xs text-gray-500">
                        {t('sidebarLeft.characters.detail.significance', { value: sp.significance })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{sp.description}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {character.entries.length === 0 &&
            character.relations.length === 0 &&
            character.storyPoints.length === 0 &&
            (character.attributes ?? []).length === 0 &&
            storyLinks.length === 0 && (
              <p className="text-xs text-gray-500 mt-4">
                {t('sidebarLeft.characters.detail.noExtraData')}
              </p>
            )}
        </div>
      )}
    </motion.div>
  );
}
