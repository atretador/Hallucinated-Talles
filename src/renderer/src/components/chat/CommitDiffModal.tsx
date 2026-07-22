import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { computeDiff } from '../../utils/diff';
import type { SessionCommit, CommitChange } from '../../../../shared/types';

// --- Icons (reused from CommitCard / CommitTimeline) ---

function ChangeIcon({ type }: { type: CommitChange['type'] }) {
  switch (type) {
    case 'create':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-900/50 text-green-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </span>
      );
    case 'edit':
    case 'update':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-900/50 text-blue-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </span>
      );
    case 'delete':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-900/50 text-red-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </span>
      );
  }
}



// --- Page HTML block-level diff ---

/** Strip all HTML tags, collapse whitespace, and trim to get plain text for comparison. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse an HTML string into top-level block elements.
 * Each block is returned as its outer HTML (e.g. `<p>...</p>`, `<h1>...</h1>`, `<ul>...</ul>`).
 * Text nodes between blocks are wrapped in a `<p>` for uniformity.
 */
function splitIntoBlocks(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];

  // Use a temporary DOM element to split into children
  const container = document.createElement('div');
  container.innerHTML = trimmed;

  const blocks: string[] = [];
  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) blocks.push(`<p>${text}</p>`);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      blocks.push((child as Element).outerHTML);
    }
  }

  // If the naive split produced nothing (e.g. pure text with no tags), wrap the whole thing
  if (blocks.length === 0 && trimmed) {
    blocks.push(`<p>${trimmed}</p>`);
  }

  return blocks;
}

interface BlockDiffItem {
  html: string;
  text: string;
  /** 'same' = exists in both panels, 'removed' = only in before, 'added' = only in after */
  status: 'same' | 'removed' | 'added';
}

/**
 * Compute block-level diff between two HTML strings.
 * Returns two parallel arrays: one for before blocks, one for after blocks.
 * Matching is done by comparing stripped text content.
 */
function computeBlockDiff(
  beforeHtml: string,
  afterHtml: string,
): { beforeBlocks: BlockDiffItem[]; afterBlocks: BlockDiffItem[] } {
  const oldBlocks = splitIntoBlocks(beforeHtml);
  const newBlocks = splitIntoBlocks(afterHtml);

  const oldTexts = oldBlocks.map(stripTags);
  const newTexts = newBlocks.map(stripTags);

  // Build a set of text content for quick lookup
  const newTextSet = new Set(newTexts);
  const oldTextSet = new Set(oldTexts);

  // Mark blocks as same / removed / added
  const beforeBlocks: BlockDiffItem[] = oldBlocks.map((html, i) => {
    const text = oldTexts[i];
    const isSame = newTextSet.has(text);
    return { html, text, status: isSame ? 'same' : 'removed' };
  });

  const afterBlocks: BlockDiffItem[] = newBlocks.map((html, i) => {
    const text = newTexts[i];
    const isSame = oldTextSet.has(text);
    return { html, text, status: isSame ? 'same' : 'added' };
  });

  return { beforeBlocks, afterBlocks };
}

// --- Rendered page HTML panel ---

