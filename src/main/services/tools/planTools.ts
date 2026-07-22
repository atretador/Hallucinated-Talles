import crypto from 'crypto';
import { FileService } from '../fileService';
import type { PlanNodeType, PlanNodeStatus, PlanEdgeType } from '../../../shared/types';
import type { ToolExecutionResult } from './toolUtils';
import { createScopedFileService, resolvePlanNodePosition } from './toolUtils';

export async function handleGetPlan(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const plan = await createScopedFileService(fileService, bookId, args).getPlan();
  if (!plan || plan.nodes.length === 0) return { result: { exists: false } };

  // Build adjacency map from edges
  const children = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  for (const edge of plan.edges) {
    if (!children.has(edge.source)) children.set(edge.source, []);
    children.get(edge.source)!.push(edge.target);
    parentMap.set(edge.target, edge.source);
  }

  // Find roots (nodes with no parent)
  const roots = plan.nodes.filter(n => !parentMap.has(n.id)).map(n => n.id);

  // Build ordered outline by following edges from roots
  const lines: string[] = [];
  const visited = new Set<string>();

  function render(nodeId: string, indent: number) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = plan!.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const prefix = '  '.repeat(indent);
    const typeTag = node.type === 'chapter' ? (node.data.level === 'act' ? 'ACT' : 'CH') : node.type.toUpperCase();
    const desc = node.data.description ? ` — ${node.data.description.slice(0, 120)}${node.data.description.length > 120 ? '…' : ''}` : '';
    lines.push(`${prefix}- [${typeTag}] ${node.data.label} (${node.data.status})${desc}`);
    const kids = children.get(nodeId) || [];
    for (const kid of kids) render(kid, indent + 1);
  }

  for (const root of roots) render(root, 0);

  // Render any orphan nodes not connected
  for (const node of plan.nodes) {
    if (!visited.has(node.id)) {
      const typeTag = node.type === 'chapter' ? (node.data.level === 'act' ? 'ACT' : 'CH') : node.type.toUpperCase();
      const desc = node.data.description ? ` — ${node.data.description.slice(0, 120)}${node.data.description.length > 120 ? '…' : ''}` : '';
      lines.push(`- [${typeTag}] ${node.data.label} (${node.data.status})${desc}`);
    }
  }

  return {
    result: {
      nodeCount: plan.nodes.length,
      edgeCount: plan.edges.length,
      outline: lines.join('\n'),
      // Keep raw data for programmatic access when needed
      nodes: plan.nodes.map(n => ({ id: n.id, type: n.type, label: n.data.label, status: n.data.status, ...(n.data.level ? { level: n.data.level } : {}) })),
    },
  };
}

export async function handleGetPlanNode(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const plan = await createScopedFileService(fileService, bookId, args).getPlan();
  if (!plan) return { result: { error: 'No plan exists' } };
  const node = plan.nodes.find(n => n.id === args.nodeId);
  return { result: node ?? { error: 'Node not found' } };
}

export async function handleAddPlanNode(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  let plan = await fs.getPlan();
  if (!plan) {
    plan = { version: 1, nodes: [], edges: [] };
  }
  const nodeType = ((args.type as string) || 'note') as PlanNodeType;
  const newNode = {
    id: crypto.randomUUID(),
    type: nodeType,
    data: {
      label: (args.label as string) || 'Untitled',
      description: (args.description as string) || '',
      status: (args.status as string as PlanNodeStatus) || 'draft',
      ...(args.level ? { level: args.level as 'act' | 'chapter' } : {}),
      ...(args.subplotId ? { subplotId: args.subplotId as string } : {}),
    },
    position: resolvePlanNodePosition(plan, nodeType, args),
  };
  plan.nodes.push(newNode);
  await fs.savePlan(plan);
  return {
    result: newNode,
    commitChange: {
      type: 'create',
      entityType: 'plan',
      entityId: newNode.id,
      entityName: newNode.data.label,
    },
  };
}

