import type { McpServerConfig } from '../../shared/types';
export type { McpServerConfig };

/** Runtime state of a connected MCP server */
export interface McpServerState {
  config: McpServerConfig;
  status: 'connecting' | 'connected' | 'error' | 'disconnected';
  error?: string;
  tools: McpExternalTool[];
  lastHealthCheck?: string;
  reconnectAttempts: number;
}

/** An external tool as received from an MCP server */
export interface McpExternalTool {
  serverId: string;
  originalName: string;
  namespacedName: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** Lookup entry for routing namespaced tool calls back to the source server */
export interface McpToolMapping {
  serverId: string;
  originalName: string;
}

/** Result of an MCP tool call */
export interface McpToolCallResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}
