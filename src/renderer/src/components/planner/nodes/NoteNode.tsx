import { useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PlanNodeData } from '../../../../../shared/types';
import { useAppStore } from '../../../stores';
import { StatusDot } from './StatusDot';

export function NoteNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const nodeData = data as unknown as PlanNodeData;
  const updateNode = useAppStore((s) => s.updateNode);
  const isCut = nodeData.status === 'cut';

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(nodeData.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = useCallback(() => {
    setEditing(true);
    setEditValue(nodeData.label);
  }, [nodeData.label]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const val = editValue.trim();
    if (val && val !== nodeData.label) {
      updateNode(id, { label: val });
    }
  }, [editValue, id, nodeData.label, updateNode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
      }
      if (e.key === 'Escape') {
        setEditValue(nodeData.label);
        setEditing(false);
      }
    },
    [nodeData.label],
  );

  return (
    <div
      className={`group/note relative rounded-lg border px-3 py-2 text-left shadow-[var(--shadow-1)] transition-all duration-150 ${
        selected
          ? 'border-yellow-500/70 shadow-[var(--shadow-2)] ring-1 ring-yellow-500/30'
          : 'border-yellow-700/30 hover:border-yellow-500/40 hover:shadow-[var(--shadow-2)]'
      } ${isCut ? 'opacity-60' : ''}`}
      style={{
        width: 160,
        minHeight: 50,
        transform: 'rotate(-0.8deg)',
      }}
    >
      {/* Sticky note paper texture — warm background */}
      <div className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-yellow-50/10 to-yellow-100/5 dark:from-yellow-400/8 dark:to-yellow-500/4" />

      {/* Folded corner accent */}
      <div className="absolute -top-px -right-px h-4 w-4 rounded-bl-md rounded-tr-lg border-b border-l border-yellow-600/20 dark:border-yellow-400/15" />

      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-gray-600 !bg-gray-700 opacity-0 transition-opacity group-hover/note:opacity-100"
      />

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
          <span>📝</span>
          <span>{t('planner.canvas.nodeTypes.note', { ns: 'app' })}</span>
        </span>
        <StatusDot status={nodeData.status} />
      </div>

      {/* Label / editable input */}
      <div className="mt-1" onDoubleClick={handleDoubleClick}>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-yellow-500/50 bg-gray-900 px-1.5 py-0.5 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-500/50"
          />
        ) : (
          <p
            className={`text-sm font-medium leading-snug text-gray-200 ${
              isCut ? 'line-through decoration-red-400/70' : ''
            }`}
          >
            {nodeData.label}
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-gray-600 !bg-gray-700 opacity-0 transition-opacity group-hover/note:opacity-100"
      />
    </div>
  );
}
