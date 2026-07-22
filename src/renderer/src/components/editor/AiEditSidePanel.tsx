import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { EditContext } from './useAiEdit';
import { useAiEdit } from './useAiEdit';
import { AiDiffContent } from './AiDiffViewer';
import type { AiEffort } from '../../../../shared/types';
import { useAppStore } from '../../stores';


/* ── Props ──────────────────────────────────────────── */

interface AiEditSidePanelProps {
  editCtx: EditContext;
  editor: any;
  sessionId: string | null;
  onClose: () => void;
  onTryAgain: () => void;
  retryKey: number;
  effort?: AiEffort;
}

/* ── Compact streaming progress ─────────────────────── */

function CompactStreamingProgress({ tokensPerSecond, onCancel }: { tokensPerSecond: number | null; onCancel: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="px-4 py-3">
      <div className="relative w-full">
        <div className="h-1 w-full rounded-full bg-gray-700 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-blue-500"
            initial={{ width: '0%' }}
            animate={{ width: '90%' }}
            transition={{ duration: 8, ease: 'easeInOut' }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-gray-500 border-t-blue-400" />
          {t('editor.aiEditSidePanel.aiIsWorking', { ns: 'app' })}
        </div>
        <div className="flex items-center gap-2">
          {tokensPerSecond !== null && (
            <span className="text-[11px] tabular-nums text-gray-400 font-mono">{t('editor.aiEditSidePanel.tokensPerSecond', { rate: tokensPerSecond, ns: 'app' })}</span>
          )}
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-600 bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-300 hover:bg-gray-600 transition-colors"
          >
            {t('editor.aiEditSidePanel.cancel', { ns: 'app' })}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Collapsible prompt viewer ──────────────────────── */

function PromptViewer({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="border-t border-gray-700">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span>{t('editor.aiEditSidePanel.viewCommand', { ns: 'app' })}</span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <pre className="max-h-40 overflow-y-auto rounded-lg bg-gray-900 border border-gray-700 p-3 text-[11px] leading-relaxed text-gray-400 whitespace-pre-wrap break-words font-mono">
                {prompt}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Side Panel ────────────────────────────────── */

export function AiEditSidePanel({
  editCtx,
  sessionId,
  onClose,
  onTryAgain,
  retryKey,
  effort,
}: AiEditSidePanelProps) {
  const { t } = useTranslation();
  const {
    phase,
    streamingText,
    pendingEdit,
    errorMsg,
    actionLoading,
    diff,
    addCount,
    removeCount,
    prefersReduced,
    handleAccept,
    handleReject,
    handleTryAgain,
    handleClose,
  } = useAiEdit(editCtx, sessionId, retryKey, onClose, onTryAgain, effort);

  const actionLabel =
    editCtx.action === 'rewrite' ? t('editor.aiEditSidePanel.rewrite', { ns: 'app' }) : editCtx.action === 'remove' ? t('editor.aiEditSidePanel.remove', { ns: 'app' }) : t('editor.aiEditSidePanel.tweak', { ns: 'app' });

  // ── Editor-relative positioning ──
  const minimized = useAppStore((s) => {
    const info = s.activeAiEdits.get('editor');
    return info?.minimized ?? false;
  });
  const setAiEditMinimized = useAppStore((s) => s.setAiEditMinimized);

  // ── Page-relative panel positioning ──
  const [panelPos, setPanelPos] = useState<{ top: number; left: number }>({ top: 100, left: window.innerWidth - 276 });

  useEffect(() => {
    const updatePos = () => {
      const pageEl = document.querySelector('.doc-page');
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      const left = rect.right + 12;
      // Keep panel on-screen
      const clampedLeft = Math.min(left, window.innerWidth - 276);
      setPanelPos({
        top: Math.max(rect.top, 80),
        left: clampedLeft,
      });
    };
    updatePos();
    const canvasEl = document.querySelector('.doc-canvas');
    canvasEl?.addEventListener('scroll', updatePos, { passive: true });
    window.addEventListener('resize', updatePos);
    return () => {
      canvasEl?.removeEventListener('scroll', updatePos);
      window.removeEventListener('resize', updatePos);
    };
  }, []);

  // Cancel: phase-aware — streaming aborts, pending rejects then closes, error just closes
  const handleCancel = useCallback(async () => {
    if (phase === 'pending') {
      await handleReject();
    }
    handleClose();
  }, [phase, handleReject, handleClose]);

  // Token-per-second tracking
  const startTimeRef = useRef(Date.now());
  const [tokensPerSecond, setTokensPerSecond] = useState<number | null>(null);

  // Reset start time on retry
  useEffect(() => {
    startTimeRef.current = Date.now();
    setTokensPerSecond(null);
  }, [retryKey]);

  // Compute tk/s from streaming text length (approximation since we don't have onUsage here directly)
  useEffect(() => {
    if (phase !== 'streaming' || !streamingText) return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    if (elapsed > 0.5) {
      // Rough word count to token estimate: ~1.3 tokens per word
      const words = streamingText.split(/\s+/).length;
      const estimatedTokens = Math.round(words * 1.3);
      setTokensPerSecond(Math.round(estimatedTokens / elapsed));
    }
  }, [streamingText, phase]);

  const panelContent = (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0, height: minimized ? 'auto' : undefined }}
      exit={{ opacity: 0, x: 80 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="fixed z-40 flex flex-col overflow-hidden rounded-xl border border-gray-600 shadow-2xl"
      style={{
        left: minimized ? 'auto' : panelPos.left,
        right: minimized ? undefined : 'auto',
        top: minimized ? 100 : panelPos.top,
        width: minimized ? 'auto' : 260,
        minWidth: minimized ? 140 : undefined,
        minHeight: minimized ? 'auto' : 120,
        maxHeight: minimized ? 'none' : '70vh',
        backgroundColor: '#1e2028',
        boxShadow: phase === 'streaming'
          ? '0 0 20px rgba(59,130,246,0.15), 0 8px 32px rgba(0,0,0,0.4)'
          : '0 8px 32px rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Header ── */}
      {minimized ? (
        <div className="flex items-center gap-2 border-b border-gray-700 px-3 py-2 shrink-0">
          <span className="rounded-md bg-blue-600/20 px-2 py-0.5 text-xs font-medium text-blue-400 shrink-0">
            {actionLabel}
          </span>
          {/* Status dot */}
          {phase === 'streaming' && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
          {phase === 'pending' && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}
          <button
            onClick={() => setAiEditMinimized('editor', false)}
            className="rounded p-1 text-gray-500 hover:text-gray-300 transition-colors shrink-0 ml-auto"
            title={t('editor.aiEditSidePanel.restore', { ns: 'app' })}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="rounded-md bg-blue-600/20 px-2 py-0.5 text-xs font-medium text-blue-400 shrink-0">
              {actionLabel}
            </span>
            {(phase === 'streaming' || phase === 'pending') && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500 shrink-0">
                <svg className="h-3 w-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {t('editor.aiEditSidePanel.locked', { ns: 'app' })}
              </span>
            )}
            <span className="text-[11px] text-gray-500 truncate">
              {phase === 'streaming' && t('editor.aiEditSidePanel.streaming', { ns: 'app' })}
              {phase === 'pending' && t('editor.aiEditSidePanel.proposedChanges', { ns: 'app' })}
              {phase === 'accepted' && (
                <span className="text-green-400 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('editor.aiEditSidePanel.changesApplied', { ns: 'app' })}
                </span>
              )}
              {phase === 'rejected' && (
                <span className="text-gray-400 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('editor.aiEditSidePanel.changesRejected', { ns: 'app' })}
                </span>
              )}
              {phase === 'error' && (
                <span className="text-red-400">{t('editor.aiEditSidePanel.error', { ns: 'app' })}</span>
              )}
            </span>
          </div>
          <button
            onClick={() => setAiEditMinimized('editor', !minimized)}
            className="rounded p-1 text-gray-500 hover:text-gray-300 transition-colors shrink-0 ml-2"
            title={t('editor.aiEditSidePanel.minimize', { ns: 'app' })}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Body (hidden when minimized) ── */}
      {!minimized && (<>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          {phase === 'streaming' && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CompactStreamingProgress tokensPerSecond={tokensPerSecond} onCancel={handleCancel} />
              {streamingText && (
                <div className="px-4 pb-3 border-t border-gray-700 pt-3">
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-gray-900 border border-gray-700 p-3 text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
                    {streamingText}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {phase === 'pending' && pendingEdit && (
            <motion.div
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AiDiffContent
                diff={diff}
                addCount={addCount}
                removeCount={removeCount}
                prefersReduced={prefersReduced}
                pendingEdit={pendingEdit}
              />
            </motion.div>
          )}

          {phase === 'accepted' && (
            <motion.div
              key="accepted"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 py-10"
            >
              <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-400 font-medium">{t('editor.aiEditSidePanel.changesApplied', { ns: 'app' })}</span>
            </motion.div>
          )}

          {phase === 'rejected' && (
            <motion.div
              key="rejected"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 py-10"
            >
              <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm text-gray-400">{t('editor.aiEditSidePanel.changesRejected', { ns: 'app' })}</span>
            </motion.div>
          )}

          {phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8 px-4"
            >
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm text-red-400 text-center leading-relaxed">{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      {phase === 'pending' && (
        <div className="flex items-center justify-between border-t border-gray-700 px-4 py-3 shrink-0">
          <button
            onClick={handleTryAgain}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('editor.aiEditSidePanel.tryAgain', { ns: 'app' })}
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="rounded-md border border-red-700/50 bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-800/40 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? t('editor.aiEditSidePanel.rejecting', { ns: 'app' }) : t('editor.aiEditSidePanel.reject', { ns: 'app' })}
            </button>
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="rounded-md border border-green-700/50 bg-green-900/30 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-800/40 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? t('editor.aiEditSidePanel.accepting', { ns: 'app' }) : t('editor.aiEditSidePanel.accept', { ns: 'app' })}
            </button>
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div className="flex items-center justify-between border-t border-gray-700 px-4 py-3 shrink-0">
          <button
            onClick={handleTryAgain}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('editor.aiEditSidePanel.tryAgain', { ns: 'app' })}
          </button>
          <button
            onClick={handleCancel}
            className="rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
          >
            {t('editor.aiEditSidePanel.cancel', { ns: 'app' })}
          </button>
        </div>
      )}

      {/* ── Collapsible prompt viewer (streaming & pending phases) ── */}
      {(phase === 'streaming' || phase === 'pending') && (
        <PromptViewer prompt={editCtx.prompt} />
      )}
      </>)}
    </motion.div>
  );

  return createPortal(panelContent, document.body);
}
