import { FileService } from './fileService';
import type { McpToolMapping } from '../mcp/types';
import type { ToolExecutionResult } from './tools/toolUtils';

// Re-export for consumers that import from toolExecutor
export type { ToolExecutionResult };

import { handleReadContent, handleEditContent, handleEditRange, handleAppendToContent, handleInsertChapter, handleDeleteChapter } from './tools/pageTools';
import { handleGetCharacters, handleAddCharacter, handleEditCharacter, handleDeleteCharacter } from './tools/characterTools';
import { handleGetEvents, handleAddEvent, handleEditEvent, handleDeleteEvent } from './tools/eventTools';
import { handleGetWorldData, handleGetWorldDataEntry, handleAddWorldData, handleEditWorldData, handleDeleteWorldData } from './tools/worldDataTools';
import { handleAddRelation, handleEditRelation, handleDeleteRelation, handleGetRelations, handleGetEntityRelations } from './tools/relationTools';
import { handleGetPlan, handleGetPlanNode, handleAddPlanNode, handleUpdatePlanNode, handleDeletePlanNode, handleConnectPlanNodes, handleDisconnectPlanNodes } from './tools/planTools';
import { handleListBooks, handleCreateBook, handleGetBookStructure, handleGetProjectStructure } from './tools/bookTools';
import { handleSearchContent, handleSearchRelations } from './tools/searchTools';
import { handleGetCharacter } from './tools/pageContentTools';

/** MCP tool caller — set by server/index.ts after creating McpClientManager */
let mcpToolCaller: ((name: string, args: Record<string, unknown>) => Promise<unknown>) | null = null;
/** MCP tool lookup table — set by server/index.ts after merging tools */
let mcpToolLookup: Map<string, McpToolMapping> | null = null;

export function setMcpToolCaller(
  caller: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  lookup: Map<string, McpToolMapping>,
): void {
  mcpToolCaller = caller;
  mcpToolLookup = lookup;
}

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  fileService: FileService,
  bookId?: string,
): Promise<ToolExecutionResult> {
  // Route MCP tools to external server
  if (mcpToolLookup?.has(name) && mcpToolCaller) {
    const result = await mcpToolCaller(name, args);
    return { result };
  }

  switch (name) {
    // ── Page/Content tools ──────────────────────────────────────
    case 'readContent':      return handleReadContent(args, fileService, bookId);
    case 'editContent':      return handleEditContent(args, fileService, bookId);
    case 'editRange':        return handleEditRange(args, fileService, bookId);
    case 'appendToContent':  return handleAppendToContent(args, fileService, bookId);
    case 'insertChapter':    return handleInsertChapter(args, fileService, bookId);
    case 'deleteChapter':    return handleDeleteChapter(args, fileService, bookId);

    // ── Character tools ─────────────────────────────────────────
    case 'getCharacters':    return handleGetCharacters(args, fileService, bookId);
    case 'addCharacter':     return handleAddCharacter(args, fileService, bookId);
    case 'editCharacter':    return handleEditCharacter(args, fileService, bookId);
    case 'deleteCharacter':  return handleDeleteCharacter(args, fileService, bookId);

    // ── Event tools ─────────────────────────────────────────────
    case 'getEvents':        return handleGetEvents(args, fileService, bookId);
    case 'addEvent':         return handleAddEvent(args, fileService, bookId);
    case 'editEvent':        return handleEditEvent(args, fileService, bookId);
    case 'deleteEvent':      return handleDeleteEvent(args, fileService, bookId);

    // ── World Data tools ────────────────────────────────────────
    case 'getWorldData':     return handleGetWorldData(args, fileService, bookId);
    case 'getWorldDataEntry': return handleGetWorldDataEntry(args, fileService, bookId);
    case 'addWorldData':     return handleAddWorldData(args, fileService, bookId);
    case 'editWorldData':    return handleEditWorldData(args, fileService, bookId);
    case 'deleteWorldData':  return handleDeleteWorldData(args, fileService, bookId);

    // ── Relation tools ──────────────────────────────────────────
    case 'addRelation':      return handleAddRelation(args, fileService, bookId);
    case 'editRelation':     return handleEditRelation(args, fileService, bookId);
    case 'deleteRelation':   return handleDeleteRelation(args, fileService, bookId);
    case 'getRelations':     return handleGetRelations(args, fileService, bookId);
    case 'getEntityRelations': return handleGetEntityRelations(args, fileService, bookId);

    // ── Plan tools ──────────────────────────────────────────────
    case 'getPlan':          return handleGetPlan(args, fileService, bookId);
    case 'getPlanNode':      return handleGetPlanNode(args, fileService, bookId);
    case 'addPlanNode':      return handleAddPlanNode(args, fileService, bookId);
    case 'updatePlanNode':   return handleUpdatePlanNode(args, fileService, bookId);
    case 'deletePlanNode':   return handleDeletePlanNode(args, fileService, bookId);
    case 'connectPlanNodes': return handleConnectPlanNodes(args, fileService, bookId);
    case 'disconnectPlanNodes': return handleDisconnectPlanNodes(args, fileService, bookId);

    // ── Book tools ──────────────────────────────────────────────
    case 'listBooks':        return handleListBooks(args, fileService, bookId);
    case 'createBook':       return handleCreateBook(args, fileService, bookId);
    case 'getBookStructure': return handleGetBookStructure(args, fileService, bookId);
    case 'getProjectStructure': return handleGetProjectStructure(args, fileService, bookId);

    // ── Search tools ────────────────────────────────────────────
    case 'searchContent':    return handleSearchContent(args, fileService, bookId);
    case 'searchRelations':  return handleSearchRelations(args, fileService, bookId);

    // ── Page content tools ──────────────────────────────────────
    case 'getCharacter':     return handleGetCharacter(args, fileService, bookId);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
