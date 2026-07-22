import { FileService } from '../fileService';
import type { PlanModel, PlanNodeType, CommitChange } from '../../../shared/types';

export interface ToolExecutionResult {
  result: unknown;
  summary?: string;
  commitChange?: CommitChange;
}

export function normalizeEntityName(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, ' ')
    : '';
}

export const PLAN_NODE_LANES: Record<PlanNodeType, { x: number; y: number; gapY: number }> = {
  chapter: { x: 100, y: 100, gapY: 180 },
  scene: { x: 380, y: 100, gapY: 140 },
  beat: { x: 640, y: 100, gapY: 120 },
  note: { x: 900, y: 100, gapY: 120 },
};

export function resolvePlanNodePosition(
  plan: PlanModel,
  nodeType: PlanNodeType,
  args: Record<string, unknown>,
): { x: number; y: number } {
  const lane = PLAN_NODE_LANES[nodeType] ?? PLAN_NODE_LANES.note;
  const hasExplicitX = typeof args.x === 'number' && Number.isFinite(args.x);
  const hasExplicitY = typeof args.y === 'number' && Number.isFinite(args.y);
  const sameTypeCount = plan.nodes.filter(node => node.type === nodeType).length;

  const position = hasExplicitX && hasExplicitY
    ? { x: args.x as number, y: args.y as number }
    : { x: lane.x, y: lane.y + sameTypeCount * lane.gapY };

  const overlapsExisting = (candidate: { x: number; y: number }) =>
    plan.nodes.some(node => Math.abs(node.position.x - candidate.x) < 220 && Math.abs(node.position.y - candidate.y) < 110);

  let guard = 0;
  while (overlapsExisting(position) && guard < 100) {
    position.y += lane.gapY;
    if (guard > 0 && guard % 12 === 0) {
      position.x += 260;
      position.y = lane.y;
    }
    guard += 1;
  }

  return position;
}

export function createScopedFileService(
  fileService: FileService,
  bookId: string | undefined,
  args: Record<string, unknown>,
): FileService {
  const targetBookId = typeof args.bookId === 'string' && args.bookId.trim()
    ? args.bookId.trim()
    : bookId && bookId !== fileService.projectName
      ? bookId
      : undefined;
  return targetBookId
    ? new FileService(fileService.projectName, targetBookId)
    : fileService;
}
