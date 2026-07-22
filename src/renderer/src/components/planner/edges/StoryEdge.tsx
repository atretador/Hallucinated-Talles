import { getBezierPath, type EdgeProps } from '@xyflow/react';

const EDGE_STYLES: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string; label?: string }> = {
  follows: { stroke: 'var(--connector)', strokeWidth: 2 },
  causes: { stroke: '#f97316', strokeWidth: 2.5 },  // orange
  conflicts: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '6 4' },  // red dashed
  resolves: { stroke: '#22c55e', strokeWidth: 2.5 },  // green
};

export function StoryEdge(props: EdgeProps) {
  const edgeType = (props.type ?? 'follows') as string;
  const style = EDGE_STYLES[edgeType] ?? EDGE_STYLES.follows;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.strokeDasharray}
        className="react-flow__edge-path"
      />
      {/* Optional: show edge type label */}
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs fill-[var(--theme-text-mute)]"
      >
        {edgeType}
      </text>
    </>
  );
}
