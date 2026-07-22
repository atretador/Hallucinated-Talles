/** Standardized reasoning/thinking delta fields across LLM providers */
export interface ReasoningDelta {
  reasoning_content?: string;
  reasoning?: string;
  thinking?: string;
  reasoningDelta?: string;
}

/** Extract the reasoning text from a provider-specific streaming delta.
 *  Tries multiple field names used by different providers. */
export function extractReasoningDelta(delta: unknown): string | undefined {
  const d = delta as ReasoningDelta;
  return d?.reasoning_content ?? d?.reasoning ?? d?.thinking ?? d?.reasoningDelta;
}
