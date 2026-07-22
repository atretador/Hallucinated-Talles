import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { computeDiff } from '../../utils/diff';
import type { DiffLine } from '../../utils/diff';

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  onAccept: () => void;
  onReject: () => void;
}

function DiffLineRow({ line, prefersReduced }: { line: DiffLine; prefersReduced: boolean }) {
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
      <span className="w-8 shrink-0 text-right text-gray-600 select-none">
        {line.lineNum ?? ''}
      </span>
      <span
        className={`w-4 shrink-0 select-none ${
          line.type === 'add'
            ? 'text-green-400'
            : line.type === 'remove'
              ? 'text-red-400'
              : 'text-gray-500'
        }`}
      >
        {prefix}
      </span>
      <span className="flex-1">{line.text}</span>
    </motion.div>
  );
}

export function DiffViewer({ oldContent, newContent, onAccept, onReject }: DiffViewerProps) {
  const diff = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);
  const prefersReduced = useReducedMotion() ?? false;
  const { t } = useTranslation();

  const addCount = diff.filter((l) => l.type === 'add').length;
  const removeCount = diff.filter((l) => l.type === 'remove').length;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-200">{t('editor.aiEditSidePanel.proposedChangesHeader', { ns: 'app' })}</span>
          <span className="text-xs text-green-400">+{addCount}</span>
          <span className="text-xs text-red-400">-{removeCount}</span>
        </div>
        <div className="flex gap-2">
          <motion.button
            type="button"
            onClick={onReject}
            whileTap={prefersReduced ? {} : { scale: 0.97 }}
            className="rounded border border-red-700 bg-red-900/50 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-800/50"
          >
            {t('buttons.reject', { ns: 'common' })}
          </motion.button>
          <motion.button
            type="button"
            onClick={onAccept}
            whileTap={prefersReduced ? {} : { scale: 0.97 }}
            className="rounded border border-green-700 bg-green-900/50 px-3 py-1 text-xs font-medium text-green-300 transition-colors hover:bg-green-800/50"
          >
            {t('buttons.accept', { ns: 'common' })}
          </motion.button>
        </div>
      </div>

      {/* Diff content */}
      <div className="max-h-64 overflow-y-auto bg-gray-900 font-mono text-xs leading-relaxed text-gray-200">
        {diff.map((line, i) => (
          <DiffLineRow key={i} line={line} prefersReduced={prefersReduced} />
        ))}
      </div>
    </div>
  );
}
