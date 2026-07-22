import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';

interface WorldDataDetailProps {
  worldDataId: string;
  onBack: () => void;
}

export function WorldDataDetail({ worldDataId, onBack }: WorldDataDetailProps) {
  const { t } = useTranslation('app');
  const { worldData, updateWorldData, deleteWorldData, relations } = useAppStore();
  const entry = worldData.find((w) => w.id === worldDataId);
  const storyLinks = relations.filter((r) => r.from.id === worldDataId || r.to.id === worldDataId);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editShortDescription, setEditShortDescription] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAttributes, setEditAttributes] = useState<Array<{ key: string; value: string }>>([]);
  const [editAliases, setEditAliases] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (!entry) {
    return (
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-blue-400 hover:text-blue-300 mb-3 block"
        >
          {t('sidebarLeft.worldData.detail.back')}
        </button>
        <div className="text-sm text-gray-500">{t('sidebarLeft.worldData.detail.notFound')}</div>
      </div>
    );
  }

  const handleEdit = () => {
    setEditName(entry.name);
    setEditShortDescription(entry.shortDescription);
    setEditContent(entry.content);
    setEditCategory(entry.category ?? '');
    setEditAttributes((entry.attributes ?? []).map((a) => ({ ...a })));
    setEditAliases([...(entry.aliases ?? [])]);
    setEditTags([...(entry.tags ?? [])]);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim() || !editShortDescription.trim()) return;
    setSaving(true);
    try {
      await updateWorldData(worldDataId, {
        name: editName.trim(),
        shortDescription: editShortDescription.trim(),
        content: editContent.trim(),
        category: editCategory.trim() || undefined,
        attributes: editAttributes.filter((a) => a.key.trim()),
        aliases: editAliases.filter((a) => a.trim()),
        tags: editTags.filter((t) => t.trim()),
      });
      setEditing(false);
    } catch {
      // Error is already in store, stays in edit mode so user can retry
      console.debug('[WorldDataDetail] Save failed, error handled by store');
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
      await deleteWorldData(worldDataId);
      onBack();
    } catch {
      // Error is already in store, confirmation stays open so user can retry
      console.debug('[WorldDataDetail] Delete failed, error handled by store');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <motion.div
      key={worldDataId}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-blue-400 hover:text-blue-300 mb-3 block"
      >
        {t('sidebarLeft.worldData.detail.back')}
      </button>

      {editing ? (
        /* ---- Inline edit mode ---- */
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.detail.name')}</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.detail.shortDescription')}</label>
            <input
              type="text"
              value={editShortDescription}
              onChange={(e) => setEditShortDescription(e.target.value)}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.detail.content')}</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={5}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.detail.category')}</label>
            <input
              type="text"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              placeholder={t('sidebarLeft.worldData.detail.categoryPlaceholder')}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.detail.attributes')}</label>
            <div className="space-y-1">
              {editAttributes.map((attr, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={attr.key}
                    onChange={(e) => {
                      const next = [...editAttributes];
                      next[i] = { ...next[i], key: e.target.value };
                      setEditAttributes(next);
                    }}
                    placeholder={t('sidebarLeft.worldData.detail.keyPlaceholder')}
                    className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
                  />
                  <input
                    type="text"
                    value={attr.value}
                    onChange={(e) => {
                      const next = [...editAttributes];
                      next[i] = { ...next[i], value: e.target.value };
                      setEditAttributes(next);
                    }}
                    placeholder={t('sidebarLeft.worldData.detail.valuePlaceholder')}
                    className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setEditAttributes(editAttributes.filter((_, j) => j !== i))}
                    className="text-xs text-red-400 hover:text-red-300 px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEditAttributes([...editAttributes, { key: '', value: '' }])}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {t('sidebarLeft.worldData.detail.addAttribute')}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.detail.aliases')}</label>
            <input
              type="text"
              value={editAliases.join(', ')}
              onChange={(e) => setEditAliases(e.target.value.split(',').map((s) => s.trim()))}
              placeholder={t('sidebarLeft.worldData.detail.aliasesPlaceholder')}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.detail.tags')}</label>
            <input
              type="text"
              value={editTags.join(', ')}
              onChange={(e) => setEditTags(e.target.value.split(',').map((s) => s.trim()))}
              placeholder={t('sidebarLeft.worldData.detail.tagsPlaceholder')}
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
              {saving ? t('sidebarLeft.worldData.detail.saving') : t('sidebarLeft.worldData.detail.save')}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-sm text-gray-300 transition-colors"
            >
              {t('sidebarLeft.worldData.detail.cancel')}
            </button>
          </div>
        </div>
      ) : (
        /* ---- View mode ---- */
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-gray-100">{entry.name}</h3>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">{t('sidebarLeft.worldData.detail.areYouSure')}</span>
                <button
                  type="button"
                  aria-label={t('sidebarLeft.worldData.detail.confirmDelete')}
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                >
                  {deleting ? t('sidebarLeft.worldData.detail.deleting') : t('sidebarLeft.worldData.detail.confirmDelete')}
                </button>
                <button
                  type="button"
                  aria-label={t('sidebarLeft.worldData.detail.cancelDelete')}
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-40"
                >
                  {t('sidebarLeft.worldData.detail.cancelDelete')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {t('sidebarLeft.worldData.detail.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {t('sidebarLeft.worldData.detail.delete')}
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 mb-2">{entry.shortDescription}</p>

          <p className="text-sm text-gray-300 whitespace-pre-wrap mb-4">
            {entry.content}
          </p>

          {entry.category && (
            <div className="mb-2">
              <span className="inline-block rounded bg-purple-900 text-purple-300 text-xs px-1.5 py-0.5">{entry.category}</span>
            </div>
          )}

          {(entry.aliases ?? []).length > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              <span className="text-gray-400">{t('sidebarLeft.worldData.detail.alsoKnownAs')}</span> {entry.aliases!.join(', ')}
            </p>
          )}

          {(entry.attributes ?? []).length > 0 && (
            <section className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('sidebarLeft.worldData.detail.attributes')}</h4>
              <div className="space-y-1">
                {entry.attributes!.map((attr, i) => (
                  <div key={i} className="rounded bg-gray-800 px-2 py-1 text-sm">
                    <span className="text-gray-300 font-medium">{attr.key}:</span>{' '}
                    <span className="text-gray-400">{attr.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(entry.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {entry.tags!.map((tag, i) => (
                <span key={i} className="inline-block rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300">{tag}</span>
              ))}
            </div>
          )}

          {/* Story Links */}
          {storyLinks.length > 0 && (
            <section className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('sidebarLeft.worldData.detail.storyLinks')}
              </h4>
              <div className="space-y-1">
                {storyLinks.map((rel) => (
                  <div key={rel.id} className="rounded bg-gray-800 px-2 py-1.5 text-sm text-gray-200">
                    <span className="text-xs uppercase text-purple-400 mr-2">{rel.type}</span>
                    <span className="text-gray-400">
                      {rel.from.id === worldDataId ? '\u2192' : '\u2190'}{' '}
                      {rel.from.id === worldDataId ? rel.to.type : rel.from.type}
                    </span>
                    {rel.label && <span className="text-gray-500 ml-1">({rel.label})</span>}
                    <div className="text-xs text-gray-400 mt-0.5">{rel.description}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </motion.div>
  );
}
