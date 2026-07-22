import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import type { PlanNode, PlanNodeStatus } from '../../../../shared/types';

/* ─── Node type display config ──────────────────────────────────────────── */

const NODE_CONFIG = {
  chapter: { icon: '📖' },
  scene: { icon: '🎬' },
  beat: { icon: '💡' },
  note: { icon: '📝' },
} as const;

/* ─── Status options (must match StatusDot.tsx) ─────────────────────────── */

const STATUS_OPTIONS: { value: PlanNodeStatus; dotClass: string }[] = [
  { value: 'draft', dotClass: 'bg-gray-500' },
  { value: 'in_progress', dotClass: 'bg-amber-400' },
  { value: 'complete', dotClass: 'bg-green-400' },
  { value: 'cut', dotClass: 'bg-red-400' },
];

const STATUS_COLORS: Record<PlanNodeStatus, string> = {
  draft: 'bg-gray-500',
  in_progress: 'bg-amber-400',
  complete: 'bg-green-400',
  cut: 'bg-red-400',
};

const STATUS_LABEL_KEYS: Record<PlanNodeStatus, string> = {
  draft: 'planner.nodeInspector.statusOptions.draft',
  in_progress: 'planner.nodeInspector.statusOptions.inProgress',
  complete: 'planner.nodeInspector.statusOptions.complete',
  cut: 'planner.nodeInspector.statusOptions.cut',
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function truncateId(id: string): string {
  if (id.length <= 8) return id;
  return id.slice(0, 4) + '…' + id.slice(-4);
}

/* ========================================================================
   NodeInspector
   ======================================================================== */

export function NodeInspector() {
  const { t } = useTranslation();
  const { canvasSelection, planModel, updateNode, deleteNode, addNode, setAppView, setActiveContent, activeBookId } = useAppStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ── Derive selected node ───────────────────────────────────────────── */

  const selectedNode =
    canvasSelection.length === 1
      ? planModel?.nodes.find((n) => n.id === canvasSelection[0]) ?? null
      : null;

  const nodeType = selectedNode?.type ?? null;
  const nodeConfig = nodeType ? NODE_CONFIG[nodeType] : null;
  const nodeData = selectedNode?.data ?? null;

  /* ── Change handlers ────────────────────────────────────────────────── */

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedNode) updateNode(selectedNode.id, { label: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (selectedNode) updateNode(selectedNode.id, { description: e.target.value });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (selectedNode) updateNode(selectedNode.id, { status: e.target.value as PlanNodeStatus });
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (selectedNode) updateNode(selectedNode.id, { level: e.target.value as 'act' | 'chapter' | undefined });
  };

  const handleSubplotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedNode) updateNode(selectedNode.id, { subplotId: e.target.value || undefined });
  };

  const handleCharactersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedNode) return;
    const raw = e.target.value;
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateNode(selectedNode.id, { characters: names.length > 0 ? names : undefined });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (selectedNode) updateNode(selectedNode.id, { notes: e.target.value || undefined });
  };

  /* ── Delete (with confirmation) ─────────────────────────────────────── */

  const handleDelete = useCallback(() => {
    if (!selectedNode) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteNode(selectedNode.id);
    setConfirmDelete(false);
  }, [selectedNode, confirmDelete, deleteNode]);

  const cancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  /* ── Duplicate ──────────────────────────────────────────────────────── */

  const handleDuplicate = useCallback(() => {
    if (!selectedNode || !planModel) return;

    const newNode: PlanNode = {
      id: crypto.randomUUID(),
      type: selectedNode.type,
      data: { ...selectedNode.data },
      position: {
        x: selectedNode.position.x + 50,
        y: selectedNode.position.y + 50,
      },
    };

    addNode(newNode);
  }, [selectedNode, planModel, addNode]);

  /* ── Empty state ────────────────────────────────────────────────────── */

  if (!selectedNode) {
    return (
      <aside className="planner-inspector w-full shrink-0 bg-[var(--theme-surface)]">
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-2)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-[var(--theme-text-mute)]"
            >
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--theme-text-dim)]">
            {t('planner.nodeInspector.selectNode', { ns: 'app' })}
          </p>
          <p className="mt-1 text-xs text-[var(--theme-text-mute)]">
            {t('planner.nodeInspector.selectNodeHint', { ns: 'app' })}
          </p>
        </div>
      </aside>
    );
  }

  /* ── Active state ───────────────────────────────────────────────────── */

  const statusDot = STATUS_COLORS[nodeData!.status];

  return (
    <aside className="planner-inspector w-full shrink-0 bg-[var(--theme-surface)]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--theme-border)] px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none" role="img" aria-hidden>
            {nodeConfig!.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-[var(--theme-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-dim)]">
                {t(`planner.canvas.nodeTypes.${nodeType}`, { ns: 'app' })}
              </span>
              <span className="text-[10px] font-mono text-[var(--theme-text-mute)]">
                {truncateId(selectedNode.id)}
              </span>
            </div>
          </div>
        </div>

        {/* Status pill */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${statusDot}`} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--theme-text-dim)]">
            {t(STATUS_LABEL_KEYS[nodeData!.status], { ns: 'app' })}
          </span>
        </div>
      </div>

      {/* ── Scrollable form body ────────────────────────────────────── */}
      <div className="overflow-y-auto" style={{ height: 'calc(100% - 130px)' }}>
        <div className="space-y-4 p-3">
          {/* Label */}
          <Field label={t('planner.nodeInspector.label', { ns: 'app' })}>
            <input
              type="text"
              value={nodeData!.label}
              onChange={handleLabelChange}
              placeholder={t('planner.nodeInspector.labelPlaceholder', { ns: 'app' })}
              className="focus-ring w-full rounded border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1.5 text-sm text-[var(--theme-text)] placeholder-[var(--theme-text-mute)] transition-colors hover:border-gray-500 focus:border-blue-500/60 focus:outline-none"
            />
          </Field>

          {/* Description */}
          <Field label={t('planner.nodeInspector.description', { ns: 'app' })}>
            <textarea
              value={nodeData!.description ?? ''}
              onChange={handleDescriptionChange}
              placeholder={t('planner.nodeInspector.descriptionPlaceholder', { ns: 'app' })}
              rows={3}
              className="focus-ring w-full resize-none rounded border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1.5 text-sm text-[var(--theme-text)] placeholder-[var(--theme-text-mute)] transition-colors hover:border-gray-500 focus:border-blue-500/60 focus:outline-none"
            />
          </Field>

          {/* Status */}
          <Field label={t('planner.nodeInspector.status', { ns: 'app' })}>
            <div className="relative">
              <select
                value={nodeData!.status}
                onChange={handleStatusChange}
                className="focus-ring w-full appearance-none rounded border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1.5 pr-8 text-sm text-[var(--theme-text)] transition-colors hover:border-gray-500 focus:border-blue-500/60 focus:outline-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(STATUS_LABEL_KEYS[opt.value], { ns: 'app' })}
                  </option>
                ))}
              </select>
              {/* Colored dot indicator */}
              <span
                className={`pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 inline-block h-1.5 w-1.5 rounded-full ${statusDot}`}
              />
              {/* Chevron */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-mute)]"
              >
                <path
                  d="M3 5l3 3 3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Field>

          {/* ── Type-specific fields ──────────────────────────────── */}
          {nodeType === 'chapter' && (
            <Field label={t('planner.nodeInspector.level', { ns: 'app' })}>
              <select
                value={nodeData!.level ?? 'chapter'}
                onChange={handleLevelChange}
                className="focus-ring w-full appearance-none rounded border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1.5 pr-8 text-sm text-[var(--theme-text)] transition-colors hover:border-gray-500 focus:border-blue-500/60 focus:outline-none"
              >
                <option value="act">{t('planner.nodeInspector.levelAct', { ns: 'app' })}</option>
                <option value="chapter">{t('planner.nodeInspector.levelChapter', { ns: 'app' })}</option>
              </select>
            </Field>
          )}

          {nodeType === 'beat' && (
            <Field label={t('planner.nodeInspector.subplotId', { ns: 'app' })}>
              <input
                type="text"
                value={nodeData!.subplotId ?? ''}
                onChange={handleSubplotChange}
                placeholder={t('planner.nodeInspector.subplotIdPlaceholder', { ns: 'app' })}
                className="focus-ring w-full rounded border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1.5 text-sm text-[var(--theme-text)] placeholder-[var(--theme-text-mute)] transition-colors hover:border-gray-500 focus:border-blue-500/60 focus:outline-none"
              />
            </Field>
          )}

          {/* Characters */}
          <Field label={t('planner.nodeInspector.characters', { ns: 'app' })}>
            <input
              type="text"
              value={(nodeData!.characters ?? []).join(', ')}
              onChange={handleCharactersChange}
              placeholder={t('planner.nodeInspector.charactersPlaceholder', { ns: 'app' })}
              className="focus-ring w-full rounded border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1.5 text-sm text-[var(--theme-text)] placeholder-[var(--theme-text-mute)] transition-colors hover:border-gray-500 focus:border-blue-500/60 focus:outline-none"
            />
            {(nodeData!.characters ?? []).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {nodeData!.characters!.map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </Field>

          {/* Notes */}
          <Field label={t('planner.nodeInspector.notes', { ns: 'app' })}>
            <textarea
              value={nodeData!.notes ?? ''}
              onChange={handleNotesChange}
              placeholder={t('planner.nodeInspector.notesPlaceholder', { ns: 'app' })}
              rows={4}
              className="focus-ring w-full resize-none rounded border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1.5 text-sm text-[var(--theme-text)] placeholder-[var(--theme-text-mute)] transition-colors hover:border-gray-500 focus:border-blue-500/60 focus:outline-none"
            />
          </Field>
        </div>
      </div>

      {/* ── Generated Chapter link ─────────────────────────────────── */}
      {nodeData?.generatedChapterId && (
        <div className="border-t border-[var(--theme-border)] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-xs">✓</span>
            <span className="text-xs text-[var(--theme-text-mute)]">{t('planner.nodeInspector.generated', { ns: 'app' })}</span>
            <button
              type="button"
              onClick={() => {
                if (activeBookId && nodeData?.generatedChapterId) {
                  setActiveContent({ kind: 'chapter', bookId: activeBookId, chapterId: nodeData.generatedChapterId as string });
                  setAppView('author');
                }
              }}
              className="focus-ring ml-auto flex items-center gap-1 rounded border border-[var(--theme-border)] px-2 py-1 text-xs text-blue-400 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300"
            >
              {t('planner.nodeInspector.viewChapter', { ns: 'app' })}
            </button>
          </div>
        </div>
      )}

      {/* ── Footer actions (sticky) ────────────────────────────────── */}
      <div className="border-t border-[var(--theme-border)] px-3 py-3">
        <div className="flex flex-col gap-2">
          {/* Duplicate */}
          <button
            type="button"
            onClick={handleDuplicate}
            className="focus-ring flex items-center justify-center gap-1.5 rounded border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text-dim)] transition-colors hover:border-gray-500 hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="text-current"
            >
              <rect
                x="3.5"
                y="1.5"
                width="7"
                height="8"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M1.5 3.5v7a1 1 0 001 1h5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            {t('planner.nodeInspector.duplicateNode', { ns: 'app' })}
          </button>

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="focus-ring flex-1 rounded bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                {t('planner.nodeInspector.confirmDelete', { ns: 'app' })}
              </button>
              <button
                type="button"
                onClick={cancelDelete}
                className="focus-ring rounded border border-[var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text-dim)] transition-colors hover:border-gray-500 hover:text-[var(--theme-text)]"
              >
                {t('planner.nodeInspector.cancel', { ns: 'app' })}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              className="focus-ring flex items-center justify-center gap-1.5 rounded border border-transparent px-3 py-1.5 text-xs font-medium text-red-400/80 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="text-current"
              >
                <path
                  d="M1.5 3h9M9.5 3v7a1 1 0 01-1 1h-5a1 1 0 01-1-1V3M4 3V2a1 1 0 011-1h2a1 1 0 011 1v1M4.5 5.5v3M7.5 5.5v3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t('planner.nodeInspector.deleteNode', { ns: 'app' })}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ========================================================================
   Field — small labelled wrapper
   ======================================================================== */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-[var(--theme-text-mute)]">
        {label}
      </label>
      {children}
    </div>
  );
}
