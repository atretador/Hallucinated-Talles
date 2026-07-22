// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import http from 'node:http';

// Mock modules that depend on Electron before importing createServer
vi.mock('../services/settings', () => ({
  settingsStore: { get: vi.fn(), set: vi.fn() },
  getEffectiveProjectsDir: vi.fn(() => '/tmp/test-projects'),
  isProjectsDirConfigured: vi.fn(() => true),
  getActiveSkillIds: vi.fn(() => []),
  setActiveSkillIds: vi.fn(),
  getMcpServers: vi.fn(() => []),
  getActiveMcpServerIds: vi.fn(() => []),
  setMcpServers: vi.fn(),
  setActiveMcpServerIds: vi.fn(),
  getActiveSubAgentIds: vi.fn(() => []),
  setActiveSubAgentIds: vi.fn(),
}));

vi.mock('../services/fileService', () => ({
  FileService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../services/toolExecutor', () => ({
  executeToolCall: vi.fn(),
  setMcpToolCaller: vi.fn(),
}));

vi.mock('../services/skillsService', () => ({
  listSkills: vi.fn(async () => []),
  getSkill: vi.fn(async () => null),
  saveSkill: vi.fn(async () => ({})),
  deleteSkill: vi.fn(async () => true),
  getSkillRaw: vi.fn(async () => null),
}));

vi.mock('../services/tokenUsageService', () => ({
  TokenUsageService: vi.fn().mockImplementation(() => ({
    addRecord: vi.fn(async () => {}),
    getUsage: vi.fn(() => ({ totalTokens: 0, inputTokens: 0, outputTokens: 0 })),
  })),
}));

// Import AFTER mocks are set up
const { createServer } = await import('../server/index');

/** Helper: read SSE events from a response */
function readSSE(
  res: http.IncomingMessage,
  timeout = 10_000,
): Promise<Array<{ event: string; data: string }>> {
  return new Promise((resolve, reject) => {
    const events: Array<{ event: string; data: string }> = [];
    let buffer = '';
    let currentEvent = '';

    const timer = setTimeout(() => {
      res.destroy();
      resolve(events); // return what we have so far
    }, timeout);

    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          events.push({ event: currentEvent, data: line.slice(6) });
          currentEvent = '';
        }
      }
    });

    res.on('end', () => {
      clearTimeout(timer);
      resolve(events);
    });

    res.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Helper: make a POST request and return response + SSE events */
function postChat(
  port: number,
  body: Record<string, unknown>,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; events: Array<{ event: string; data: string }> }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: '/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        readSSE(res).then((events) => {
          resolve({ status: res.statusCode!, headers: res.headers, events });
        });
      },
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

