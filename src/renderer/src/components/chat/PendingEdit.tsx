import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { PendingEdit as PendingEditType } from '../../../../shared/types';
import { computeDiff } from '../../utils/diff';

interface PendingEditProps {
  edit: PendingEditType;
  onAccept: (editId: string) => Promise<void>;
  onReject: (editId: string) => Promise<void>;
}

export function PendingEdit({ edit, onAccept, onReject }: PendingEditProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [done, setDone] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await onAccept(edit.id);
      setDone(true);
    } catch {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await onReject(edit.id);
      setDone(true);
    } catch {
      setRejecting(false);
    }
  };

  if (done) {
    return null;
  }

  const toolLabel =
    edit.tool === 'editContent' ? t('chat.pendingEdit.replaceDocument', { ns: 'app' }) :
    edit.tool === 'editRange' ? t('chat.pendingEdit.editRange', { ns: 'app' }) :
    edit.tool === 'appendToContent' ? t('chat.pendingEdit.appendToContent', { ns: 'app' }) :
    edit.tool === 'insertChapter' ? t('chat.pendingEdit.insertChapter', { ns: 'app' }) :
    edit.tool === 'deleteChapter' ? t('chat.pendingEdit.deleteChapter', { ns: 'app' }) :
    edit.tool;

  const diffLines = edit.before != null ? computeDiff(edit.before, edit.preview) : [];

  return (
    <div className="my-2 rounded border border-yellow-600/50 bg-yellow-900/20 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-yellow-700/40 px-2 py-0.5 text-xs font-medium text-yellow-300">
          {t('chat.pendingEdit.pendingEdit', { ns: 'app' })}
        </span>
        <span className="text-xs font-medium text-gray-300">{toolLabel}</span>
      </div>

      {showDiff && diffLines.length > 0 ? (
        <div className="mb-3 max-h-60 overflow-y-auto rounded bg-gray-800/50 p-2 font-mono text-xs">
          {diffLines.map((line, i) => {
            let className = 'whitespace-pre-wrap break-words text-gray-400';
            let prefix = ' ';
            if (line.type === 'add') {
              className = 'whitespace-pre-wrap break-words bg-green-900/30 text-green-300';
              prefix = '+';
            } else if (line.type === 'remove') {
              className = 'whitespace-pre-wrap break-words bg-red-900/30 text-red-300';
              prefix = '-';
            }
            return (
              <div key={i} className={className}>
                {prefix}{line.text}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-3 max-h-40 overflow-y-auto rounded bg-gray-800/50 p-2 font-mono text-xs text-gray-300">
          <pre className="whitespace-pre-wrap break-words">{edit.preview}</pre>
        </div>
      )}

      <div className="flex gap-2">
        {edit.before != null && (
          <motion.button
            onClick={() => setShowDiff((v) => !v)}
            className="flex items-center gap-1 rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-600"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          >
            {showDiff ? t('chat.pendingEdit.hideChanges', { ns: 'app' }) : t('chat.pendingEdit.viewChanges', { ns: 'app' })}
          </motion.button>
        )}
        <motion.button
          onClick={handleAccept}
          disabled={accepting || rejecting}
          className="flex items-center gap-1 rounded bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
          whileHover={shouldReduceMotion ? undefined : { scale: 1.01, boxShadow: '0 0 12px rgba(34, 197, 94, 0.35)' }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          {accepting ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t('chat.pendingEdit.accepting', { ns: 'app' })}
            </>
          ) : (
            <>{t('chat.pendingEdit.accept', { ns: 'app' })}</>
          )}
        </motion.button>
        <motion.button
          onClick={handleReject}
          disabled={accepting || rejecting}
          className="rounded bg-red-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          whileHover={shouldReduceMotion ? undefined : { scale: 1.01, boxShadow: '0 0 12px rgba(239, 68, 68, 0.35)' }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        >
          {rejecting ? t('chat.pendingEdit.rejecting', { ns: 'app' }) : t('chat.pendingEdit.reject', { ns: 'app' })}
        </motion.button>
      </div>
    </div>
  );
}
