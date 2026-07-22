import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  McpServerConfig,
  McpServerState,
  McpExternalTool,
  McpToolMapping,
  McpToolCallResult,
} from './types';
import type { McpServerInfo } from '../../shared/types';

const LOG_PREFIX = '[McpClientManager]';
const HEALTH_CHECK_INTERVAL_MS = 30_000;
const DEFAULT_TOOL_CALL_TIMEOUT_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 3;

/** Base delays for exponential backoff (ms): 5s → 15s → 30s */
const RECONNECT_DELAYS = [5_000, 15_000, 30_000];

function log(...args: unknown[]): void {
  console.log(LOG_PREFIX, ...args);
}

function logWarn(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}

function logError(...args: unknown[]): void {
  console.error(LOG_PREFIX, ...args);
}

function sanitizeServerId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
}

function namespacedName(serverId: string, toolName: string): string {
  const sanitized = sanitizeServerId(serverId);
  const name = `${sanitized}_${toolName}`;
  if (name.length > 64) {
    const hash = createHash('md5').update(name).digest('hex').slice(0, 8);
    return `${sanitized.slice(0, 24)}_${toolName.slice(0, 24)}_${hash}`;
  }
  return name;
}

export class McpClientManager {
  private servers: Map<string, McpServerState> = new Map();
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private toolLookup: Map<string, McpToolMapping> = new Map();
  private connectPromises: Map<string, Promise<void>> = new Map();

  /**
   * Called on app boot. For each enabled server, start connecting in background.
   * Start health check interval (30s).
   */
  async initialize(servers: McpServerConfig[]): Promise<void> {
    log('Initializing with', servers.length, 'server configs');

    const enabledServers = servers.filter(s => s.enabled);
    log('Connecting to', enabledServers.length, 'enabled servers');

    // Fire-and-forget connections — don't block boot
    for (const config of enabledServers) {
      this.connectServer(config).catch(err => {
        logError(`Failed to connect server "${config.name}" (${config.id}):`, err);
      });
    }

    this.startHealthChecks();
    log('Health checks started (interval:', HEALTH_CHECK_INTERVAL_MS, 'ms)');
  }

  /**
   * Connect to an MCP server via stdio transport.
   * Creates the transport, connects the client, lists tools, and populates the tool lookup.
   */
  async connectServer(serverConfig: McpServerConfig): Promise<void> {
    const { id } = serverConfig;

    // If already connecting, wait for existing connection attempt
    const existingPromise = this.connectPromises.get(id);
    if (existingPromise) {
      return existingPromise;
    }

    const connectPromise = this._connectServerInner(serverConfig);
    this.connectPromises.set(id, connectPromise);

    try {
      await connectPromise;
    } finally {
      this.connectPromises.delete(id);
    }
  }

  private async _connectServerInner(serverConfig: McpServerConfig): Promise<void> {
    const { id, name, command, args, env } = serverConfig;

    // Initialize or update state
    const existingState = this.servers.get(id);
    const state: McpServerState = {
      config: serverConfig,
      status: 'connecting',
      tools: [],
      reconnectAttempts: existingState?.reconnectAttempts ?? 0,
    };
    this.servers.set(id, state);

    log(`Connecting to server "${name}" (${id}) — command: ${command} ${args?.join(' ') ?? ''}`);

    try {
      // Create stdio transport
      const transport = new StdioClientTransport({
        command,
        args: args ?? [],
        env: { ...process.env, ...env } as Record<string, string>,
      });

      // Create client
      const client = new Client(
        { name: 'hallucinated-talles', version: '1.0.0' },
        { capabilities: {} },
      );

      // Handle transport close (server process exited)
      transport.onclose = () => {
        logWarn(`Transport closed for server "${name}" (${id})`);
        this.handleServerDisconnect(id, 'Server process exited');
      };

      // Handle transport errors (EPIPE, etc.)
      transport.onerror = (err) => {
        logError(`Transport error for server "${name}" (${id}):`, err);
        this.handleServerDisconnect(id, `Transport error: ${err}`);
      };

      // Connect
      await client.connect(transport);

      log(`Connected to server "${name}" (${id})`);

      // List tools
      const { tools } = await client.listTools();

      // Convert to McpExternalTool and populate lookup
      const mcpTools: McpExternalTool[] = tools.map(tool => {
        const nsName = namespacedName(id, tool.name);
        this.toolLookup.set(nsName, { serverId: id, originalName: tool.name });
        return {
          serverId: id,
          originalName: tool.name,
          namespacedName: nsName,
          description: tool.description,
          inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {},
        };
      });

      // Update state
      state.status = 'connected';
      state.tools = mcpTools;
      state.error = undefined;
      state.reconnectAttempts = 0;
      state.lastHealthCheck = new Date().toISOString();

      // Store references
      this.clients.set(id, client);
      this.transports.set(id, transport);

      log(`Server "${name}" (${id}) — discovered ${mcpTools.length} tools:`,
        mcpTools.map(t => t.namespacedName));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      state.status = 'error';
      state.error = errMsg;
      state.tools = [];

      logError(`Failed to connect to server "${name}" (${id}):`, errMsg);
      throw err;
    }
  }

