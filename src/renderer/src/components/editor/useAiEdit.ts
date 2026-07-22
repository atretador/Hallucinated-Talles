import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useReducedMotion } from 'motion/react';
import { streamChat } from '../../api/chatClient';
import { computeDiff } from '../../utils/diff';
import { getApiBase, getStandardHeaders } from '../../api/client';
import { useToolApprovals } from '../../hooks/useToolApprovals';
import type { PendingEdit, AiEffort } from '../../../../shared/types';

/* ── Types ───────────────────────────────────────────── */

export type EditAction = 'rewrite' | 'tweak' | 'remove';
export type EditPhase = 'streaming' | 'pending' | 'accepted' | 'rejected' | 'error';

export interface EditContext {
  action: EditAction;
  prompt: string;
  selectedText: string;
  fullContent: string;
  from: number;
  to: number;
  feedback?: string;
}

/* ── Hook ────────────────────────────────────────────── */

export function useAiEdit(
  editCtx: EditContext,
  sessionId: string | null,
  retryKey: number,
  onClose: () => void,
  onRetry: () => void,
  effort?: AiEffort,
) {
  const [phase, setPhase] = useState<EditPhase>('streaming');
  const [streamingText, setStreamingText] = useState('');
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // FIX #1: Use a ref to track whether a pending edit was received,
  // so onDone's closure always sees the latest value.
  const pendingEditReceivedRef = useRef(false);
  const prefersReduced = useReducedMotion() ?? false;
  const { approvals } = useToolApprovals();
  // Ref for onClose to avoid stale closure issues in setTimeout callbacks.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // FIX #2: Diff full page content (old) against full page content (new),
  // not selectedText vs full preview.
  const diff = useMemo(() => {
    if (!pendingEdit) return [];
    return computeDiff(editCtx.fullContent, pendingEdit.preview);
  }, [pendingEdit, editCtx.fullContent]);

  const addCount = diff.filter((l) => l.type === 'add').length;
  const removeCount = diff.filter((l) => l.type === 'remove').length;

  // Start streaming on mount (or when retryKey changes)
  useEffect(() => {
    let cancelled = false;
    // Reset state for a fresh run
    setPhase('streaming');
    setStreamingText('');
    setPendingEdit(null);
    setErrorMsg('');
    pendingEditReceivedRef.current = false;

    const run = async () => {
      try {
        const sid = sessionId;

        const controller = new AbortController();
        abortRef.current = controller;

        await streamChat(
          editCtx.prompt,
          [],   // empty history — editor-inline doesn't pollute chat
          {
            onToken: (content) => {
              if (!cancelled) setStreamingText((prev) => prev + content);
            },
            onThinking: () => {},
            onToolCall: () => {},
            onToolResult: () => {},
            onPendingEdit: (pe) => {
              if (!cancelled) {
                pendingEditReceivedRef.current = true;
                setPendingEdit(pe);
                setPhase('pending');
              }
            },
            onDone: () => {
              if (!cancelled) {
                // FIX #1: Use the ref instead of stale state closure.
                // If no pending edit was received, the AI responded with text only
                // (no editSection tool call) — treat as completed.
                if (!pendingEditReceivedRef.current) {
                  setPhase('accepted');
                  setTimeout(() => onCloseRef.current(), 800);
                }
              }
            },
            onError: (error) => {
              if (!cancelled) {
                setErrorMsg(error);
                setPhase('error');
              }
            },
          },
          controller.signal,
          sid || undefined,
          effort,
          undefined, // subAgentsEnabled
          undefined, // images
          undefined, // bookIdOverride
          approvals, // toolApprovals
          'editor-inline', // source
        );
      } catch (error) {
        if (!cancelled) {
          // Don't show error for intentional aborts (try again / close)
          if ((error as Error).name !== 'AbortError') {
            setErrorMsg((error as Error).message);
            setPhase('error');
          }
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
    // FIX #4: retryKey triggers a fresh effect run on retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  const handleAccept = useCallback(async () => {
    if (!pendingEdit) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/chat/accept-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getStandardHeaders() },
        body: JSON.stringify({ editId: pendingEdit.id }),
      });
      if (response.ok) {
        const result = await response.json();
        setPhase('accepted');
        // Notify editor to refresh with new document content
        if (result.content) {
          window.dispatchEvent(new CustomEvent('document-content-updated', {
            detail: { content: result.content },
          }));
        }
        setTimeout(() => onCloseRef.current(), 600);
      } else {
        // FIX #5: Show error to user instead of silently failing.
        const body = await response.text().catch(() => '');
        setErrorMsg(`Accept failed (${response.status}): ${body || 'Unknown error'}`);
        setPhase('error');
      }
    } catch (err) {
      setErrorMsg(`Accept failed: ${(err as Error).message}`);
      setPhase('error');
    } finally {
      setActionLoading(false);
    }
  }, [pendingEdit]);

  const handleReject = useCallback(async () => {
    if (!pendingEdit) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/chat/reject-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getStandardHeaders() },
        body: JSON.stringify({ editId: pendingEdit.id }),
      });
      if (response.ok) {
        setPhase('rejected');
        setTimeout(() => onCloseRef.current(), 600);
      } else {
        const body = await response.text().catch(() => '');
        setErrorMsg(`Reject failed (${response.status}): ${body || 'Unknown error'}`);
        setPhase('error');
      }
    } catch (err) {
      setErrorMsg(`Reject failed: ${(err as Error).message}`);
      setPhase('error');
    } finally {
      setActionLoading(false);
    }
  }, [pendingEdit]);

  const handleTryAgain = useCallback(() => {
    abortRef.current?.abort();
    onRetry();
  }, [onRetry]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  return {
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
  };
}
