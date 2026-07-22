import dagre from 'dagre';
import type { PlanModel } from '../../../../shared/types';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const NODE_SIZES: Record<string, { w: number; h: number }> = {
  chapter: { w: 200, h: 80 },
  scene: { w: 180, h: 60 },
  beat: { w: 160, h: 50 },
  note: { w: 160, h: 50 },
};

export function computeAutoLayout(plan: PlanModel): PlanModel {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  for (const node of plan.nodes) {
    const size = NODE_SIZES[node.type] ?? { w: NODE_WIDTH, h: NODE_HEIGHT };
    g.setNode(node.id, { width: size.w, height: size.h });
  }

  for (const edge of plan.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const updatedNodes = plan.nodes.map((node) => {
    const pos = g.node(node.id);
    const size = NODE_SIZES[node.type] ?? { w: NODE_WIDTH, h: NODE_HEIGHT };
    // dagre returns centre coordinates; ReactFlow expects top-left
    return {
      ...node,
      position: pos
        ? { x: pos.x - size.w / 2, y: pos.y - size.h / 2 }
        : node.position,
    };
  });

  return { ...plan, nodes: updatedNodes };
}
