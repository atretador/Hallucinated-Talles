import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { DiffLine } from '../../utils/diff';
import type { PendingEdit } from '../../../../shared/types';

/* ── Diff line component ─────────────────────────────── */

export function DiffLineRow({ line, prefersReduced }: { line: DiffLine; prefersReduced: boolean }) {
  const bgClass =
    line.type === 'add'
      ? 'bg-green-900/30'
      : line.type === 'remove'
        ? 'bg-red-900/30'
        : '';
  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
  const isChanged = line.type === 'add' || line.type === 'remove';

  return (
    <motion.div
      className={`flex whitespace-pre-wrap ${bgClass}`}
      initial={isChanged && !prefersReduced ? { backgroundColor: 'rgba(59,130,246,0.15)' } : {}}
      animate={isChanged && !prefersReduced ? { backgroundColor: 'rgba(59,130,246,0)' } : {}}
      transition={isChanged && !prefersReduced ? { duration: 0.6, ease: 'easeOut' } : {}}
    >
      <span className="w-8 shrink-0 text-right text-gray-600 select-none text-[11px]">
        {line.lineNum ?? ''}
      </span>
      <span
        className={`w-4 shrink-0 select-none text-[11px] ${
          line.type === 'add'
            ? 'text-green-400'
            : line.type === 'remove'
              ? 'text-red-400'
              : 'text-gray-500'
        }`}
      >
        {prefix}
      </span>
      <span className="flex-1 text-[11px]">{line.text}</span>
    </motion.div>
  );
}

/* ── Diff content (pending phase) ────────────────────── */

interface AiDiffContentProps {
  diff: DiffLine[];
  addCount: number;
  removeCount: number;
  prefersReduced: boolean;
  pendingEdit: PendingEdit;
}

export function AiDiffContent({ diff, addCount, removeCount, prefersReduced, pendingEdit }: AiDiffContentProps) {
  const { t } = useTranslation();

  return (
    <div className="p-4">
      {/* Stats */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-medium text-gray-200">{t('editor.aiEditSidePanel.proposedChangesHeader', { ns: 'app' })}</span>
        {addCount > 0 && <span className="text-xs text-green-400">+{addCount}</span>}
        {removeCount > 0 && <span className="text-xs text-red-400">-{removeCount}</span>}
      </div>

      {/* Diff */}
      <div className="rounded-lg border border-gray-700 overflow-hidden">
        <div className="max-h-64 overflow-y-auto bg-gray-900 font-mono text-xs leading-relaxed text-gray-200">
          {diff.length > 0 ? (
            diff.map((line, i) => (
              <DiffLineRow key={i} line={line} prefersReduced={prefersReduced} />
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              {t('editor.aiEditSidePanel.noDiff', { ns: 'app' })}
              <pre className="mt-2 text-left whitespace-pre-wrap text-gray-300">
                {pendingEdit.preview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
