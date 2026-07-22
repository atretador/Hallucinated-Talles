import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import type { WritingSkill } from '../../../../shared/types';
import { notifySettingsChanged } from './utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';

export function SkillsTab() {
  const { t } = useTranslation('app');
  const prefersReduced = useReducedMotion();
  const {
    skills, activeSkillIds, skillsLoading,
    fetchSkills, fetchActiveSkillIds, createSkill, updateSkill, deleteSkill, toggleSkill,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formScope, setFormScope] = useState<'global' | 'project'>('global');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSkills();
    fetchActiveSkillIds();
  }, [fetchSkills, fetchActiveSkillIds]);

  const startAdd = () => {
    setEditingId('__new__');
    setFormName('');
    setFormDescription('');
    setFormInstructions('');
    setFormScope('global');
    setMessage('');
  };

  const startEdit = (skill: WritingSkill) => {
    setEditingId(skill.id);
    setFormName(skill.name);
    setFormDescription(skill.description);
    setFormInstructions(skill.instructions);
    setFormScope('global'); // Default — user can change
    setMessage('');
  };

  const cancelForm = () => {
    setEditingId(null);
    setMessage('');
  };

  const handleSave = async () => {
    if (!formName.trim()) { setMessage(t('settings.skills.nameRequired')); return; }
    if (!formInstructions.trim()) { setMessage(t('settings.skills.instructionsRequired')); return; }
    setSaving(true); setMessage('');
    try {
      if (editingId === '__new__') {
        await createSkill({ name: formName.trim(), description: formDescription.trim(), instructions: formInstructions.trim(), scope: formScope });
        setMessage(t('settings.skills.skillCreated'));
      } else if (editingId) {
        await updateSkill(editingId, { name: formName.trim(), description: formDescription.trim(), instructions: formInstructions.trim(), scope: formScope });
        setMessage(t('settings.skills.skillUpdated'));
      }
      cancelForm();
      notifySettingsChanged();
    } catch (err) {
      setMessage(t('settings.skills.error', { error: err instanceof Error ? err.message : String(err) }));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try { await deleteSkill(deleteTargetId); notifySettingsChanged(); }
    catch (err) { setMessage(t('common.status.error') + ': ' + (err instanceof Error ? err.message : String(err))); }
    finally { setDeleteTargetId(null); }
  };

  const handleImportTxt = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFormInstructions(text);
      // Auto-fill name from filename if empty
      if (!formName) {
        const baseName = file.name.replace(/\.(txt|md)$/i, '').replace(/[-_]/g, ' ');
        setFormName(baseName);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">{t('settings.skills.title')}</h3>
        <motion.button
          onClick={startAdd}
          disabled={editingId !== null}
          className="focus-ring rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50"
          whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        >
          {t('settings.skills.newProfile')}
        </motion.button>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        {t('settings.skills.description')}
      </p>

      {skillsLoading && <p className="text-xs text-gray-500">{t('settings.skills.loading')}</p>}

      {!skillsLoading && skills.length === 0 && !editingId && (
        <p className="text-xs text-gray-500">{t('settings.skills.noProfiles')}</p>
      )}

      {/* Edit/Create form */}
      {editingId && (
        <div className="mb-3 rounded border border-blue-600 bg-gray-700 p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-200">
            {editingId === '__new__' ? t('settings.skills.newProfileForm') : t('settings.skills.editProfileForm')}
          </h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400">{t('labels.name', { ns: 'common' })}</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder={t('settings.skills.namePlaceholder')}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">{t('labels.description', { ns: 'common' })}</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('settings.skills.descriptionPlaceholder')}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs text-gray-400">{t('settings.skills.instructions')}</label>
                <button type="button" onClick={handleImportTxt}
                  className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline">
                  {t('settings.skills.importTxtMd')}
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={handleFileChange} className="hidden" />
              </div>
              <textarea value={formInstructions} onChange={(e) => setFormInstructions(e.target.value)}
                placeholder={t('settings.skills.instructionsPlaceholder')}
                rows={8}
                className="focus-ring w-full resize-y rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">{t('settings.skills.saveTo')}</label>
              <select value={formScope} onChange={(e) => setFormScope(e.target.value as 'global' | 'project')}
                className="focus-ring w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100">
                <option value="global">{t('settings.skills.globalScope')}</option>
                <option value="project">{t('settings.skills.projectScope')}</option>
              </select>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <motion.button onClick={handleSave} disabled={saving}
              className="focus-ring rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}>
              {saving ? t('buttons.saving', { ns: 'common' }) : t('buttons.save', { ns: 'common' })}
            </motion.button>
            <motion.button onClick={cancelForm}
              className="focus-ring rounded bg-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-500"
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}>
              {t('buttons.cancel', { ns: 'common' })}
            </motion.button>
          </div>
          {message && <div className="mt-2 text-xs text-gray-300">{message}</div>}
        </div>
      )}

      {/* Skill cards */}
      <div className="space-y-2">
        {skills.map((skill) => {
          const isActive = activeSkillIds.includes(skill.id);
          return (
            <div key={skill.id}
              className={`rounded border px-3 py-2 ${isActive ? 'border-green-600 bg-gray-700' : 'border-gray-600 bg-gray-800'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-100">{skill.name}</span>
                    {isActive && (
                      <span className="rounded bg-green-800 px-1.5 py-0.5 text-[10px] text-green-300">{t('status.active', { ns: 'common' })}</span>
                    )}
                  </div>
                  {skill.description && (
                    <div className="mt-0.5 text-xs text-gray-400 truncate">{skill.description}</div>
                  )}
                  <div className="mt-1 text-[10px] text-gray-500 line-clamp-2">{skill.instructions.slice(0, 120)}{skill.instructions.length > 120 ? '...' : ''}</div>
                </div>
                <div className="ml-2 flex gap-1 shrink-0">
                  <button onClick={() => toggleSkill(skill.id)}
                    className={`focus-ring rounded px-2 py-0.5 text-xs ${isActive ? 'bg-green-700 text-green-200 hover:bg-green-600' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>
                    {isActive ? t('buttons.on', { ns: 'common' }) : t('buttons.off', { ns: 'common' })}
                  </button>
                  <button onClick={() => startEdit(skill)} disabled={editingId !== null}
                    className="focus-ring rounded bg-gray-600 px-2 py-0.5 text-xs text-gray-200 hover:bg-gray-500 disabled:opacity-30">
                    {t('buttons.edit', { ns: 'common' })}
                  </button>
                  <button onClick={() => handleDelete(skill.id)} disabled={editingId !== null}
                    className="focus-ring rounded bg-red-800 px-2 py-0.5 text-xs text-red-200 hover:bg-red-700 disabled:opacity-30">
                    {t('buttons.del', { ns: 'common' })}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {message && !editingId && <div className="mt-2 text-xs text-gray-300">{message}</div>}

      <ConfirmDialog
        open={deleteTargetId !== null}
        message={t('settings.skills.deleteConfirm')}
        confirmLabel={t('buttons.delete', { ns: 'common' })}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
