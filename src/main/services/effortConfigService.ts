import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { EffortConfig } from '../../shared/types';
import { getModelEffortEntry, getEffortsForModel } from '../../shared/effortUtils';

// ── Default Config ─────────────────────────────────────────────────

const DEFAULT_CONFIG: EffortConfig = {
  version: 2,
  modelFamilies: [
    // OpenAI o-series — reasoning_effort directly
    { pattern: 'o4-mini', efforts: ['low', 'medium', 'high'], default: 'medium', mechanism: 'reasoning_effort' },
    { pattern: 'o3-mini', efforts: ['low', 'medium', 'high'], default: 'medium', mechanism: 'reasoning_effort' },
    { pattern: 'o3', efforts: ['low', 'medium', 'high'], default: 'medium', mechanism: 'reasoning_effort' },
    { pattern: 'o1', efforts: ['low', 'medium', 'high'], default: 'medium', mechanism: 'reasoning_effort' },

    // GPT-5 family
    { pattern: 'gpt-5-pro', efforts: ['high'], default: 'high', mechanism: 'reasoning_effort' },
    { pattern: 'gpt-5.5', efforts: ['none', 'low', 'medium', 'high', 'xhigh'], default: 'medium', mechanism: 'reasoning_effort' },
    { pattern: 'gpt-5.4', efforts: ['none', 'low', 'medium', 'high', 'xhigh'], default: 'medium', mechanism: 'reasoning_effort' },
    { pattern: 'gpt-5.2', efforts: ['none', 'low', 'medium', 'high'], default: 'none', mechanism: 'reasoning_effort' },
    { pattern: 'gpt-5.1', efforts: ['none', 'low', 'medium', 'high'], default: 'none', mechanism: 'reasoning_effort' },
    { pattern: 'gpt-5', efforts: ['minimal', 'low', 'medium', 'high'], default: 'medium', mechanism: 'reasoning_effort' },

    // Gemini — reasoning_effort (mapped by compat layer)
    { pattern: 'gemini-3.1-flash-lite', efforts: ['minimal', 'high'], default: 'minimal', mechanism: 'reasoning_effort' },
    { pattern: 'gemini-3', efforts: ['low', 'medium', 'high'], default: 'high', mechanism: 'reasoning_effort' },
    { pattern: 'gemini-2.5', efforts: ['low', 'medium', 'high'], default: 'medium', mechanism: 'reasoning_effort' },

    // Gemma — binary enable_thinking (no budget, just on/off)
    { pattern: 'gemma-4', efforts: ['none', 'high'], default: 'none', mechanism: 'enable_thinking' },

    // DeepSeek V4 — thinking_type + reasoning_effort
    { pattern: 'deepseek-v4', efforts: ['high', 'max'], default: 'high', mechanism: 'thinking_type', alsoReasoningEffort: true },
    // DeepSeek R1 — always on, no control
    { pattern: 'deepseek-r1', efforts: [], default: '', mechanism: 'always_on' },

    // Qwen — enable_thinking with token budget profiles (user-tweakable)
    {
      pattern: 'qwen3.6',
      efforts: ['none', 'low', 'medium', 'high', 'max'],
      default: 'high',
      mechanism: 'enable_thinking',
      thinkingBudgets: { none: null, low: 2048, medium: 4096, high: 8192, max: 16384 },
    },
    {
      pattern: 'qwen3.5',
      efforts: ['none', 'low', 'medium', 'high', 'max'],
      default: 'high',
      mechanism: 'enable_thinking',
      thinkingBudgets: { none: null, low: 2048, medium: 4096, high: 8192, max: 16384 },
    },
    {
      pattern: 'qwen3',
      efforts: ['none', 'low', 'medium', 'high', 'max'],
      default: 'medium',
      mechanism: 'enable_thinking',
      thinkingBudgets: { none: null, low: 2048, medium: 4096, high: 8192, max: 16384 },
    },
    // QwQ — always on
    { pattern: 'qwq', efforts: [], default: '', mechanism: 'always_on' },

    // Kimi — thinking_type (NO reasoning_effort, Kimi rejects the combo)
    { pattern: 'kimi-k2.7', efforts: [], default: '', mechanism: 'always_on' },
    { pattern: 'kimi-k2.6', efforts: ['none', 'high'], default: 'high', mechanism: 'thinking_type' },
    { pattern: 'kimi-k2.5', efforts: ['none', 'high'], default: 'high', mechanism: 'thinking_type' },

    // GLM-5.2 — reasoning_effort directly
    { pattern: 'glm-5.2', efforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'], default: 'max', mechanism: 'reasoning_effort' },

    // MiMo — reasoning_effort (low/med/high are identical but harmless)
    { pattern: 'mimo', efforts: ['none', 'low', 'medium', 'high'], default: 'high', mechanism: 'reasoning_effort' },

    // Mistral — reasoning_effort
    { pattern: 'magistral', efforts: [], default: '', mechanism: 'always_on' },
    { pattern: 'mistral', efforts: ['none', 'high'], default: 'none', mechanism: 'reasoning_effort' },

    // GPT-OSS — reasoning_effort
    { pattern: 'gpt-oss', efforts: ['low', 'medium', 'high'], default: 'medium', mechanism: 'reasoning_effort' },
  ],
  fallback: { efforts: ['low', 'medium', 'high'], default: 'medium' },
};

// ── Storage ────────────────────────────────────────────────────────

function getStoragePath(): string {
  return path.join(app.getPath('userData'), 'effort-levels.json');
}

async function readConfigFile(): Promise<EffortConfig | null> {
  try {
    const raw = await fs.readFile(getStoragePath(), 'utf-8');
    return JSON.parse(raw) as EffortConfig;
  } catch {
    return null;
  }
}

async function writeConfigFile(config: EffortConfig): Promise<void> {
  await fs.mkdir(path.dirname(getStoragePath()), { recursive: true });
  await fs.writeFile(getStoragePath(), JSON.stringify(config, null, 2), 'utf-8');
}

// ── Public API ─────────────────────────────────────────────────────

export async function getEffortConfig(): Promise<EffortConfig> {
  const existing = await readConfigFile();
  if (existing && existing.version >= 2) return existing;

  // Migrate: overwrite with new defaults (preserves user's ability to re-customize)
  await writeConfigFile(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

export async function setEffortConfig(config: EffortConfig): Promise<void> {
  await writeConfigFile(config);
}

// ── OpenRouter Auto-Discovery ──────────────────────────────────────

interface OpenRouterModel {
  id: string;
  reasoning?: {
    supported_efforts?: string[];
    default_effort?: string;
    default_enabled?: boolean;
    mandatory?: boolean;
  };
}

interface CachedModels {
  models: OpenRouterModel[];
  fetchedAt: number;
}

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const openrouterCache = new Map<string, CachedModels>();

function isOpenRouterUrl(baseUrl: string): boolean {
  const normalized = baseUrl.replace(/\/+$/, '').toLowerCase();
  return (
    normalized === 'https://openrouter.ai/api/v1' ||
    normalized === 'https://openrouter.ai/api' ||
    normalized === 'openrouter.ai' ||
    normalized === 'https://openrouter.ai'
  );
}

/**
 * Fetch model metadata from OpenRouter. Cached for 1 hour per API key.
 */
async function fetchOpenRouterModels(apiKey?: string): Promise<OpenRouterModel[]> {
  const cacheKey = apiKey || 'no-key';
  const cached = openrouterCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < OPENROUTER_CACHE_TTL) {
    return cached.models;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000); // 15s timeout

    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return cached?.models || [];

    const data = await res.json() as { data?: OpenRouterModel[] };
    const models = data.data || [];

    openrouterCache.set(cacheKey, { models, fetchedAt: Date.now() });
    return models;
  } catch {
    return cached?.models || [];
  }
}

/**
 * Find an OpenRouter model by matching its ID against the given model name.
 * OpenRouter model IDs look like "openai/gpt-5", "google/gemini-3-pro", etc.
 * The user's model name might be "gpt-5", "openai/gpt-5", or "google/gemini-3-pro".
 */
function findOpenRouterModel(models: OpenRouterModel[], modelName: string): OpenRouterModel | null {
  const lower = modelName.toLowerCase();

  // Exact match first
  const exact = models.find(m => m.id.toLowerCase() === lower);
  if (exact) return exact;

  // Try matching by suffix (e.g., "gpt-5" matches "openai/gpt-5")
  const suffix = models.find(m => {
    const parts = m.id.toLowerCase().split('/');
    return parts.length > 1 && parts[parts.length - 1] === lower;
  });
  if (suffix) return suffix;

  // Try matching by prefix (e.g., "openai/gpt-5" matches if user typed "openai/gpt-5.1")
  const prefix = models.find(m => lower.startsWith(m.id.toLowerCase()) || m.id.toLowerCase().startsWith(lower));
  return prefix || null;
}

export interface ResolvedEffortOptions {
  efforts: string[];
  default: string;
  source: 'config' | 'openrouter' | 'fallback';
}

/**
 * Resolve effort options for a specific model, optionally using OpenRouter metadata.
 * If the provider is OpenRouter, fetches live model data and uses it to override/augment
 * the config-based effort options.
 */
export async function resolveEffortOptions(
  modelName: string,
  providerBaseUrl?: string,
  providerApiKey?: string,
): Promise<ResolvedEffortOptions> {
  const config = await getEffortConfig();

  // If OpenRouter, try to get live metadata
  if (providerBaseUrl && isOpenRouterUrl(providerBaseUrl)) {
    const orModels = await fetchOpenRouterModels(providerApiKey);
    const orModel = findOpenRouterModel(orModels, modelName);

    if (orModel?.reasoning?.supported_efforts && orModel.reasoning.supported_efforts.length > 0) {
      return {
        efforts: orModel.reasoning.supported_efforts,
        default: orModel.reasoning.default_effort || orModel.reasoning.supported_efforts[0],
        source: 'openrouter',
      };
    }

    // OpenRouter model found but no reasoning metadata — check if it's always-on
    if (orModel?.reasoning?.mandatory) {
      return { efforts: [], default: '', source: 'openrouter' };
    }
  }

  // Fall back to config-based resolution
  const resolved = getEffortsForModel(config, modelName);
  const entry = getModelEffortEntry(config, modelName);

  if (resolved.efforts.length > 0) {
    return { efforts: resolved.efforts, default: resolved.default, source: 'config' };
  }

  if (entry && entry.efforts.length === 0) {
    return { efforts: [], default: '', source: 'config' };
  }

  // Ultimate fallback
  return {
    efforts: config.fallback.efforts,
    default: config.fallback.default,
    source: 'fallback',
  };
}

export { getEffortsForModel, isOpenRouterUrl };
