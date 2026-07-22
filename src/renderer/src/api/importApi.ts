import { request, getStandardHeaders } from './base';
import type { ImportState } from '../../../shared/types';

// ── Import API (SSE streaming) ──────────────────────────────────────────────────

export interface ImportParams {
  bookName: string;
  filePath: string;
  startPage?: number;
  endPage?: number;
  providerId?: string;
  model?: string;
  effort?: string;
  chapterHints?: string;
}

/**
 * Fetch the saved import state for a book, if any.
 * Returns null if no state exists or the book doesn't exist.
 */
export async function getImportState(bookId: string): Promise<ImportState | null> {
  const response = await request(`/import/state?bookId=${encodeURIComponent(bookId)}`);
  return (response as any).data ?? null;
}

/**
 * Quick page count detection for a file — returns total number of pages.
 */
export async function getPageCount(filePath: string): Promise<number> {
  const port = window.electron?.getApiPort() ?? '3000';
  const response = await fetch(
    `http://localhost:${port}/api/import/page-count?filePath=${encodeURIComponent(filePath)}`,
    { headers: getStandardHeaders() },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  const body = await response.json();
  return body.totalPages ?? 1;
}

export type ImportEvent =
  | { type: 'status'; data: { status: string; message?: string } }
  | { type: 'settings'; data: { settings: unknown; bookId: string } }
  | { type: 'progress'; data: { page: number; totalPages: number; message: string; content?: string } }
  | { type: 'page_complete'; data: { page: number; completionTokens: number; durationMs: number } }
  | { type: 'token_update'; data: { page: number; completionTokens: number; durationMs: number } }
  | { type: 'entity'; data: { type: string; action: string; name: string } }
  | { type: 'complete'; data: { summary: string; bookId: string; totalPages: number; warnings?: string[]; warningReportPath?: string } }
  | { type: 'error'; data: { error: string } };

/**
 * Start a book import with SSE streaming progress.
 * Call onEvent for each SSE event received.
 * Pass an AbortSignal to cancel the import.
 */
export async function startImport(
  params: ImportParams,
  onEvent: (event: ImportEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const port = window.electron?.getApiPort() ?? '3000';
  const response = await fetch(`http://localhost:${port}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getStandardHeaders() },
    body: JSON.stringify(params),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errorBody.error || 'Import failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';
  let completeReceived = false;

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const val = line.slice(5).trim();
        currentData += (currentData ? '\n' : '') + val;
      } else if (line === '') {
        // Empty line dispatches the event (SSE spec)
        if (currentData) {
          try {
            const data = JSON.parse(currentData);
            switch (currentEvent) {
              case 'status':
                onEvent({ type: 'status', data });
                break;
              case 'settings':
                onEvent({ type: 'settings', data });
                break;
              case 'progress':
                onEvent({ type: 'progress', data });
                break;
              case 'page_complete':
                onEvent({ type: 'page_complete', data });
                break;
              case 'token_update':
                onEvent({ type: 'token_update', data });
                break;
              case 'entity':
                onEvent({ type: 'entity', data });
                break;
              case 'complete':
                completeReceived = true;
                onEvent({ type: 'complete', data });
                break;
              case 'error':
                completeReceived = true;
                onEvent({ type: 'error', data });
                break;
            }
          } catch {
            console.debug('[importApi] Skipping malformed JSON lines');
            // skip malformed JSON lines
          }
        }
        currentEvent = '';
        currentData = '';
      }
    }
  }

  if (!completeReceived) {
    throw new Error('Import stream ended without completion signal');
  }
}
