import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { RelationEditor } from './RelationEditor';
import type {
  Character,
  CharacterAttribute,
  StoryEvent,
  WorldData,
  StoryRelation,
  StoryPoint,
  CharacterEntry,
  EntityRef,
  EventType,
} from '../../../../shared/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type EntityKind = 'character' | 'event' | 'worldData';

type DetailTab = 'overview' | 'attributes' | 'relations' | 'entries' | 'storyPoints';

// ── Tab definitions per entity kind ────────────────────────────────────────────

const CHARACTER_TABS: { key: DetailTab; labelKey: string }[] = [
  { key: 'overview', labelKey: 'sidebarLeft.shared.tabs.overview' },
  { key: 'attributes', labelKey: 'sidebarLeft.shared.tabs.attributes' },
  { key: 'relations', labelKey: 'sidebarLeft.shared.tabs.relations' },
  { key: 'entries', labelKey: 'sidebarLeft.shared.tabs.entries' },
  { key: 'storyPoints', labelKey: 'sidebarLeft.shared.tabs.storyPoints' },
];

const EVENT_TABS: { key: DetailTab; labelKey: string }[] = [
  { key: 'overview', labelKey: 'sidebarLeft.shared.tabs.overview' },
  { key: 'relations', labelKey: 'sidebarLeft.shared.tabs.relations' },
];

