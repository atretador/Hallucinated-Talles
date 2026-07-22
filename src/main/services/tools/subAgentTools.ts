/**
 * Sub-agent tool handlers.
 *
 * These tools (delegateToSubAgent, listSubAgents, getSubAgentResult, awaitSubAgentResult)
 * are dispatched directly from server/index.ts rather than through the toolExecutor switch,
 * because they require access to session context, MCP tools, and other runtime state.
 *
 * See server/index.ts lines ~2915-2983 for the current implementation.
 */
export {};
