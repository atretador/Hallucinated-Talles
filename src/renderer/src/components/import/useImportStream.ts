import { useCallback, useEffect, useRef, useState } from 'react';
import { startImport } from '../../api/client';
import type { AiEffort } from '../../../../shared/types';

/* ── Types ───────────────────────────────────────────────────────────────────── */

export interface EntityItem {
  id: string;
  type: string;
  name: string;
}

export interface ProgressState {
  page: number;
  totalPages: number;
  message: string;
  tkPerSec: number;
}

export interface StartImportParams {
  bookName: string;
  filePath: string;
  startPage: number;
  endPage: number;
  providerId?: string;
  model?: string;
  effort: AiEffort;
  chapterHints?: string;
}

export interface ImportStreamCallbacks {
  onStepChange?: (step: 'importing' | 'done' | 'configure') => void;
  onComplete?: (bookId: string) => void;
  onMinimizeChange?: (minimized: boolean) => void;
}

/* ── Hook ────────────────────────────────────────────────────────────────────── */

export function useImportStream() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    page: 0,
    totalPages: 0,
    message: '',
    tkPerSec: 0,
  });
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [warningReportPath, setWarningReportPath] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);
  const entityIdCounter = useRef(0);
  const entityKeysRef = useRef(new Set<string>());
  const bookIdRef = useRef<string>('');
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (completeTimeoutRef.current !== null) {
        clearTimeout(completeTimeoutRef.current);
      }
    };
  }, []);

  // ── Reset stream state ──
  const clearStreamState = useCallback(() => {
    setIsImporting(false);
    setProgress({ page: 0, totalPages: 0, message: '', tkPerSec: 0 });
    setEntities([]);
    setError(null);
    setWarnings([]);
    setWarningReportPath(undefined);
    entityIdCounter.current = 0;
    entityKeysRef.current.clear();
  }, []);

  // ── Cancel import ──
  const cancelImport = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsImporting(false);
    setError(null);
  }, []);

  // ── Start import ──
  const handleStartImport = useCallback(
    async (params: StartImportParams, callbacks: ImportStreamCallbacks) => {
      setIsImporting(true);
      setError(null);
      setEntities([]);
      setWarnings([]);
      setWarningReportPath(undefined);
      entityIdCounter.current = 0;
      entityKeysRef.current.clear();
      setProgress({
        page: 0,
        totalPages: 0,
        message: 'Starting import...',
        tkPerSec: 0,
      });
      callbacks?.onStepChange?.('importing');

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await startImport(
          {
            bookName: params.bookName,
            filePath: params.filePath,
            startPage: params.startPage,
            endPage: params.endPage,
            providerId: params.providerId || undefined,
            model: params.model || undefined,
            effort: params.effort,
            chapterHints: params.chapterHints || undefined,
          },
          (event) => {
            switch (event.type) {
              case 'status':
                setProgress((prev) => ({
                  ...prev,
                  message: event.data.message || event.data.status,
                }));
                break;

              case 'settings':
                if (event.data.bookId) {
                  bookIdRef.current = event.data.bookId;
                }
                break;

              case 'progress':
                setProgress((prev) => ({
                  page: event.data.page,
                  totalPages: event.data.totalPages,
                  message: event.data.message,
                  tkPerSec:
                    event.data.page === prev.page ? prev.tkPerSec : 0,
                }));
                break;

              case 'page_complete':
                setProgress((prev) => ({
                  ...prev,
                  tkPerSec:
                    event.data.durationMs > 0
                      ? Math.round(
                          (event.data.completionTokens /
                            (event.data.durationMs / 1000)) *
                            10,
                        ) / 10
                      : 0,
                }));
                break;

              case 'token_update':
                setProgress((prev) => ({
                  ...prev,
                  tkPerSec:
                    event.data.durationMs > 0
                      ? Math.round(
                          (event.data.completionTokens /
                            (event.data.durationMs / 1000)) *
                            10,
                        ) / 10
                      : 0,
                }));
                break;

              case 'entity': {
                if (event.data.action === 'merged') break;
                const normalizedName = event.data.name
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, ' ');
                if (!normalizedName) break;
                const entityKey = `${event.data.type}:${normalizedName}`;
                if (entityKeysRef.current.has(entityKey)) break;
                if (
                  event.data.type === 'world' &&
                  entityKeysRef.current.has(`character:${normalizedName}`)
                )
                  break;
                if (
                  event.data.type === 'character' &&
                  entityKeysRef.current.has(`world:${normalizedName}`)
                ) {
                  entityKeysRef.current.delete(`world:${normalizedName}`);
                }
                entityKeysRef.current.add(entityKey);
                entityIdCounter.current += 1;
                setEntities((prev) => {
                  const withoutConflictingWorld =
                    event.data.type === 'character'
                      ? prev.filter(
                          (entity) =>
                            !(
                              entity.type === 'world' &&
                              entity.name
                                .trim()
                                .toLowerCase()
                                .replace(/\s+/g, ' ') === normalizedName
                            ),
                        )
                      : prev;
                  return [
                    ...withoutConflictingWorld,
                    {
                      id: `entity-${entityIdCounter.current}`,
                      type: event.data.type,
                      name: event.data.name,
                    },
                  ];
                });
                break;
              }

              case 'complete':
                setProgress((prev) => ({
                  ...prev,
                  message: `Complete! ${event.data.summary}`,
                }));
                setWarnings(event.data.warnings || []);
                setWarningReportPath(event.data.warningReportPath);
                callbacks?.onMinimizeChange?.(false);
                callbacks?.onStepChange?.('done');
                if (completeTimeoutRef.current !== null) {
                  clearTimeout(completeTimeoutRef.current);
                }
                completeTimeoutRef.current = setTimeout(() => {
                  completeTimeoutRef.current = null;
                  callbacks?.onComplete?.(
                    event.data.bookId || bookIdRef.current,
                  );
                }, 800);
                break;

              case 'error':
                setError(event.data.error);
                setIsImporting(false);
                callbacks?.onMinimizeChange?.(false);
                callbacks?.onStepChange?.('configure');
                break;
            }
          },
          controller.signal,
        );
      } catch (err: unknown) {
        if (
          (err as Error)?.name === 'AbortError' ||
          controller.signal.aborted
        ) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsImporting(false);
        callbacks?.onStepChange?.('configure');
      }
    },
    [],
  );

  return {
    isImporting,
    progress,
    entities,
    error,
    warnings,
    warningReportPath,
    startImport: handleStartImport,
    cancelImport,
    clearStreamState,
  };
}
