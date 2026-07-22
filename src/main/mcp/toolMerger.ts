/**
 * toolMerger.ts
 *
 * Merges internal ChatCompletionTool[] with external McpExternalTool[] into a
 * single list suitable for OpenAI function-calling.  External tools are
 * namespaced to avoid name collisions and their JSON Schemas are simplified
 * (resolving $ref, stripping unsupported keywords).
 *
 * Pure module — no side effects, no state.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { McpExternalTool, McpToolMapping } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge internal (built-in) tools with external MCP tools.
 *
 * @returns A merged `tools` array for the ChatCompletion request and a `lookup`
 *          map that can route a namespaced tool name back to its originating
 *          MCP server.
 */
export function mergeTools(
  internalTools: ChatCompletionTool[],
  externalTools: McpExternalTool[],
): {
  tools: ChatCompletionTool[];
  lookup: Map<string, McpToolMapping>;
} {
  const lookup = new Map<string, McpToolMapping>();

  const convertedExternal = externalTools.map((tool) => {
    lookup.set(tool.namespacedName, {
      serverId: tool.serverId,
      originalName: tool.originalName,
    });
    return convertMcpToolToOpenAI(tool);
  });

  // Internal tools pass through unchanged; external tools are appended.
  const tools: ChatCompletionTool[] = [...internalTools, ...convertedExternal];

  return { tools, lookup };
}

/**
 * Convenience helper — check whether a tool name belongs to an MCP server.
 */
export function isMcpTool(
  lookup: Map<string, McpToolMapping>,
  name: string,
): boolean {
  return lookup.has(name);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a single MCP tool definition into an OpenAI ChatCompletionTool.
 */
function convertMcpToolToOpenAI(tool: McpExternalTool): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.namespacedName,
      description: tool.description ?? '',
      parameters: simplifySchema(tool.inputSchema ?? {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Schema simplification
// ---------------------------------------------------------------------------

/**
 * Deep-clone a value (fast JSON round-trip for plain data).
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Simplify a JSON Schema returned by an MCP server so that it is safe to send
 * to OpenAI's function-calling API.
 *
 * What this does:
 * 1. Resolves every `$ref` pointer by inlining the referenced definition.
 * 2. Removes `$defs` / `definitions` sections after resolution.
 * 3. Strips any `$ref` nodes that could not be resolved (replaced with `{}`).
 * 4. Handles `allOf`, `oneOf`, `anyOf` by keeping only the first branch when
 *    the branches don't carry contradictory constraints (best-effort).
 */
function simplifySchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const cloned = deepClone(schema);

  // Collect definitions (both common locations).
  const defs = extractDefs(cloned);

  // ── Phase 1: resolve $ref ──────────────────────────────────────────────
  const resolved = resolveAllRefs(cloned, defs) as Record<string, unknown>;

  // ── Phase 2: flatten composition keywords ──────────────────────────────
  const flattened = flattenComposition(resolved) as Record<string, unknown>;

  // ── Phase 3: strip any remaining $ref that could not be resolved ───────
  stripRefs(flattened);

  return flattened;
}

/**
 * Extract `$defs` or `definitions` from the schema root and return them as a
 * plain record.  The original keys are removed from the schema.
 */
function extractDefs(
  schema: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const defs =
    (schema.$defs as Record<string, Record<string, unknown>>) ??
    (schema.definitions as Record<string, Record<string, unknown>>) ??
    {};

  // Remove the definitions sections so they don't leak into the output.
  delete schema.$defs;
  delete schema.definitions;

  return defs;
}

/**
 * Recursively resolve every `$ref` in the schema tree.
 * Uses a visited set to prevent infinite loops on circular refs.
 */
function resolveAllRefs(
  obj: unknown,
  defs: Record<string, Record<string, unknown>>,
  visited = new Set<string>(),
): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveAllRefs(item, defs, visited));
  }

  const record = obj as Record<string, unknown>;

  // Resolve a top-level or nested $ref.
  if (typeof record.$ref === 'string') {
    // Guard against circular refs
    if (visited.has(record.$ref)) {
      return {}; // Break cycle with permissive empty schema
    }
    visited.add(record.$ref);
    const refTarget = resolveRefTarget(record.$ref, defs);
    if (refTarget !== null) {
      // Clone to avoid shared references and recurse into the resolved target.
      return resolveAllRefs(deepClone(refTarget), defs, visited);
    }
    // Unresolvable — return a permissive empty schema.
    return {};
  }

  // Recurse into every property.
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    // Skip definition sections (already extracted).
    if (key === '$defs' || key === 'definitions') {
      continue;
    }
    result[key] = resolveAllRefs(value, defs, visited);
  }
  return result;
}

/**
 * Given a `$ref` string like `#/definitions/Foo` or `#/$defs/Bar`, look up
 * the target in `defs`.  Returns `null` if unresolvable.
 */
function resolveRefTarget(
  refPath: string,
  defs: Record<string, Record<string, unknown>>,
): Record<string, unknown> | null {
  // Expected format: #/<definitions|$$defs>/<Name>
  const parts = refPath.split('/');
  const name = parts[parts.length - 1];
  if (name && Object.prototype.hasOwnProperty.call(defs, name)) {
    return defs[name];
  }
  return null;
}

/**
 * Best-effort flattening of `allOf` / `oneOf` / `anyOf`.
 *
 * Strategy:
 * - `allOf`: Merge all sub-schemas into one (overlapping keys prefer later).
 * - `oneOf` / `anyOf`: Keep only the first branch (avoids complex union
 *   schemas that OpenAI likely won't handle well).
 */
function flattenComposition(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(flattenComposition);
  }

  const record = obj as Record<string, unknown>;

  // Merge children first so nested compositions are handled bottom-up.
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'allOf' || key === 'oneOf' || key === 'anyOf') {
      continue; // handled below
    }
    merged[key] = flattenComposition(value);
  }

  // ── allOf: merge every branch ────────────────────────────────────────
  if (Array.isArray(record.allOf)) {
    for (const branch of record.allOf) {
      const flat = flattenComposition(branch) as Record<string, unknown>;
      if (flat && typeof flat === 'object' && !Array.isArray(flat)) {
        Object.assign(merged, flat);
      }
    }
  }

  // ── oneOf / anyOf: keep first branch only ────────────────────────────
  const unionBranch = record.oneOf ?? record.anyOf;
  if (Array.isArray(unionBranch) && unionBranch.length > 0) {
    const first = flattenComposition(unionBranch[0]) as Record<string, unknown>;
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      Object.assign(merged, first);
    }
  }

  return merged;
}

/**
 * Walk the schema tree and replace any remaining `$ref` nodes (that weren't
 * resolved during Phase 1) with a permissive `{}` schema.
 */
function stripRefs(obj: unknown): void {
  if (obj === null || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      stripRefs(item);
    }
    return;
  }

  const record = obj as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    const value = record[key];

    if (key === '$ref') {
      // Replace the whole parent object if it was just `{ "$ref": "..." }`.
      // We can't do that cleanly here, so we delete the $ref key and let the
      // parent carry on without it (effectively becoming `{}` if that was the
      // only key).
      delete record.$ref;
      continue;
    }

    if (value !== null && typeof value === 'object') {
      stripRefs(value);
    }
  }

  // If the record is now empty, that's fine — `{}` is a valid permissive schema.
}
