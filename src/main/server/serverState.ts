import type { PendingEdit } from '../../shared/types';
import { TokenUsageService } from '../services/tokenUsageService';
import { McpClientManager } from '../mcp/clientManager';

/**
 * Shared mutable state for in-flight chat requests and pending edits.
 */
export const activeChatControllers = new Map<string, AbortController>();

/** Pending edits awaiting user accept/reject */
export const pendingEdits = new Map<string, PendingEdit>();
export let pendingEditCounter = 0;

export function nextPendingEditId(): string {
  pendingEditCounter++;
  return `edit-${Date.now()}-${pendingEditCounter}`;
}

// Singleton token-usage service (global storage, not per-project)
export const tokenUsageService = new TokenUsageService();

// Singleton MCP client manager
export const mcpClientManager = new McpClientManager();