  /**
   * Handle a server disconnecting unexpectedly (process exit, pipe error, etc.).
   */
  private handleServerDisconnect(serverId: string, reason: string): void {
    const state = this.servers.get(serverId);
    if (!state) return;

    logWarn(`Server "${state.config.name}" (${serverId}) disconnected: ${reason}`);

    // Remove tools from lookup
    for (const tool of state.tools) {
      this.toolLookup.delete(tool.namespacedName);
    }

    state.status = 'disconnected';
    state.error = reason;
    state.tools = [];

    // Clean up references
    this.clients.delete(serverId);
    this.transports.delete(serverId);

    // Attempt reconnect if the server was previously enabled
    if (state.config.enabled && state.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.scheduleReconnect(state.config);
    }
  }

  /**
   * Disconnect a specific server, close its client and transport.
   */
  async disconnectServer(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (state) {
      state.status = 'disconnected';
      // Snapshot tools before clearing so we can clean up the lookup
      const existingTools = [...state.tools];
      state.tools = [];
      for (const tool of existingTools) {
        this.toolLookup.delete(tool.namespacedName);
      }
    }

    const transport = this.transports.get(serverId);
    if (transport) {
      try {
        await transport.close();
      } catch (err) {
        logWarn(`Error closing transport for server ${serverId}:`, err);
      }
      this.transports.delete(serverId);
    }

    const client = this.clients.get(serverId);
    if (client) {
      try {
        await client.close();
      } catch (err) {
        logWarn(`Error closing client for server ${serverId}:`, err);
      }
      this.clients.delete(serverId);
    }

    log(`Disconnected server ${serverId}`);
  }

  /**
   * Ensure a server is connected. If it's already connected, return immediately.
   * If disconnected or in error, attempt to connect. If connecting, wait for it.
   */
  async ensureConnected(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    if (state.status === 'connected') {
      return;
    }

    if (state.status === 'connecting') {
      // Wait for the in-progress connection
      const promise = this.connectPromises.get(serverId);
      if (promise) {
        await promise;
        return;
      }
    }

    // Try to connect (or reconnect)
    await this.connectServer(state.config);
  }

  /**
   * Return all tools from connected servers, optionally filtered by active server IDs.
   * @param activeIds - If provided, only return tools from servers whose IDs are in this set.
   */
  getAllTools(activeIds?: Set<string>): McpExternalTool[] {
    const tools: McpExternalTool[] = [];
    for (const [serverId, state] of this.servers) {
      if (state.status === 'connected' && (!activeIds || activeIds.has(serverId))) {
        tools.push(...state.tools);
      }
    }
    return tools;
  }

  /**
   * Return the tool lookup map.
   */
  getToolLookup(): Map<string, McpToolMapping> {
    return this.toolLookup;
  }

  /**
   * Check if a tool name belongs to an MCP server.
   */
  isMcpTool(namespacedName: string): boolean {
    return this.toolLookup.has(namespacedName);
  }

  /**
   * Call a tool on the appropriate MCP server.
   * Uses timeout from server config (default 30s).
   */
  async callTool(
    namespacedName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    const mapping = this.toolLookup.get(namespacedName);
    if (!mapping) {
      throw new Error(`Unknown MCP tool: ${namespacedName}`);
    }

    const state = this.servers.get(mapping.serverId);
    if (!state) {
      throw new Error(`MCP server not found: ${mapping.serverId}`);
    }

    await this.ensureConnected(mapping.serverId);

    const client = this.clients.get(mapping.serverId);
    if (!client) {
      throw new Error(`MCP client not connected: ${mapping.serverId}`);
    }

    const timeoutMs = state.config.timeoutMs ?? DEFAULT_TOOL_CALL_TIMEOUT_MS;

    log(`Calling tool "${mapping.originalName}" on server "${state.config.name}" (${mapping.serverId})`);

    try {
      const result = await Promise.race([
        client.callTool({ name: mapping.originalName, arguments: args }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('MCP tool call timeout')), timeoutMs),
        ),
      ]);

      return result as McpToolCallResult;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logError(`Tool call failed for "${namespacedName}":`, errMsg);

      // If the error suggests the server is dead, trigger reconnect
      if (
        errMsg.includes('EPIPE') ||
        errMsg.includes('ERR_IPC_CHANNEL_CLOSED') ||
        errMsg.includes('transport closed')
      ) {
        this.handleServerDisconnect(mapping.serverId, errMsg);
      }