const WORLDDATA_TABS: { key: DetailTab; labelKey: string }[] = [
  { key: 'overview', labelKey: 'sidebarLeft.shared.tabs.overview' },
  { key: 'attributes', labelKey: 'sidebarLeft.shared.tabs.attributes' },
  { key: 'relations', labelKey: 'sidebarLeft.shared.tabs.relations' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveEntityName(
  ref: EntityRef,
  characters: Character[],
  events: StoryEvent[],
  worldData: WorldData[],
): string {
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

// ── Animation variants ────────────────────────────────────────────────────────

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const contentVariants = (prefersReduced: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(prefersReduced ? {} : { scale: 0.95, y: 20 }),
  },
  visible: {
    opacity: 1,
    ...(prefersReduced ? {} : { scale: 1, y: 0 }),
  },
  exit: {
    opacity: 0,
    ...(prefersReduced ? {} : { scale: 0.95, y: 20 }),
    transition: { duration: 0.2 },
  },
});

// ── Shared styles (injected once) ─────────────────────────────────────────────
const FIELD_STYLE = 'w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring';
const FIELD_STYLE_SM = 'rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring';

// ── Main Component ────────────────────────────────────────────────────────────

interface EntityDetailPanelProps {
  kind: EntityKind;
  id?: string;
  mode?: 'view' | 'add';
  onClose: () => void;
}

export function EntityDetailPanel({ kind, id, mode = 'view', onClose }: EntityDetailPanelProps) {
  const { t } = useTranslation('app');
  const {
    characters,
    events,
    worldData,
    relations,
    updateCharacter,
    deleteCharacter,
    updateEvent,
    deleteEvent,
    updateWorldData,
    deleteWorldData,
    addCharacter,
    addEvent,
    addWorldData,
    addRelation,
    deleteRelation,
  } = useAppStore();

  const isAddMode = mode === 'add';

  const prefersReduced = useReducedMotion() ?? false;

  // Resolve entity (null in add mode)
  const entity = useMemo(() => {
    if (isAddMode || !id) return null;
    switch (kind) {
      case 'character':
        return characters.find((c) => c.id === id) ?? null;
      case 'event':
        return events.find((e) => e.id === id) ?? null;
      case 'worldData':
        return worldData.find((w) => w.id === id) ?? null;
    }
  }, [kind, id, characters, events, worldData, isAddMode]);

  // Story links for this entity (empty in add mode)
  const storyLinks = useMemo(
    () => (id ? relations.filter((r) => r.from.id === id || r.to.id === id) : []),
    [relations, id],
  );

  // Tab state
  const tabs = kind === 'character' ? CHARACTER_TABS : kind === 'event' ? EVENT_TABS : WORLDDATA_TABS;
  const [activeTab, setActiveTab] = useState<DetailTab>(tabs[0].key);

  // Reset tab when entity changes
  useEffect(() => {
    setActiveTab(tabs[0].key);
  }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingStoryLinkId, setDeletingStoryLinkId] = useState<string | null>(null);

  // Character edit state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAliases, setEditAliases] = useState('');
  const [editAttributes, setEditAttributes] = useState<CharacterAttribute[]>([]);
  const [editRelations, setEditRelations] = useState<StoryRelation[]>([]);
  const [editEntries, setEditEntries] = useState<CharacterEntry[]>([]);
  const [editStoryPoints, setEditStoryPoints] = useState<StoryPoint[]>([]);

  // Event edit state
  const [editTitle, setEditTitle] = useState('');
  const [editEventType, setEditEventType] = useState<EventType>('major');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [editEventCharacters, setEditEventCharacters] = useState<string[]>([]);
  const [editConsequences, setEditConsequences] = useState<string[]>([]);

  // WorldData edit state
  const [editWdName, setEditWdName] = useState('');
  const [editShortDescription, setEditShortDescription] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editWdAttributes, setEditWdAttributes] = useState<Array<{ key: string; value: string }>>([]);
  const [editWdAliases, setEditWdAliases] = useState('');
  const [editTags, setEditTags] = useState('');

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ── Edit handlers ─────────────────────────────────────────────────────────

  // In add mode, start in editing immediately
  useEffect(() => {
    if (isAddMode) {
      setEditing(true);
    }
  }, [isAddMode]);

  const enterEditMode = useCallback(() => {
    if (kind === 'character' && entity && 'name' in entity) {
      const c = entity as Character;
      setEditName(c.name);
      setEditDescription(c.description);
      setEditAliases(c.aliases.join(', '));
      setEditAttributes((c.attributes ?? []).map((a) => ({ ...a, values: [...a.values] })));
      setEditRelations(storyLinks.map((r) => ({ ...r })));
      setEditEntries(c.entries.map((e) => ({ ...e })));
      setEditStoryPoints(c.storyPoints.map((sp) => ({ ...sp, characters: [...sp.characters] })));
    } else if (kind === 'event' && entity && 'title' in entity) {
      const e = entity as StoryEvent;
      setEditTitle(e.title);
      setEditDescription(e.description);
      setEditEventType(e.type);
      setEditTimestamp(e.timestamp || '');
      setEditEventCharacters([...e.characters]);
      setEditConsequences([...e.consequences]);
    } else if (kind === 'worldData' && entity && 'name' in entity) {
      const w = entity as WorldData;
      setEditWdName(w.name);
      setEditShortDescription(w.shortDescription);
      setEditContent(w.content);
      setEditCategory(w.category ?? '');
      setEditWdAttributes((w.attributes ?? []).map((a) => ({ ...a })));
      setEditWdAliases((w.aliases ?? []).join(', '));
      setEditTags((w.tags ?? []).join(', '));
    }
    setEditing(true);
  }, [kind, entity, storyLinks]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setConfirmDelete(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (kind === 'character') {
        if (!editName.trim() || !editDescription.trim()) return;
        if (isAddMode) {
          await addCharacter({
            name: editName.trim(),
            description: editDescription.trim(),
            bookId: '',
            aliases: editAliases.split(',').map((s) => s.trim()).filter(Boolean),
            attributes: editAttributes.filter((a) => a.key.trim()),
            entries: editEntries,
            relations: [],
            storyPoints: editStoryPoints,
          });
        } else {
          await updateCharacter(id!, {
            name: editName.trim(),
            description: editDescription.trim(),
            aliases: editAliases.split(',').map((s) => s.trim()).filter(Boolean),
            attributes: editAttributes.filter((a) => a.key.trim()),
            entries: editEntries,
            storyPoints: editStoryPoints,
          });
          // Create pending relations
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
        }
      } else if (kind === 'event') {
        if (!editTitle.trim() || !editDescription.trim()) return;
        if (isAddMode) {
          await addEvent({
            title: editTitle.trim(),
            description: editDescription.trim(),
            type: editEventType,
            timestamp: editTimestamp.trim() || '',
            characters: editEventCharacters,
            consequences: editConsequences.filter((c) => c.trim()),
            bookId: '',
            sortOrder: 0,
            locations: [],
          });
        } else {
          await updateEvent(id!, {
            title: editTitle.trim(),
            description: editDescription.trim(),
            type: editEventType,
            timestamp: editTimestamp.trim() || undefined,
            characters: editEventCharacters,
            consequences: editConsequences.filter((c) => c.trim()),
          });
        }
      } else if (kind === 'worldData') {
        if (!editWdName.trim() || !editShortDescription.trim()) return;
        if (isAddMode) {
          await addWorldData({
            name: editWdName.trim(),
            shortDescription: editShortDescription.trim(),
            content: editContent.trim(),
            bookId: '',
            category: editCategory.trim() || undefined,
            attributes: editWdAttributes.filter((a) => a.key.trim()),
            aliases: editWdAliases.split(',').map((s) => s.trim()).filter(Boolean),
            tags: editTags.split(',').map((s) => s.trim()).filter(Boolean),
          });
        } else {
          await updateWorldData(id!, {
            name: editWdName.trim(),
            shortDescription: editShortDescription.trim(),
            content: editContent.trim(),
            category: editCategory.trim() || undefined,
            attributes: editWdAttributes.filter((a) => a.key.trim()),
            aliases: editWdAliases.split(',').map((s) => s.trim()).filter(Boolean),
            tags: editTags.split(',').map((s) => s.trim()).filter(Boolean),
          });
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }, [kind, id, isAddMode, editName, editDescription, editAliases, editAttributes, editRelations, editEntries, editStoryPoints,
    editTitle, editEventType, editTimestamp, editEventCharacters, editConsequences,
    editWdName, editShortDescription, editContent, editCategory, editWdAttributes, editWdAliases, editTags,
    updateCharacter, updateEvent, updateWorldData, addCharacter, addEvent, addWorldData, addRelation, onClose]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    setDeleting(true);
    try {
      if (kind === 'character') {
        await deleteCharacter(id);
      } else if (kind === 'event') {
        await deleteEvent(id);
      } else if (kind === 'worldData') {
        await deleteWorldData(id);
      }
      onClose();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [kind, id, deleteCharacter, deleteEvent, deleteWorldData, onClose]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!entity && !isAddMode) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            className="relative z-10 mx-8 max-w-md rounded-xl border border-gray-700 bg-gray-900 p-8 text-center shadow-2xl"
            variants={contentVariants(prefersReduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-400">{t('sidebarLeft.detail.entityNotFound')}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 text-sm text-blue-400 hover:text-blue-300"
            >
              {t('sidebarLeft.detail.close')}
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const entityTitle = isAddMode
    ? (kind === 'character' ? t('sidebarLeft.detail.newCharacter')
      : kind === 'event' ? t('sidebarLeft.detail.newEvent')
      : t('sidebarLeft.detail.newWorldData'))
    : kind === 'character' ? (entity as Character).name
    : kind === 'event' ? (entity as StoryEvent).title
    : (entity as WorldData).name;

  const badgeColor =
    kind === 'character' ? 'bg-blue-900 text-blue-300'
    : kind === 'event' ? 'bg-red-900 text-red-300'
    : 'bg-purple-900 text-purple-300';

  // Dummy entity for add mode (OverviewTab needs a non-null entity prop)
  const dummyEntity = useMemo(() => {
    if (!isAddMode && entity) return entity;
    const now = new Date().toISOString();
    if (kind === 'character') return { id: '', bookId: '', name: '', aliases: [], description: '', attributes: [], entries: [], relations: [], storyPoints: [], createdAt: now, updatedAt: now } as Character;
    if (kind === 'event') return { id: '', bookId: '', title: '', description: '', timestamp: '', characters: [], type: 'major' as const, consequences: [], sortOrder: 0, locations: [], createdAt: now, updatedAt: now } as StoryEvent;
    return { id: '', bookId: '', name: '', shortDescription: '', content: '', createdAt: now, updatedAt: now } as WorldData;
  }, [isAddMode, entity, kind]);

  // Can we show the Attributes tab?
  const showAttributesTab = kind === 'character' || kind === 'worldData';
  const showEntriesTab = kind === 'character';
  const showStoryPointsTab = kind === 'character';

  // Filter tabs based on relevance
  const visibleTabs = tabs.filter((t) => {
    if (t.key === 'attributes' && !showAttributesTab) return false;
    if (t.key === 'entries' && !showEntriesTab) return false;
    if (t.key === 'storyPoints' && !showStoryPointsTab) return false;
    return true;
  });

  return (
    <AnimatePresence>
      <motion.div
        key="entity-detail-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Panel */}
        <motion.div
          key={`entity-detail-${kind}-${id}`}
          className="relative z-10 mx-4 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
          variants={contentVariants(prefersReduced)}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-700 px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeColor}`}>
                {kind}
              </span>
              <h2 className="truncate text-lg font-semibold text-gray-100">{entityTitle}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
              aria-label={t('sidebarLeft.detail.close')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Tab bar ─────────────────────────────────────────── */}
          <div className="flex shrink-0 gap-1 border-b border-gray-700 px-6">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {t(tab.labelKey)}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="entity-tab-indicator"
                    className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-400 rounded-full"
                    transition={{ duration: prefersReduced ? 0 : 0.25, ease: 'easeInOut' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* ── Tab content ─────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${kind}-${id}-${activeTab}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: prefersReduced ? 0 : 0.15, ease: 'easeOut' }}
              >
                {activeTab === 'overview' && (
                  <OverviewTab
                    kind={kind}
                    entity={dummyEntity}
                    storyLinks={storyLinks}
                    editing={editing}
                    editName={editName}
                    setEditName={setEditName}
                    editDescription={editDescription}
                    setEditDescription={setEditDescription}
                    editAliases={editAliases}
                    setEditAliases={setEditAliases}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    editEventType={editEventType}
                    setEditEventType={setEditEventType}
                    editTimestamp={editTimestamp}
                    setEditTimestamp={setEditTimestamp}
                    editEventCharacters={editEventCharacters}
                    setEditEventCharacters={setEditEventCharacters}
                    editConsequences={editConsequences}
                    setEditConsequences={setEditConsequences}
                    editWdName={editWdName}
                    setEditWdName={setEditWdName}
                    editShortDescription={editShortDescription}
                    setEditShortDescription={setEditShortDescription}
                    editContent={editContent}
                    setEditContent={setEditContent}
                    editCategory={editCategory}
                    setEditCategory={setEditCategory}
                    editWdAliases={editWdAliases}
                    setEditWdAliases={setEditWdAliases}
                    editTags={editTags}
                    setEditTags={setEditTags}
                    characters={characters}
                  />
                )}
                {activeTab === 'attributes' && kind === 'character' && (
                  <CharacterAttributesTab
                    editing={editing}
                    attributes={editing ? editAttributes : (entity as Character).attributes ?? []}
                    setAttributes={setEditAttributes}
                  />
                )}
                {activeTab === 'attributes' && kind === 'worldData' && (
                  <WorldDataAttributesTab
                    editing={editing}
                    attributes={editing ? editWdAttributes : (entity as WorldData).attributes ?? []}
                    setAttributes={setEditWdAttributes}
                  />
                )}
                {activeTab === 'relations' && (
                  <RelationsTab
                    entityId={id ?? ''}
                    entityKind={kind}
                    storyLinks={storyLinks}
                    editing={editing}
                    editRelations={editRelations}
                    setEditRelations={setEditRelations}
                    deletingStoryLinkId={deletingStoryLinkId}
                    setDeletingStoryLinkId={setDeletingStoryLinkId}
                    deleteRelation={deleteRelation}
                    characters={characters}
                    events={events}
                    worldData={worldData}
                  />
                )}
                {activeTab === 'entries' && kind === 'character' && (
                  <EntriesTab
                    editing={editing}
                    entries={editing ? editEntries : (entity as Character).entries}
                    setEntries={setEditEntries}
                  />
                )}
                {activeTab === 'storyPoints' && kind === 'character' && (
                  <StoryPointsTab
                    editing={editing}
                    storyPoints={editing ? editStoryPoints : (entity as Character).storyPoints}
                    setStoryPoints={setEditStoryPoints}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Footer ──────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center justify-between border-t border-gray-700 px-6 py-3">
            <div>
              {!isAddMode && (confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">{t('sidebarLeft.detail.areYouSure')}</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 disabled:opacity-40 transition-colors"
                  >
                    {deleting ? t('sidebarLeft.detail.deleting') : t('sidebarLeft.detail.confirmDelete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-40"
                  >
                    {t('sidebarLeft.detail.cancel')}
                  </button>
                </div>
              ) : (
                !editing && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    {t('sidebarLeft.detail.delete')}
                  </button>
                )
              ))}
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={isAddMode ? onClose : cancelEdit}
                    disabled={saving}
                    className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-600 disabled:opacity-40"
                  >
                    {t('sidebarLeft.detail.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
                  >
                    {saving ? t('sidebarLeft.detail.saving') : isAddMode ? t('sidebarLeft.detail.create') : t('sidebarLeft.detail.save')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={enterEditMode}
                  className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-200 transition-colors hover:bg-gray-600 hover:text-white"
                >
                  {t('sidebarLeft.detail.edit')}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab Content Components
// ═══════════════════════════════════════════════════════════════════════════════

// ── Overview Tab ──────────────────────────────────────────────────────────────

interface OverviewTabProps {
  kind: EntityKind;
  entity: Character | StoryEvent | WorldData;
  storyLinks: StoryRelation[];
  editing: boolean;
  // Character
  editName: string;
  setEditName: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editAliases: string;
  setEditAliases: (v: string) => void;
  // Event
  editTitle: string;
  setEditTitle: (v: string) => void;
  editEventType: EventType;
  setEditEventType: (v: EventType) => void;
  editTimestamp: string;
  setEditTimestamp: (v: string) => void;
  editEventCharacters: string[];
  setEditEventCharacters: (v: string[]) => void;
  editConsequences: string[];
  setEditConsequences: (v: string[]) => void;
  // WorldData
  editWdName: string;
  setEditWdName: (v: string) => void;
  editShortDescription: string;
  setEditShortDescription: (v: string) => void;
  editContent: string;
  setEditContent: (v: string) => void;
  editCategory: string;
  setEditCategory: (v: string) => void;
  editWdAliases: string;
  setEditWdAliases: (v: string) => void;
  editTags: string;
  setEditTags: (v: string) => void;
  characters: Character[];
}

function OverviewTab({
  kind, entity, storyLinks, editing,
  editName, setEditName, editDescription, setEditDescription, editAliases, setEditAliases,
  editTitle, setEditTitle, editEventType, setEditEventType, editTimestamp, setEditTimestamp,
  editEventCharacters, setEditEventCharacters, editConsequences, setEditConsequences,
  editWdName, setEditWdName, editShortDescription, setEditShortDescription,
  editContent, setEditContent, editCategory, setEditCategory,
  editWdAliases, setEditWdAliases, editTags, setEditTags,
  characters,
}: OverviewTabProps) {
  const { t } = useTranslation('app');
  if (kind === 'character') {
    const c = entity as Character;
    if (editing) {
      return (
        <div className="space-y-4">
          <Field label={t('sidebarLeft.shared.name')}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </Field>
          <Field label={t('sidebarLeft.shared.description')}>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={5}
              className={`${FIELD_STYLE} resize-none`}
            />
          </Field>
          <Field label={t('sidebarLeft.shared.aliases')}>
            <input
              type="text"
              value={editAliases}
              onChange={(e) => setEditAliases(e.target.value)}
              placeholder={t('sidebarLeft.shared.aliasesPlaceholder')}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </Field>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-100">{c.name}</h3>
          {c.aliases.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              <span className="text-gray-400">{t('sidebarLeft.shared.alsoKnownAs')}</span> {c.aliases.join(', ')}
            </p>
          )}
        </div>
        <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">{c.description}</p>
        {storyLinks.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {t('sidebarLeft.shared.storyLinks')} ({storyLinks.length})
            </h4>
            <div className="space-y-1.5">
              {storyLinks.map((rel) => {
                const otherRef = rel.from.id === entity.id ? rel.to : rel.from;
                const targetName = resolveEntityName(otherRef, characters, [], []);
                return (
                  <div key={rel.id} className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase text-purple-400">{rel.type}</span>
                      <span className="text-xs text-gray-400">
                        {rel.from.id === entity.id ? '\u2192' : '\u2190'} {targetName}
                      </span>
                      {rel.label && <span className="text-xs text-gray-500">({rel.label})</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">{rel.description}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  if (kind === 'event') {
    const e = entity as StoryEvent;
    const typeBadge: Record<string, string> = {
      major: 'bg-red-900/60 text-red-300 border border-red-800/50',
      minor: 'bg-blue-900/60 text-blue-300 border border-blue-800/50',
      background: 'bg-gray-700/60 text-gray-300 border border-gray-600/50',
    };
    const involvedChars = characters.filter((ch) => e.characters.includes(ch.id));

    if (editing) {
      return (
        <div className="space-y-4">
          <Field label={t('sidebarLeft.shared.title')}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </Field>
          <Field label={t('sidebarLeft.shared.description')}>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={5}
              className={`${FIELD_STYLE} resize-none`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('sidebarLeft.shared.type')}>
              <select
                value={editEventType}
                onChange={(e) => setEditEventType(e.target.value as EventType)}
                className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
              >
                <option value="major">{t('sidebarLeft.events.detail.major')}</option>
                <option value="minor">{t('sidebarLeft.events.detail.minor')}</option>
                <option value="background">{t('sidebarLeft.events.detail.background')}</option>
              </select>
            </Field>
            <Field label={t('sidebarLeft.shared.timestamp')}>
              <input
                type="text"
                value={editTimestamp}
                onChange={(e) => setEditTimestamp(e.target.value)}
                placeholder={t('sidebarLeft.events.detail.timestampPlaceholder')}
                className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
              />
            </Field>
          </div>
          <Field label={t('sidebarLeft.shared.involvedCharacters')}>
            <div className="space-y-1">
              {characters.map((ch) => (
                <label key={ch.id} className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editEventCharacters.includes(ch.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditEventCharacters([...editEventCharacters, ch.id]);
                      } else {
                        setEditEventCharacters(editEventCharacters.filter((id) => id !== ch.id));
                      }
                    }}
                    className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                  {ch.name}
                </label>
              ))}
              {characters.length === 0 && (
                <p className="text-xs text-gray-500">{t('sidebarLeft.shared.noCharactersAvailable')}</p>
              )}
            </div>
          </Field>
          <Field label={t('sidebarLeft.shared.consequences')}>
            <div className="space-y-1.5">
              {editConsequences.map((con, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <input
                    type="text"
                    value={con}
                    onChange={(e) => {
                      const next = [...editConsequences];
                      next[i] = e.target.value;
                      setEditConsequences(next);
                    }}
                    placeholder={t('sidebarLeft.shared.describeConsequencePlaceholder')}
                    className={`${FIELD_STYLE} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setEditConsequences(editConsequences.filter((_, j) => j !== i))}
                    className="mt-1 text-xs text-red-400 hover:text-red-300 px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEditConsequences([...editConsequences, ''])}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {t('sidebarLeft.shared.addConsequence')}
              </button>
            </div>
          </Field>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-gray-100">{e.title}</h3>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${typeBadge[e.type] ?? ''}`}>
              {e.type}
            </span>
          </div>
          {e.timestamp && <p className="mt-1 text-xs text-gray-500">{e.timestamp}</p>}
        </div>
        <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">{e.description}</p>
        {involvedChars.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {t('sidebarLeft.shared.charactersInvolved')}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {involvedChars.map((ch) => (
                <span key={ch.id} className="rounded-full bg-blue-900/40 border border-blue-800/40 px-2.5 py-1 text-xs text-blue-300">
                  {ch.name}
                </span>
              ))}
            </div>
          </section>
        )}
        {e.consequences.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {t('sidebarLeft.shared.consequences')}
            </h4>
            <ul className="space-y-1.5">
              {e.consequences.map((con, i) => (
                <li key={i} className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-2 text-sm text-gray-200">
                  {con}
                </li>
              ))}
            </ul>
          </section>
        )}
        {storyLinks.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {t('sidebarLeft.shared.storyLinks')}
            </h4>
            <div className="space-y-1.5">
              {storyLinks.map((rel) => (
                <div key={rel.id} className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase text-purple-400">{rel.type}</span>
                    <span className="text-xs text-gray-400">
                      {rel.from.id === entity.id ? '\u2192' : '\u2190'}{' '}
                      {rel.from.id === entity.id ? rel.to.type : rel.from.type}
                    </span>
                    {rel.label && <span className="text-xs text-gray-500">({rel.label})</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">{rel.description}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // WorldData
  if (editing) {
    return (
      <div className="space-y-4">
        <Field label={t('sidebarLeft.shared.name')}>
          <input
            type="text"
            value={editWdName}
            onChange={(e) => setEditWdName(e.target.value)}
            className={FIELD_STYLE}
          />
        </Field>
        <Field label={t('sidebarLeft.shared.shortDescription')}>
          <input
            type="text"
            value={editShortDescription}
            onChange={(e) => setEditShortDescription(e.target.value)}
            className={FIELD_STYLE}
          />
        </Field>
        <Field label={t('sidebarLeft.shared.content')}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={6}
            className={`${FIELD_STYLE} resize-none`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('sidebarLeft.shared.category')}>
            <input
              type="text"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              placeholder={t('sidebarLeft.shared.categoryPlaceholder')}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </Field>
          <Field label={t('sidebarLeft.shared.aliases')}>
            <input
              type="text"
              value={editWdAliases}
              onChange={(e) => setEditWdAliases(e.target.value)}
              placeholder={t('sidebarLeft.worldData.detail.aliasesPlaceholder')}
              className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-100 focus-ring"
            />
          </Field>
        </div>
        <Field label={t('sidebarLeft.shared.tags')}>
          <input
            type="text"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder={t('sidebarLeft.shared.tagsPlaceholder')}
            className={FIELD_STYLE}
          />
        </Field>
      </div>
    );
  }

  const w = entity as WorldData;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-100">{w.name}</h3>
        {w.category && (
          <span className="mt-1 inline-block rounded bg-purple-900/60 text-purple-300 border border-purple-800/50 text-xs px-1.5 py-0.5">
            {w.category}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">{w.shortDescription}</p>
      <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">{w.content}</p>
      {(w.aliases ?? []).length > 0 && (
        <p className="text-xs text-gray-500">
          <span className="text-gray-400">{t('sidebarLeft.shared.alsoKnownAs')}</span> {w.aliases!.join(', ')}
        </p>
      )}
      {(w.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {w.tags!.map((tag, i) => (
            <span key={i} className="rounded-full bg-gray-700/60 border border-gray-600/50 px-2 py-0.5 text-xs text-gray-300">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Character Attributes Tab ──────────────────────────────────────────────────

interface CharacterAttributesTabProps {
  editing: boolean;
  attributes: CharacterAttribute[];
  setAttributes: (attrs: CharacterAttribute[]) => void;
}

function CharacterAttributesTab({ editing, attributes, setAttributes }: CharacterAttributesTabProps) {
  const { t } = useTranslation('app');
  if (attributes.length === 0 && !editing) {
    return <EmptyState message={t('sidebarLeft.shared.noAttributesYet')} />;
  }

  if (editing) {
    return (
      <div className="space-y-3">
        {attributes.map((attr, attrIdx) => (
          <div key={attr.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={attr.key}
                onChange={(e) => {
                  const next = [...attributes];
                  next[attrIdx] = { ...next[attrIdx], key: e.target.value };
                  setAttributes(next);
                }}
                placeholder={t('sidebarLeft.shared.groupNamePlaceholder')}
                className={`${FIELD_STYLE} flex-1`}
              />
              <button
                type="button"
                onClick={() => setAttributes(attributes.filter((_, i) => i !== attrIdx))}
                className="text-xs text-red-400 hover:text-red-300 px-1"
              >
                &times;
              </button>
            </div>
            <div className="space-y-1.5">
              {attr.values.map((val, valIdx) => (
                <div key={valIdx} className="flex items-center gap-1.5">
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
                    placeholder={t('sidebarLeft.shared.valuePlaceholder')}
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
                {t('sidebarLeft.shared.addValue')}
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
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {t('sidebarLeft.shared.addAttributeGroup')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {attributes.map((attr) => (
        <div key={attr.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
          <div className="text-sm font-medium text-gray-200 mb-1.5">{attr.key}</div>
          <div className="flex flex-wrap gap-1.5">
            {attr.values.map((val, i) => (
              <span
                key={i}
                className="inline-block rounded-full bg-gray-700/60 border border-gray-600/50 px-2 py-0.5 text-xs text-gray-200"
              >
                {val}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── WorldData Attributes Tab ──────────────────────────────────────────────────

interface WorldDataAttributesTabProps {
  editing: boolean;
  attributes: Array<{ key: string; value: string }>;
  setAttributes: (attrs: Array<{ key: string; value: string }>) => void;
}

function WorldDataAttributesTab({ editing, attributes, setAttributes }: WorldDataAttributesTabProps) {
  const { t } = useTranslation('app');
  if (attributes.length === 0 && !editing) {
    return <EmptyState message={t('sidebarLeft.shared.noAttributesYet')} />;
  }

  if (editing) {
    return (
      <div className="space-y-2">
        {attributes.map((attr, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={attr.key}
              onChange={(e) => {
                const next = [...attributes];
                next[i] = { ...next[i], key: e.target.value };
                setAttributes(next);
              }}
              placeholder={t('sidebarLeft.shared.keyPlaceholder')}
              className={`${FIELD_STYLE_SM} flex-1`}
            />
            <input
              type="text"
              value={attr.value}
              onChange={(e) => {
                const next = [...attributes];
                next[i] = { ...next[i], value: e.target.value };
                setAttributes(next);
              }}
              placeholder={t('sidebarLeft.shared.valuePlaceholder')}
              className={`${FIELD_STYLE_SM} flex-1`}
            />
            <button
              type="button"
              onClick={() => setAttributes(attributes.filter((_, j) => j !== i))}
              className="text-xs text-red-400 hover:text-red-300 px-1"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAttributes([...attributes, { key: '', value: '' }])}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {t('sidebarLeft.shared.addAttribute')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {attributes.map((attr, i) => (
        <div key={i} className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-2 text-sm">
          <span className="font-medium text-gray-300">{attr.key}:</span>{' '}
          <span className="text-gray-400">{attr.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Relations Tab ─────────────────────────────────────────────────────────────

interface RelationsTabProps {
  entityId: string;
  entityKind: EntityKind;
  storyLinks: StoryRelation[];
  editing: boolean;
  editRelations: StoryRelation[];
  setEditRelations: (rels: StoryRelation[]) => void;
  deletingStoryLinkId: string | null;
  setDeletingStoryLinkId: (id: string | null) => void;
  deleteRelation: (id: string) => void;
  characters: Character[];
  events: StoryEvent[];
  worldData: WorldData[];
}

function RelationsTab({
  entityId, entityKind, storyLinks, editing, editRelations, setEditRelations,
  deletingStoryLinkId, setDeletingStoryLinkId, deleteRelation,
  characters, events, worldData,
}: RelationsTabProps) {
  const { t } = useTranslation('app');
  const displayRelations = editing ? editRelations : storyLinks;

  return (
    <div className="space-y-5">
      {/* Existing relations */}
      {displayRelations.length > 0 && (
        <div className="space-y-1.5">
          {displayRelations.map((rel) => {
            const otherRef = rel.from.id === entityId ? rel.to : rel.from;
            const targetName = resolveEntityName(otherRef, characters, events, worldData);
            return (
              <div
                key={rel.id}
                className="flex items-start gap-2 rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase text-purple-400 shrink-0">{rel.type}</span>
                    <span className="text-xs text-gray-400">
                      {rel.from.id === entityId ? '\u2192' : '\u2190'} {targetName}
                    </span>
                    {rel.label && <span className="text-xs text-gray-500">({rel.label})</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">{rel.description}</div>
                </div>
                {editing ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (rel.id.startsWith('pending-rel-')) {
                        setEditRelations(editRelations.filter((r) => r.id !== rel.id));
                      } else {
                        deleteRelation(rel.id);
                        setEditRelations(editRelations.filter((r) => r.id !== rel.id));
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-300 px-1 shrink-0"
                  >
                    &times;
                  </button>
                ) : (
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
                    className={`text-xs px-1 shrink-0 transition-colors ${
                      deletingStoryLinkId === rel.id
                        ? 'text-red-300 font-semibold'
                        : 'text-red-400 hover:text-red-300'
                    }`}
                    title={deletingStoryLinkId === rel.id ? t('sidebarLeft.characters.detail.clickToConfirm') : t('sidebarLeft.detail.delete')}
                  >
                    {deletingStoryLinkId === rel.id ? '?' : '\u00d7'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {displayRelations.length === 0 && (
        <EmptyState message={t('sidebarLeft.shared.noStoryLinksYet')} />
      )}

      {/* Add form */}
      <div className="border-t border-gray-700 pt-4">
        <h4 className="mb-3 text-sm font-medium text-gray-200">{t('sidebarLeft.shared.addStoryLink')}</h4>
        {editing ? (
          <RelationEditor
            characterId={entityId}
            fromEntityType={entityKind}
            relations={editRelations}
            onAdd={(rel) =>
              setEditRelations([
                ...editRelations,
                {
                  ...rel,
                  id: `pending-rel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ])
            }
            onDelete={(id) => {
              if (id.startsWith('pending-rel-')) {
                setEditRelations(editRelations.filter((r) => r.id !== id));
              } else {
                deleteRelation(id);
                setEditRelations(editRelations.filter((r) => r.id !== id));
              }
            }}
            characters={characters}
            events={events}
            worldData={worldData}
          />
        ) : (
          <p className="text-xs text-gray-500">
            {t('sidebarLeft.shared.editToManageLinks')}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Entries Tab ───────────────────────────────────────────────────────────────

interface EntriesTabProps {
  editing: boolean;
  entries: CharacterEntry[];
  setEntries: (entries: CharacterEntry[]) => void;
}

function EntriesTab({ editing, entries, setEntries }: EntriesTabProps) {
  const { t } = useTranslation('app');
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (entries.length === 0 && !editing) {
    return <EmptyState message={t('sidebarLeft.shared.noEntriesYet')} />;
  }

  if (editing) {
    return (
      <div className="space-y-3">
        {sorted.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={entry.timestamp}
                onChange={(e) => {
                  const next = [...entries];
                  const foundIdx = next.findIndex((n) => n.id === entry.id);
                  if (foundIdx >= 0) {
                    next[foundIdx] = { ...next[foundIdx], timestamp: e.target.value };
                    setEntries(next);
                  }
                }}
                placeholder={t('sidebarLeft.shared.timestampPlaceholder')}
                className="flex-1 rounded bg-gray-900 border border-gray-600 px-1.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus-ring"
              />
              <button
                type="button"
                onClick={() => setEntries(entries.filter((e) => e.id !== entry.id))}
                className="text-xs text-red-400 hover:text-red-300 px-1"
              >
                &times;
              </button>
            </div>
            <textarea
              value={entry.description}
              onChange={(e) => {
                const next = [...entries];
                const foundIdx = next.findIndex((n) => n.id === entry.id);
                if (foundIdx >= 0) {
                  next[foundIdx] = { ...next[foundIdx], description: e.target.value };
                  setEntries(next);
                }
              }}
              placeholder={t('sidebarLeft.shared.descriptionPlaceholder')}
              rows={2}
              className={`${FIELD_STYLE} resize-none mb-1.5`}
            />
            <input
              type="text"
              value={entry.impact}
              onChange={(e) => {
                const next = [...entries];
                const foundIdx = next.findIndex((n) => n.id === entry.id);
                if (foundIdx >= 0) {
                  next[foundIdx] = { ...next[foundIdx], impact: e.target.value };
                  setEntries(next);
                }
              }}
              placeholder={t('sidebarLeft.shared.impactPlaceholder')}
              className={`${FIELD_STYLE_SM} w-full`}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setEntries([
              ...entries,
              {
                id: `entry-new-${Date.now()}`,
                timestamp: '',
                description: '',
                impact: '',
              },
            ])
          }
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {t('sidebarLeft.shared.addEntry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((entry) => (
        <div key={entry.id} className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
          <div className="text-xs text-gray-500">{entry.timestamp}</div>
          <div className="mt-0.5 text-sm text-gray-200">{entry.description}</div>
          {entry.impact && (
            <div className="mt-0.5 text-xs italic text-gray-400">{t('sidebarLeft.shared.impact')}{entry.impact}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Story Points Tab ──────────────────────────────────────────────────────────

interface StoryPointsTabProps {
  editing: boolean;
  storyPoints: StoryPoint[];
  setStoryPoints: (sps: StoryPoint[]) => void;
}

function StoryPointsTab({ editing, storyPoints, setStoryPoints }: StoryPointsTabProps) {
  const { t } = useTranslation('app');
  if (storyPoints.length === 0 && !editing) {
    return <EmptyState message={t('sidebarLeft.shared.noStoryPointsYet')} />;
  }

  if (editing) {
    return (
      <div className="space-y-3">
        {storyPoints.map((sp) => (
          <div key={sp.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={sp.title}
                onChange={(e) => {
                  const next = [...storyPoints];
                  const idx = next.findIndex((n) => n.id === sp.id);
                  if (idx >= 0) next[idx] = { ...next[idx], title: e.target.value };
                  setStoryPoints(next);
                }}
                placeholder={t('sidebarLeft.shared.titlePlaceholder')}
                className={`${FIELD_STYLE} flex-1`}
              />
              <span className="text-xs text-gray-500 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={sp.significance}
                  onChange={(e) => {
                    const next = [...storyPoints];
                    const idx = next.findIndex((n) => n.id === sp.id);
                    if (idx >= 0) next[idx] = { ...next[idx], significance: Number(e.target.value) };
                    setStoryPoints(next);
                  }}
                  className={`${FIELD_STYLE_SM} w-14 text-center`}
                />
                /10
              </span>
              <button
                type="button"
                onClick={() => setStoryPoints(storyPoints.filter((s) => s.id !== sp.id))}
                className="text-xs text-red-400 hover:text-red-300 px-1"
              >
                &times;
              </button>
            </div>
            <textarea
              value={sp.description}
              onChange={(e) => {
                const next = [...storyPoints];
                const idx = next.findIndex((n) => n.id === sp.id);
                if (idx >= 0) next[idx] = { ...next[idx], description: e.target.value };
                setStoryPoints(next);
              }}
              placeholder={t('sidebarLeft.shared.descriptionPlaceholder')}
              rows={2}
              className={`${FIELD_STYLE} resize-none`}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setStoryPoints([
              ...storyPoints,
              {
                id: `sp-new-${Date.now()}`,
                title: '',
                description: '',
                significance: 5,
                characters: [],
              },
            ])
          }
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {t('sidebarLeft.shared.addStoryPoint')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {storyPoints.map((sp) => (
        <div key={sp.id} className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-100">{sp.title}</span>
            <span className="text-xs text-gray-500">{sp.significance}/10</span>
          </div>
          <div className="mt-0.5 text-xs text-gray-400">{sp.description}</div>
        </div>
      ))}
    </div>
  );
}

// ── Shared small components ───────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
