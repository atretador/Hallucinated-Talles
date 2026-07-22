import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { WORLD_DATA_CATEGORIES } from '../../../../shared/types';

interface AddWorldDataFormProps {
  onDone: () => void;
  onCancel: () => void;
}

interface AttrDraft {
  key: string;
  value: string;
}

export function AddWorldDataForm({ onDone, onCancel }: AddWorldDataFormProps) {
  const { t } = useTranslation('app');
  const { addWorldData } = useAppStore();
  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [attributes, setAttributes] = useState<AttrDraft[]>([]);
  const [aliasesText, setAliasesText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = async () => {
    if (!name.trim() || !shortDescription.trim()) return;
    setSubmitting(true);
    try {
      const aliases = aliasesText.split(',').map(s => s.trim()).filter(Boolean);
      const tags = tagsText.split(',').map(s => s.trim()).filter(Boolean);
      const attrs = attributes.filter(a => a.key.trim()).map(a => ({ key: a.key.trim(), value: a.value.trim() }));
      await addWorldData({
        name: name.trim(),
        shortDescription: shortDescription.trim(),
        content: content.trim(),
        bookId: '',
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(attrs.length > 0 ? { attributes: attrs } : {}),
        ...(aliases.length > 0 ? { aliases } : {}),
        ...(tags.length > 0 ? { tags } : {}),
      });
      onDone();
    } catch {
      // Error is already in store, form stays open so user can retry
      console.debug('[AddWorldDataForm] Submit failed, error handled by store');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = name.trim().length > 0 && shortDescription.trim().length > 0;

  return (
    <motion.div
      layout={!shouldReduceMotion}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
    >
      <h3 className="text-sm font-semibold text-gray-100 mb-3">{t('sidebarLeft.worldData.addForm.title')}</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.addForm.name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('sidebarLeft.worldData.addForm.namePlaceholder')}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.addForm.shortDescription')}</label>
          <input
            type="text"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder={t('sidebarLeft.worldData.addForm.shortDescriptionPlaceholder')}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.addForm.content')}</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('sidebarLeft.worldData.addForm.contentPlaceholder')}
            rows={5}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.addForm.category')}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
          >
            <option value="">{t('sidebarLeft.worldData.addForm.none')}</option>
            {WORLD_DATA_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{t('sidebarLeft.worldData.categoryFilter.' + cat)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.addForm.attributes')}</label>
          <div className="space-y-2">
            {attributes.map((attr, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input
                  type="text"
                  value={attr.key}
                  onChange={(e) => {
                    const next = [...attributes];
                    next[idx] = { ...next[idx], key: e.target.value };
                    setAttributes(next);
                  }}
                  placeholder={t('sidebarLeft.worldData.addForm.keyPlaceholder')}
                  className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
                />
                <input
                  type="text"
                  value={attr.value}
                  onChange={(e) => {
                    const next = [...attributes];
                    next[idx] = { ...next[idx], value: e.target.value };
                    setAttributes(next);
                  }}
                  placeholder={t('sidebarLeft.worldData.addForm.valuePlaceholder')}
                  className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
                />
                <button
                  type="button"
                  onClick={() => setAttributes(attributes.filter((_, i) => i !== idx))}
                  className="text-xs text-red-400 hover:text-red-300 px-1"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAttributes([...attributes, { key: '', value: '' }])}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {t('sidebarLeft.worldData.addForm.addAttribute')}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.addForm.aliases')}</label>
          <input
            type="text"
            value={aliasesText}
            onChange={(e) => setAliasesText(e.target.value)}
            placeholder={t('sidebarLeft.worldData.addForm.aliasesPlaceholder')}
            className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus-ring"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('sidebarLeft.worldData.addForm.tags')}</label>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder={t('sidebarLeft.worldData.addForm.tagsPlaceholder')}
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
            {submitting ? t('sidebarLeft.worldData.addForm.saving') : t('sidebarLeft.worldData.addForm.save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-sm text-gray-300 transition-colors"
          >
            {t('sidebarLeft.worldData.addForm.cancel')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
