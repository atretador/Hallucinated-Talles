import type { EffortConfig, ModelEffortEntry } from './types';

/**
 * Returns the full ModelEffortEntry for a model name, or null if using fallback.
 */
export function getModelEffortEntry(
  config: EffortConfig,
  modelName: string,
): ModelEffortEntry | null {
  const lowerName = modelName.toLowerCase();
  for (const entry of config.modelFamilies) {
    if (entry.pattern && lowerName.startsWith(entry.pattern.toLowerCase())) {
      return entry;
    }
  }
  return null;
}

/**
 * Resolves the supported effort values and default for a given model name.
 * Uses case-insensitive prefix matching against the modelFamilies patterns.
 * Returns the first matching entry, or falls back to config.fallback.
 */
export function getEffortsForModel(
  config: EffortConfig,
  modelName: string,
): { efforts: string[]; default: string } {
  const lowerName = modelName.toLowerCase();

  for (const entry of config.modelFamilies) {
    if (entry.pattern && lowerName.startsWith(entry.pattern.toLowerCase())) {
      return { efforts: entry.efforts, default: entry.default };
    }
  }

  return config.fallback;
}
