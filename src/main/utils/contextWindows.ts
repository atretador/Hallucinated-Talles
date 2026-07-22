/**
 * Context window sizes by model pattern.
 * First match wins — order from most specific to least.
 * Used as fallback when the provider doesn't expose context_length.
 */

const CONTEXT_WINDOWS: Array<{ pattern: RegExp; tokens: number }> = [
  // OpenAI — GPT-4.1 family (1M)
  { pattern: /gpt-4\.1/i, tokens: 1_048_576 },
  // OpenAI — GPT-5 family (1M)
  { pattern: /gpt-5/i, tokens: 1_048_576 },
  // OpenAI — GPT-4o (128k)
  { pattern: /gpt-4o/i, tokens: 128_000 },
  // OpenAI — GPT-4 Turbo (128k)
  { pattern: /gpt-4-turbo/i, tokens: 128_000 },
  // OpenAI — GPT-4 base (8k)
  { pattern: /gpt-4/i, tokens: 8_192 },
  // OpenAI — GPT-3.5 (16k)
  { pattern: /gpt-3\.5/i, tokens: 16_384 },
  // OpenAI — o-series reasoning models
  { pattern: /o[134]/i, tokens: 200_000 },
  // Anthropic — Claude (200k)
  { pattern: /claude/i, tokens: 200_000 },
  // Google — Gemini 2.5 Pro (1M)
  { pattern: /gemini-2\.5-pro/i, tokens: 1_048_576 },
  // Google — Gemini 2.x (1M)
  { pattern: /gemini-2/i, tokens: 1_048_576 },
  // Google — Gemini 1.5 Pro (2M)
  { pattern: /gemini-1\.5-pro/i, tokens: 2_048_576 },
  // Google — Gemini 1.5 (1M)
  { pattern: /gemini-1\.5/i, tokens: 1_048_576 },
  // Google — Gemini 1.0 (32k)
  { pattern: /gemini/i, tokens: 32_768 },
  // DeepSeek (128k)
  { pattern: /deepseek/i, tokens: 131_072 },
  // Qwen (128k)
  { pattern: /qwen/i, tokens: 131_072 },
  // Llama 3 (128k)
  { pattern: /llama-3/i, tokens: 131_072 },
  // Llama 2 (4k)
  { pattern: /llama/i, tokens: 4_096 },
  // Mistral (32k)
  { pattern: /mistral/i, tokens: 32_768 },
];

const DEFAULT_CONTEXT_WINDOW = 128_000;

/**
 * Resolve context window for a model.
 * Priority: provider-discovered context lengths > pattern matching > default.
 *
 * @param model - Model ID string (e.g. "gemma-4-12b-it-UD-Q5_K_XL.gguf")
 * @param providerContextLengths - Optional map of model ID → context length,
 *   populated from the provider's /v1/models endpoint (e.g. llama.cpp meta.n_ctx,
 *   OpenAI/OpenRouter context_length, vLLM max_model_len).
 */
export function getContextWindow(
  model: string,
  providerContextLengths?: Record<string, number>,
): number {
  // 1. Exact match from provider-discovered context lengths
  if (providerContextLengths && model in providerContextLengths) {
    return providerContextLengths[model];
  }

  // 2. Pattern matching fallback
  for (const { pattern, tokens } of CONTEXT_WINDOWS) {
    if (pattern.test(model)) return tokens;
  }

  // 3. Default
  return DEFAULT_CONTEXT_WINDOW;
}
