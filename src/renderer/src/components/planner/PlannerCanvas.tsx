import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { PlanNode, PlanNodeType } from '../../../../shared/types';
import { useAppStore } from '../../stores';
import { ChapterNode } from './nodes/ChapterNode';
import { SceneNode } from './nodes/SceneNode';
import { BeatNode } from './nodes/BeatNode';
import { NoteNode } from './nodes/NoteNode';
import { StoryEdge } from './edges/StoryEdge';

const DEFAULT_LABEL_KEYS: Record<string, string> = {
  chapter: 'planner.canvas.defaultLabels.chapter',
  scene: 'planner.canvas.defaultLabels.scene',
  beat: 'planner.canvas.defaultLabels.beat',
  note: 'planner.canvas.defaultLabels.note',
};

export function PlannerCanvas() {
  const { t } = useTranslation();
  const {
    planModel,
    canvasSelection,
    layoutVersion,
    updateNodePosition,
    deleteNode,
    addEdge: addPlanEdge,
    deleteEdge,
    setCanvasViewport,
    setCanvasSelection,
    addNode,
  } = useAppStore();

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /* ── Convert PlanModel to ReactFlow format ── */

  const nodeTypes = useMemo(() => ({
    chapter: ChapterNode,
    scene: SceneNode,
    beat: BeatNode,
    note: NoteNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    follows: StoryEdge,
    causes: StoryEdge,
    conflicts: StoryEdge,
    resolves: StoryEdge,
  }), []);

  const rfNodes: Node[] = useMemo(
    () =>
      (planModel?.nodes ?? []).map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as unknown as Record<string, unknown>,
        selected: canvasSelection.includes(n.id),
      })),
    [planModel?.nodes, canvasSelection],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      (planModel?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        data: e.data as Record<string, unknown>,
      })),
    [planModel?.edges],
  );

  /* ── Change handlers ── */

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateNodePosition(change.id, change.position);
        }
        if (change.type === 'remove') {
          deleteNode(change.id);
        }
      }
    },
    [updateNodePosition, deleteNode],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          deleteEdge(change.id);
        }
      }
    },
    [deleteEdge],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      // source/target are guaranteed to be non-null by ReactFlow for completed connections
      if (!connection.source || !connection.target) return;
      const newEdge = {
        id: crypto.randomUUID(),
        source: connection.source,
        target: connection.target,
        type: 'follows' as const,
      };
      addPlanEdge(newEdge);
    },
    [addPlanEdge],
  );

  /* ── Viewport ── */

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setCanvasViewport(viewport);
    },
    [setCanvasViewport],
  );

  /* ── Selection ── */

  const onSelectionChange = useCallback(
    ({ nodes }: { nodes: Node[] }) => {
      setCanvasSelection(nodes.map((n) => n.id));
    },
    [setCanvasSelection],
  );

  /* ── Drag-and-drop from palette ── */

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType || !rfInstanceRef.current) return;

      const position = rfInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: PlanNode = {
        id: crypto.randomUUID(),
        type: nodeType as PlanNodeType,
        data: {
          label: t(DEFAULT_LABEL_KEYS[nodeType] ?? 'planner.canvas.defaultLabels.chapter', { ns: 'app' }),
          status: 'draft',
        },
        position,
      };

      addNode(newNode);
    },
    [addNode],
  );

  /* ── Instance ref ── */

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
  }, []);

  /* ── Auto-fit view after auto-layout ── */

  useEffect(() => {
    rfInstanceRef.current?.fitView({ padding: 0.2, duration: 200 });
  }, [layoutVersion]);

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={onInit}
        onMoveEnd={onMoveEnd}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        className="bg-[var(--theme-bg)]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="var(--connector)"
          gap={20}
          size={1}
        />
        <Controls
          className="!border-[var(--theme-border)] !bg-[var(--theme-surface)] [&_button]:!border-[var(--theme-border)] [&_button]:!text-gray-400 [&_button]:!bg-[var(--theme-surface-2)] [&_button:hover]:!bg-[var(--theme-border)]"
        />
        <MiniMap
          position="bottom-right"
          nodeColor="var(--theme-text-mute)"
          maskColor="color-mix(in srgb, var(--theme-bg) 75%, transparent)"
          style={{
            backgroundColor: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
            borderRadius: '8px',
          }}
          nodeBorderRadius={4}
        />
      </ReactFlow>
    </div>
  );
}
