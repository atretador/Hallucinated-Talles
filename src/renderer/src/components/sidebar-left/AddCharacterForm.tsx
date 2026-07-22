import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { RelationEditor } from './RelationEditor';
import type { CharacterAttribute, StoryRelation } from '../../../../shared/types';

interface AddCharacterFormProps {
  onDone: () => void;
  onCancel: () => void;
}

export function AddCharacterForm({ onDone, onCancel }: AddCharacterFormProps) {
  const { t } = useTranslation('app');
  const { addCharacter, addRelation, characters, events, worldData } = useAppStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [attributes, setAttributes] = useState<CharacterAttribute[]>([]);
  const [pendingRelations, setPendingRelations] = useState<StoryRelation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await addCharacter({
        name: name.trim(),
        description: description.trim(),
        bookId: '',
        aliases: [],
        attributes: attributes.filter((a) => a.key.trim()),
        entries: [],
        relations: [],
        storyPoints: [],
      });
      // Find the newly created character (last one matching name) and create pending relations
      if (pendingRelations.length > 0) {
        const store = useAppStore.getState();
        const newChar = [...store.characters].reverse().find((c) => c.name === name.trim());
        if (newChar) {
          for (const rel of pendingRelations) {
            await addRelation({
              bookId: rel.bookId,
              from: { type: 'character', id: newChar.id },
              to: rel.to,
              type: rel.type,
              label: rel.label,
              description: rel.description,
            });
          }
        }
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = name.trim().length > 0 && description.trim().length > 0;

  return (
    <motion.div
      layout={!shouldReduceMotion}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
    >
      <h3 className="text-sm font-semibold text-gray-100 mb-3">{t('sidebarLeft.characters.addForm.title')}</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.characters.addForm.name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('sidebarLeft.characters.addForm.namePlaceholder')}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.characters.addForm.description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('sidebarLeft.characters.addForm.descriptionPlaceholder')}
            rows={4}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring resize-none"
          />
        </div>

        {/* Attributes */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.characters.addForm.attributes')}</label>
          <div className="space-y-2">
            {attributes.map((attr, attrIdx) => (
              <div key={attr.id} className="rounded bg-gray-800 border border-gray-700 p-2">
                <div className="flex items-center gap-1 mb-1.5">
                  <input
                    type="text"
                    value={attr.key}
                    onChange={(e) => {
                      const next = [...attributes];
                      next[attrIdx] = { ...next[attrIdx], key: e.target.value };
                      setAttributes(next);
                    }}
                    placeholder={t('sidebarLeft.characters.addForm.groupNamePlaceholder')}
                    className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setAttributes(attributes.filter((_, i) => i !== attrIdx))}
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
                          const next = [...attributes];
                          const newValues = [...next[attrIdx].values];
                          newValues[valIdx] = e.target.value;
                          next[attrIdx] = { ...next[attrIdx], values: newValues };
                          setAttributes(next);
                        }}
                        placeholder={t('sidebarLeft.characters.addForm.valuePlaceholder')}
                        className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...attributes];
                          next[attrIdx] = {
                            ...next[attrIdx],
                            values: next[attrIdx].values.filter((_, i) => i !== valIdx),
                          };
                          setAttributes(next);
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
                      const next = [...attributes];
                      next[attrIdx] = { ...next[attrIdx], values: [...next[attrIdx].values, ''] };
                      setAttributes(next);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                  >
                    {t('sidebarLeft.characters.addForm.addValue')}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setAttributes([
                  ...attributes,
                  { id: `attr-new-${Date.now()}`, key: '', values: [''] },
                ])
              }
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {t('sidebarLeft.characters.addForm.addAttributeGroup')}
            </button>
          </div>
        </div>

        {/* Relations */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.characters.addForm.relations')}</label>
          <RelationEditor
            characterId={`pending-${Date.now()}`}
            relations={pendingRelations}
            onAdd={(rel) =>
              setPendingRelations((prev) => [
                ...prev,
                {
                  ...rel,
                  id: `pending-rel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ])
            }
            onDelete={(id) =>
              setPendingRelations((prev) => prev.filter((r) => r.id !== id))
            }
            characters={characters}
            events={events}
            worldData={worldData}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-1.5 text-sm text-white transition-colors"
          >
            {submitting ? t('sidebarLeft.characters.addForm.saving') : t('sidebarLeft.characters.addForm.save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-sm text-gray-300 transition-colors"
          >
            {t('sidebarLeft.characters.addForm.cancel')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