      throw err;
    }
  }

  /**
   * Add a new MCP server and connect to it.
   */
  async addServer(config: McpServerConfig): Promise<void> {
    log(`Adding server "${config.name}" (${config.id})`);
    this.servers.set(config.id, {
      config,
      status: 'disconnected',
      tools: [],
      reconnectAttempts: 0,
    });

    if (config.enabled) {
      await this.connectServer(config);
    }
  }

  /**
   * Disconnect and remove an MCP server.
   */
  async removeServer(serverId: string): Promise<void> {
    log(`Removing server ${serverId}`);

    // Cancel any pending reconnect
    const state = this.servers.get(serverId);
    if (state) {
      state.config.enabled = false;
    }

    await this.disconnectServer(serverId);
    this.servers.delete(serverId);
  }

  /**
   * Update server config. Reconnect if command/args/env changed.
   */
  async updateServer(config: McpServerConfig): Promise<void> {
    const existing = this.servers.get(config.id);

    if (!existing) {
      // Brand new server
      await this.addServer(config);
      return;
    }

    const configChanged =
      existing.config.command !== config.command ||
      JSON.stringify(existing.config.args) !== JSON.stringify(config.args) ||
      JSON.stringify(existing.config.env) !== JSON.stringify(config.env);

    const wasEnabled = existing.config.enabled;
    existing.config = config;

    // If config changed and server was connected, reconnect
    if (configChanged && (wasEnabled || config.enabled)) {
      log(`Config changed for server "${config.name}" (${config.id}), reconnecting`);
      await this.disconnectServer(config.id);
      if (config.enabled) {
        await this.connectServer(config);
      }
    } else if (config.enabled && !wasEnabled) {
      // Newly enabled
      await this.connectServer(config);
    } else if (!config.enabled && wasEnabled) {
      // Newly disabled
      await this.disconnectServer(config.id);
    }
  }

  /**
   * Return server states for API responses.
   */
  getServers(): McpServerInfo[] {
    const result: McpServerInfo[] = [];
    for (const state of this.servers.values()) {
      result.push({
        config: state.config,
        status: state.status,
        error: state.error,
        toolCount: state.tools.length,
        toolNames: state.tools.map(t => t.namespacedName),
      });
    }
    return result;
  }

  /**
   * Start health check interval. Every 30s, check each connected server.
   * If unhealthy, attempt reconnect with exponential backoff.
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.runHealthChecks();
    }, HEALTH_CHECK_INTERVAL_MS);

    // Don't let the timer keep the process alive
    if (this.healthCheckTimer && typeof this.healthCheckTimer === 'object' && 'unref' in this.healthCheckTimer) {
      this.healthCheckTimer.unref();
    }
  }

  private async runHealthChecks(): Promise<void> {
    for (const [serverId, state] of this.servers.entries()) {
      if (state.status !== 'connected') continue;

      const client = this.clients.get(serverId);
      if (!client) {
        logWarn(`Health check: no client for server ${serverId}, marking disconnected`);
        this.handleServerDisconnect(serverId, 'Client missing during health check');
        continue;
      }

      try {
        // A simple ping — listTools is lightweight and proves the server is alive
        await client.listTools();
        state.lastHealthCheck = new Date().toISOString();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logWarn(`Health check failed for server "${state.config.name}" (${serverId}):`, errMsg);
        this.handleServerDisconnect(serverId, `Health check failed: ${errMsg}`);
      }
    }
  }

  /**
   * Schedule a reconnect attempt with exponential backoff.
   */
  private scheduleReconnect(config: McpServerConfig): void {
    const state = this.servers.get(config.id);
    if (!state) return;

    const attempt = state.reconnectAttempts;
    const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];

    state.reconnectAttempts++;

    log(
      `Scheduling reconnect for "${config.name}" (${config.id}) in ${delay}ms ` +
      `(attempt ${state.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    const timer = setTimeout(async () => {
      try {
        await this.connectServer(config);
        log(`Reconnected to "${config.name}" (${config.id}) after ${state.reconnectAttempts} attempt(s)`);
      } catch {
        console.debug('[clientManager] _connectServerInner already logged the error');
        // _connectServerInner already logged the error
      }
    }, delay);

    // Don't keep the process alive for reconnect timers
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref();
    }
  }

  /**
   * Disconnect all servers and clear the health check timer.
   */
  async shutdown(): Promise<void> {
    log('Shutting down');

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    const disconnectPromises: Promise<void>[] = [];
    for (const serverId of this.servers.keys()) {
      disconnectPromises.push(this.disconnectServer(serverId));
    }

    await Promise.allSettled(disconnectPromises);

    this.servers.clear();
    this.clients.clear();
    this.transports.clear();
    this.toolLookup.clear();
    this.connectPromises.clear();

    log('Shutdown complete');
  }
}