export async function handleUpdatePlanNode(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const plan = await fs.getPlan();
  if (!plan) return { result: { error: 'No plan exists' } };
  const node = plan.nodes.find(n => n.id === args.nodeId);
  if (!node) return { result: { error: 'Node not found' } };
  const oldData = { ...node.data };
  if (args.label !== undefined) node.data.label = args.label as string;
  if (args.description !== undefined) node.data.description = args.description as string;
  if (args.status !== undefined) node.data.status = args.status as string as PlanNodeStatus;
  if (args.level !== undefined) node.data.level = args.level as 'act' | 'chapter';
  if (args.subplotId !== undefined) node.data.subplotId = args.subplotId as string;
  if (args.notes !== undefined) node.data.notes = args.notes as string;
  if (args.characters !== undefined) node.data.characters = args.characters as string[];
  await fs.savePlan(plan);
  return {
    result: node,
    commitChange: {
      type: 'edit',
      entityType: 'plan',
      entityId: node.id,
      entityName: node.data.label,
      before: JSON.stringify(oldData, null, 2).slice(0, 500),
      after: JSON.stringify(node.data, null, 2).slice(0, 500),
    },
  };
}

export async function handleDeletePlanNode(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const plan = await fs.getPlan();
  if (!plan) return { result: { error: 'No plan exists' } };
  const nodeIdx = plan.nodes.findIndex(n => n.id === args.nodeId);
  if (nodeIdx === -1) return { result: { error: 'Node not found' } };
  const deletedNodeData = plan.nodes[nodeIdx].data;
  plan.nodes.splice(nodeIdx, 1);
  const beforeEdgeCount = plan.edges.length;
  plan.edges = plan.edges.filter(e => e.source !== args.nodeId && e.target !== args.nodeId);
  const edgesRemoved = beforeEdgeCount - plan.edges.length;
  await fs.savePlan(plan);
  return {
    result: { success: true, deleted: args.nodeId, edgesRemoved },
    commitChange: {
      type: 'delete',
      entityType: 'plan',
      entityId: args.nodeId as string,
      entityName: (args.nodeId as string),
      before: JSON.stringify(deletedNodeData, null, 2).slice(0, 500),
    },
  };
}

export async function handleConnectPlanNodes(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  let plan = await fs.getPlan();
  if (!plan) return { result: { error: 'No plan exists' } };
  const sourceExists = plan.nodes.some(n => n.id === args.sourceId);
  const targetExists = plan.nodes.some(n => n.id === args.targetId);
  if (!sourceExists) return { result: { error: `Source node '${args.sourceId}' not found` } };
  if (!targetExists) return { result: { error: `Target node '${args.targetId}' not found` } };
  const newEdge = {
    id: crypto.randomUUID(),
    source: args.sourceId as string,
    target: args.targetId as string,
    type: ((args.type as string) || 'follows') as PlanEdgeType,
    ...(args.label ? { data: { label: args.label as string } } : {}),
  };
  plan.edges.push(newEdge);
  await fs.savePlan(plan);
  return {
    result: newEdge,
    commitChange: {
      type: 'create',
      entityType: 'plan',
      entityId: newEdge.id,
      entityName: `${args.sourceId}→${args.targetId}`,
    },
  };
}

export async function handleDisconnectPlanNodes(
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  const fs = createScopedFileService(fileService, bookId, args);
  const plan = await fs.getPlan();
  if (!plan) return { result: { error: 'No plan exists' } };
  const edgeIdx = plan.edges.findIndex(e => e.id === args.edgeId);
  if (edgeIdx === -1) return { result: { error: 'Edge not found' } };
  plan.edges.splice(edgeIdx, 1);
  await fs.savePlan(plan);
  return {
    result: { success: true, deleted: args.edgeId },
    commitChange: {
      type: 'delete',
      entityType: 'plan',
      entityId: args.edgeId as string,
    },
  };
}