function RenderedHtmlPanel({
  blocks,
  headerLabel,
  headerTint,
}: {
  blocks: BlockDiffItem[];
  headerLabel: string;
  headerTint: 'red' | 'green';
}) {
  const { t } = useTranslation();
  const headerBg = headerTint === 'red' ? 'bg-red-950/60 border-b border-red-900/50' : 'bg-green-950/60 border-b border-green-900/50';
  const headerText = headerTint === 'red' ? 'text-red-400' : 'text-green-400';
  const removedBg = 'bg-red-900/25 rounded-sm -mx-1 px-1';
  const addedBg = 'bg-green-900/25 rounded-sm -mx-1 px-1';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-700/70 bg-gray-800/50">
      {/* Panel header */}
      <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${headerBg} ${headerText} shrink-0`}>
        {headerTint === 'red' ? (
          <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {headerLabel}
      </div>

      {/* Scrollable page content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {blocks.length === 0 ? (
          <div className="py-8 text-center text-xs italic text-gray-500">
{t('chat.commit.empty', { ns: 'app' })}
          </div>
        ) : (
          <div
            className="page-render space-y-0"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: blocks
                .map((b) => {
                  const wrapperClass =
                    b.status === 'removed'
                      ? removedBg
                      : b.status === 'added'
                        ? addedBg
                        : '';
                  return wrapperClass
                    ? `<div class="${wrapperClass}">${b.html}</div>`
                    : b.html;
                })
                .join(''),
            }}
          />
        )}
      </div>
    </div>
  );
}

// --- Page diff view (side-by-side rendered HTML) ---

function PageDiffView({ before, after }: { before: string; after: string }) {
  const { t } = useTranslation();
  const { beforeBlocks, afterBlocks } = useMemo(
    () => computeBlockDiff(before, after),
    [before, after],
  );

  const removedCount = beforeBlocks.filter((b) => b.status === 'removed').length;
  const addedCount = afterBlocks.filter((b) => b.status === 'added').length;

  return (
    <div className="space-y-2">
      {/* Legend */}
      {(removedCount > 0 || addedCount > 0) && (
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {removedCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-900/50" />
              {t('chat.commit.removed', { ns: 'app', count: removedCount })}
            </span>
          )}
          {addedCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-green-900/50" />
              {t('chat.commit.added', { ns: 'app', count: addedCount })}
            </span>
          )}
        </div>
      )}

      {/* Side-by-side panels */}
      <div className="flex gap-3" style={{ height: 'min(60vh, 480px)' }}>
        <RenderedHtmlPanel
          blocks={beforeBlocks}
          headerLabel={t('chat.commit.before', { ns: 'app' })}
          headerTint="red"
        />
        <RenderedHtmlPanel
          blocks={afterBlocks}
          headerLabel={t('chat.commit.after', { ns: 'app' })}
          headerTint="green"
        />
      </div>
    </div>
  );
}

// --- Side-by-side diff view (text-based, for non-page entities) ---

interface SideBySideDiffProps {
  before: string;
  after: string;
}

function SideBySideDiff({ before, after }: SideBySideDiffProps) {
  const diff = useMemo(() => computeDiff(before, after), [before, after]);

  // Split diff into left (before) and right (after) columns
  // "same" lines appear on both sides, "remove" only on left, "add" only on right
  const leftLines: { lineNum: number; text: string; type: 'same' | 'remove'; diffIdx: number }[] = [];
  const rightLines: { lineNum: number; text: string; type: 'same' | 'add'; diffIdx: number }[] = [];

  let leftLineNum = 0;
  let rightLineNum = 0;

  for (let i = 0; i < diff.length; i++) {
    const d = diff[i];
    if (d.type === 'same') {
      leftLineNum++;
      rightLineNum++;
      leftLines.push({ lineNum: leftLineNum, text: d.text, type: 'same', diffIdx: i });
      rightLines.push({ lineNum: rightLineNum, text: d.text, type: 'same', diffIdx: i });
    } else if (d.type === 'remove') {
      leftLineNum++;
      leftLines.push({ lineNum: leftLineNum, text: d.text, type: 'remove', diffIdx: i });
      // Right side shows empty placeholder for alignment
      rightLines.push({ lineNum: 0, text: '', type: 'add', diffIdx: -1 });
    } else {
      rightLineNum++;
      rightLines.push({ lineNum: rightLineNum, text: d.text, type: 'add', diffIdx: i });
      // Left side shows empty placeholder for alignment
      leftLines.push({ lineNum: 0, text: '', type: 'same', diffIdx: -1 });
    }
  }

  const renderSide = (
    lines: { lineNum: number; text: string; type: string; diffIdx: number }[],
  ) => (
    <div className="flex-1 overflow-y-auto">
      {lines.map((l, i) => {
        const bgClass =
          l.type === 'remove' ? 'bg-red-900/30' :
          l.type === 'add' ? 'bg-green-900/30' : '';
        const prefix = l.type === 'remove' ? '−' : l.type === 'add' ? '+' : ' ';
        const prefixColor =
          l.type === 'remove' ? 'text-red-400' :
          l.type === 'add' ? 'text-green-400' : 'text-gray-600';
        const isEmpty = l.text === '' && l.lineNum === 0;

        return (
          <div
            key={i}
            className={`flex whitespace-pre ${bgClass} ${isEmpty ? 'opacity-30' : ''}`}
          >
            <span className="w-10 shrink-0 text-right pr-1 text-gray-600 select-none font-mono text-xs leading-6">
              {l.lineNum || ''}
            </span>
            <span className={`w-4 shrink-0 select-none font-mono text-xs leading-6 ${prefixColor}`}>
              {prefix}
            </span>
            <span className="flex-1 font-mono text-xs leading-6 text-gray-300">
              {l.text}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex gap-px rounded border border-gray-700 overflow-hidden">
      {renderSide(leftLines)}
      <div className="w-px bg-gray-700 shrink-0" />
      {renderSide(rightLines)}
    </div>
  );
}

// --- Single-panel content view ---

interface SinglePanelProps {
  content: string;
  mode: 'before' | 'after';
}

function SinglePanel({ content, mode }: SinglePanelProps) {
  const lines = content.split('\n');

  return (
    <div className="rounded border border-gray-700 overflow-hidden">
      {lines.map((text, i) => (
        <div
          key={i}
          className={`flex whitespace-pre ${
            mode === 'after' ? 'bg-green-900/20' : 'bg-red-900/20'
          }`}
        >
          <span className="w-10 shrink-0 text-right pr-1 text-gray-600 select-none font-mono text-xs leading-6">
            {i + 1}
          </span>
          <span className={`w-4 shrink-0 select-none font-mono text-xs leading-6 ${
            mode === 'after' ? 'text-green-400' : 'text-red-400'
          }`}>
            {mode === 'after' ? '+' : '−'}
          </span>
          <span className="flex-1 font-mono text-xs leading-6 text-gray-300">
            {text}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Change view ---

function ChangeView({ change }: { change: CommitChange }) {
  const { t } = useTranslation();
  const label = `${t(`chat.commit.changeVerbs.${change.type}`, { ns: 'app' })} ${t(`chat.commit.entityTypes.${change.entityType}`, { ns: 'app' }).toLowerCase()}${change.entityName ? ` "${change.entityName}"` : ''}`;
  const hasBefore = change.before != null && change.before.length > 0;
  const hasAfter = change.after != null && change.after.length > 0;
  const isPage = change.entityType === 'page' || change.entityType === 'chapter';

  return (
    <div className="space-y-2">
      {/* Change label */}
      <div className="flex items-center gap-2">
        <ChangeIcon type={change.type} />
        <span className="text-sm font-medium text-gray-200">{label}</span>
      </div>

      {/* Diff content */}
      {hasBefore && hasAfter ? (
        isPage ? (
          <PageDiffView before={change.before!} after={change.after!} />
        ) : (
          <SideBySideDiff before={change.before!} after={change.after!} />
        )
      ) : hasAfter ? (
        <div>
          <div className="mb-1 text-[11px] font-medium text-green-400/70 uppercase tracking-wide">{t('chat.commit.after', { ns: 'app' })}</div>
          <SinglePanel content={change.after!} mode="after" />
        </div>
      ) : hasBefore ? (
        <div>
          <div className="mb-1 text-[11px] font-medium text-red-400/70 uppercase tracking-wide">{t('chat.commit.before', { ns: 'app' })}</div>
          <SinglePanel content={change.before!} mode="before" />
        </div>
      ) : (
        <div className="rounded border border-gray-700 bg-gray-900/50 px-3 py-4 text-center text-sm text-gray-500">
          {t('chat.commit.noContentPreview', { ns: 'app' })}
        </div>
      )}
    </div>
  );
}

// --- Main modal ---

interface CommitDiffModalProps {
  commit: SessionCommit | null;
  onClose: () => void;
}

export function CommitDiffModal({ commit, onClose }: CommitDiffModalProps) {
  const { t } = useTranslation();
  if (!commit) return null;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      {commit && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 mx-8 flex max-h-[85vh] w-full max-w-[85vw] flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">{commit.message}</h2>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                  <span>{formatTime(commit.timestamp)}</span>
                  <span>{t('chat.commit.changes', { ns: 'app', count: commit.changes.length })}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Diff content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {commit.changes.map((change, i) => (
                <ChangeView key={i} change={change} />
              ))}
              {commit.changes.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-500">
                  {t('chat.commit.noContent', { ns: 'app' })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
