import OpenAI from 'openai';
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type { AiProvider, AiProviderConfig, AiSettings, AiEffort } from '../../shared/types';
import { getModelEffortEntry } from '../../shared/effortUtils';
import { getEffortConfig } from './effortConfigService';
import { settingsStore } from './settings';

/**
 * Translates an effort level into the correct API parameters for the given model.
 */
async function buildEffortParams(modelName: string, effort?: AiEffort): Promise<Record<string, any>> {
  if (!effort) return {};

  const config = await getEffortConfig();
  const entry = getModelEffortEntry(config, modelName);
  const mechanism = entry?.mechanism || 'reasoning_effort';

  switch (mechanism) {
    case 'reasoning_effort':
      return { reasoning_effort: effort };

    case 'enable_thinking': {
      if (effort === 'none') {
        return { extra_body: { enable_thinking: false } };
      }
      const budget = entry?.thinkingBudgets?.[effort];
      return {
        extra_body: {
          enable_thinking: true,
          ...(budget != null ? { thinking_token_budget: budget } : {}),
        },
      };
    }

    case 'thinking_type': {
      const thinkingParam = effort === 'none'
        ? { extra_body: { thinking: { type: 'disabled' } } }
        : { extra_body: { thinking: { type: 'enabled' } } };

      if (entry?.alsoReasoningEffort && effort !== 'none') {
        return { ...thinkingParam, reasoning_effort: effort };
      }
      return thinkingParam;
    }

    case 'always_on':
      return {};

    default:
      return { reasoning_effort: effort };
  }
}

export class AiService {
  private client: OpenAI | null = null;
  private config: AiProviderConfig | null = null;

  constructor() {
    // Restore persisted settings on startup (saveSettings auto-corrects stale activeModel)
    const settings = this.getSettings();
    this.saveSettings(settings);
  }

  private configureFromProvider(provider: AiProvider, model: string): void {
    this.config = {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model,
    };
    // OpenAI SDK requires an apiKey — use a placeholder for local providers like Ollama
    this.client = new OpenAI({
      apiKey: provider.apiKey || 'not-set',
      baseURL: provider.baseUrl,
      timeout: 60_000, // 60s for initial connection — streaming can continue after
    });
  }

  /** Persisted settings accessors */
  getSettings(): AiSettings {
    const stored = settingsStore.get('ai');
    return stored ?? {
      providers: [
        {
          id: 'ollama',
          name: 'Ollama (Local)',
          baseUrl: 'http://localhost:11434/v1',
          apiKey: 'ollama',
          models: ['llama3', 'llama3.1', 'mistral', 'codellama', 'gemma'],
        },
      ],
      activeProviderId: 'ollama',
      activeModel: 'llama3',
      activeSkillIds: [],
      firstChunkTimeoutSec: 300,
    };
  }

  saveSettings(settings: AiSettings): void {
    // Auto-correct activeModel if it no longer belongs to the active provider
    const provider = settings.providers.find(p => p.id === settings.activeProviderId);
    if (provider) {
      if (!settings.activeModel || !provider.models.includes(settings.activeModel)) {
        settings.activeModel = provider.models[0] || '';
      }
    }

    settingsStore.set('ai', settings);

    // Reconfigure if the active provider+model changed
    if (provider && settings.activeModel) {
      this.configureFromProvider(provider, settings.activeModel);
    } else {
      this.client = null;
      this.config = null;
    }
  }

  setActiveProvider(providerId: string, model: string): void {
    const settings = this.getSettings();
    const provider = settings.providers.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" not found`);
    }
    if (!provider.models.includes(model)) {
      throw new Error(`Model "${model}" not available for provider "${provider.name}"`);
    }
    settings.activeProviderId = providerId;
    settings.activeModel = model;
    this.saveSettings(settings);
  }

  configure(config: AiProviderConfig): void {
    this.config = config;
    // OpenAI SDK requires an apiKey — use a placeholder for local providers like Ollama
    this.client = new OpenAI({
      apiKey: config.apiKey || 'not-set',
      baseURL: config.baseUrl,
      timeout: 60_000, // 60s for initial connection — streaming can continue after
    });
  }

  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  getConfig(): AiProviderConfig | null {
    return this.config;
  }

  /**
   * Quick probe: hit the model server's /models endpoint to verify it's reachable.
   * Returns { ok, error } — never throws.
   */
  async checkConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.config) return { ok: false, error: 'No provider configured' };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000); // 10s probe timeout
      const url = `${this.config.baseUrl.replace(/\/+$/, '')}/models`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey || 'not-set'}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { ok: false, error: `Model server returned ${res.status}: ${body.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (err) {
      const error = err as Error;
      return {
        ok: false,
        error: `Cannot reach model server at ${this.config.baseUrl}: ${error.message}`,
      };
    }
  }

  async *chatStream(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    signal?: AbortSignal,
    effort?: AiEffort,
  ): AsyncGenerator<ChatCompletionChunk> {
    if (!this.client || !this.config) {
      throw new Error('AI service is not configured');
    }

    const effortParams = await buildEffortParams(this.config.model, effort);
    const baseParams = {
      model: this.config.model,
      messages,
      stream: true as const,
      stream_options: { include_usage: true },
      ...effortParams,
    };

    try {
      // Try with tools first
      const stream = await this.client.chat.completions.create(
        { ...baseParams, tools },
        { signal },
      );
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (err) {
      const error = err as Error;
      const isToolError =
        error.message?.includes('tool') ||
        error.message?.includes('function') ||
        (error as any).status === 400 ||
        (error as any).code === 'invalid_request_error';

      if (isToolError && !signal?.aborted) {
        console.warn('[AiService] Tools not supported, retrying via raw HTTP without tools');
        yield* this.chatStreamRaw(baseParams, [], signal);
      } else {
        console.warn('[AiService] SDK streaming failed, trying raw HTTP fallback:', error.message);
        yield* this.chatStreamRaw(baseParams, tools, signal);
      }
    }
  }

  /**
   * Raw HTTP fallback — bypasses the OpenAI SDK entirely.
   * Used when the SDK fails in Electron's bundled environment.
   */
  private async *chatStreamRaw(
    baseParams: Record<string, unknown>,
    tools: ChatCompletionTool[],
    signal?: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    if (!this.config) throw new Error('AI service is not configured');

    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const body = JSON.stringify({ ...baseParams, tools });

    console.log('[AiService] Raw HTTP fallback →', url);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey || 'not-set'}`,
      },
      body,
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Model server returned ${res.status}: ${text.slice(0, 500)}`);
    }

    if (!res.body) {
      throw new Error('No response body from model server');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') return;
            try {
              yield JSON.parse(data) as ChatCompletionChunk;
            } catch {
              console.debug('[aiService] Skip malformed JSON');
              // skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