/** Create a mock AiService that streams fake chunks */
function createMockAiService(options?: { failProbe?: boolean; streamDelay?: number }) {
  const { failProbe = false, streamDelay = 0 } = options ?? {};

  return {
    isConfigured: vi.fn(() => true),
    getConfig: vi.fn(() => ({
      baseUrl: 'http://localhost:9999/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })),
    getSettings: vi.fn(() => ({
      activeProviderId: 'test-provider',
      providers: [],
      firstChunkTimeoutSec: 300,
    })),
    checkConnection: vi.fn(async () => {
      if (failProbe) return { ok: false, error: 'Connection refused' };
      return { ok: true };
    }),
    chatStream: vi.fn(async function* () {
      if (streamDelay > 0) {
        await new Promise((r) => setTimeout(r, streamDelay));
      }
      // Yield a few token chunks
      yield {
        choices: [{ delta: { content: 'Hello ' }, index: 0, finish_reason: null }],
      } as any;
      yield {
        choices: [{ delta: { content: 'world!' }, index: 0, finish_reason: null }],
      } as any;
      yield {
        choices: [{ delta: {}, index: 0, finish_reason: 'stop' }],
      } as any;
    }),
  };
}

describe('Chat SSE Endpoint', () => {
  let server: http.Server;
  let port: number;

  async function startServer(mockAi: ReturnType<typeof createMockAiService>) {
    const app = createServer(mockAi as any);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    port = (server.address() as any).port;
    return port;
  }

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  it('should return 400 if AI service is not configured', async () => {
    const mockAi = createMockAiService();
    mockAi.isConfigured.mockReturnValue(false);
    await startServer(mockAi);

    const res = await new Promise<http.IncomingMessage>((resolve) => {
      const req = http.request(
        { hostname: 'localhost', port, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        resolve,
      );
      req.write(JSON.stringify({ message: 'hello', history: [] }));
      req.end();
    });

    expect(res.statusCode).toBe(400);
  });

  it('should return SSE error if connection probe fails', async () => {
    const mockAi = createMockAiService({ failProbe: true });
    await startServer(mockAi);

    const { status, headers, events } = await postChat(port, { message: 'hello', history: [] });

    expect(status).toBe(200);
    expect(headers['content-type']).toContain('text/event-stream');

    // Should get a status:connecting event, then an error
    const statusEvent = events.find((e) => e.event === 'status');
    expect(statusEvent).toBeDefined();
    expect(JSON.parse(statusEvent!.data).status).toBe('connecting');

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(JSON.parse(errorEvent!.data).error).toContain('Connection refused');
  });

  it('should stream tokens via SSE', async () => {
    const mockAi = createMockAiService();
    await startServer(mockAi);

    const { status, events } = await postChat(port, { message: 'hello', history: [] });

    expect(status).toBe(200);

    // Collect event types
    const eventTypes = events.map((e) => e.event);

    // Should have: status(connecting), status(connected), token, token, done
    expect(eventTypes).toContain('status');
    expect(eventTypes).toContain('token');
    expect(eventTypes).toContain('done');

    // Verify token content
    const tokens = events.filter((e) => e.event === 'token');
    expect(tokens.length).toBe(2);
    expect(JSON.parse(tokens[0].data).content).toBe('Hello ');
    expect(JSON.parse(tokens[1].data).content).toBe('world!');

    // Verify done event
    const doneEvent = events.find((e) => e.event === 'done');
    expect(doneEvent).toBeDefined();
    const doneData = JSON.parse(doneEvent!.data);
    expect(doneData.message.content).toBe('Hello world!');
  });

  it('should pass effort parameter through', async () => {
    const mockAi = createMockAiService();
    await startServer(mockAi);

    await postChat(port, { message: 'hello', history: [], effort: 'high' });

    // chatStream should have been called with effort='high'
    expect(mockAi.chatStream).toHaveBeenCalled();
    const callArgs = (mockAi.chatStream as any).mock.calls[0];
    expect(callArgs[3]).toBe('high'); // 4th arg is effort
  });

  it('should handle streaming with delay (first-chunk timeout test)', async () => {
    // Use a short delay that's well under the first-chunk timeout (default 300s)
    const mockAi = createMockAiService({ streamDelay: 100 });
    await startServer(mockAi);

    const { status, events } = await postChat(port, { message: 'hello', history: [] });

    expect(status).toBe(200);
    expect(events.some((e) => e.event === 'token')).toBe(true);
    expect(events.some((e) => e.event === 'done')).toBe(true);
  });

  it('should NOT abort signal when request body is received (regression test)', async () => {
    // This was the root cause of the chat failure: req.on('close') fires when the
    // request body is fully received, prematurely aborting the signal.
    // The fix: use res.on('close') instead, which fires when the SOCKET closes.
    const signalStates: boolean[] = [];
    const mockAi = createMockAiService();
    const originalChatStream = mockAi.chatStream.getMockImplementation() as any;

    // Wrap chatStream to record signal state
    (mockAi.chatStream as any).mockImplementation(async function* (
      messages: any,
      tools: any,
      signal?: AbortSignal,
    ) {
      signalStates.push(signal?.aborted ?? false);
      yield* originalChatStream(messages, tools, signal);
    });

    await startServer(mockAi);
    const { events } = await postChat(port, { message: 'hello', history: [] });

    // Signal should NOT be aborted when chatStream is called
    expect(signalStates).toHaveLength(1);
    expect(signalStates[0]).toBe(false);

    // Should still get tokens and done
    expect(events.some((e) => e.event === 'token')).toBe(true);
    expect(events.some((e) => e.event === 'done')).toBe(true);
  });

  it('should abort when client disconnects', async () => {
    const mockAi = createMockAiService();
    await startServer(mockAi);

    // Make a request but abort it immediately
    const aborted = await new Promise<boolean>((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/api/chat',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          // Abort after receiving headers
          res.on('data', () => {
            req.destroy();
          });
          // Give server time to process
          setTimeout(() => resolve(true), 500);
        },
      );
      req.write(JSON.stringify({ message: 'hello', history: [] }));
      req.end();
    });

    expect(aborted).toBe(true);
  });
});
