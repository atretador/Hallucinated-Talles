/** Shared types between main and renderer processes */

// Content addressing
export type ContentAddress =
  | { kind: 'chapter'; bookId: string; chapterId: string }
  | { kind: 'page'; bookId: string; pageId: string }
  | { kind: 'full_book'; bookId: string }
  | { kind: 'front-cover'; bookId: string }
  | { kind: 'back-cover'; bookId: string }
  | { kind: 'character'; bookId: string; characterId: string }
  | { kind: 'event'; bookId: string; eventId: string }
  | { kind: 'worldData'; bookId: string; worldDataId: string };

// Editor page data — computed by ReferenceEditor, consumed by ChapterTree
export interface ChapterPageInfo {
  chapterId: string;
  title: string;
  startPage: number; // 0-indexed
  endPage: number;   // exclusive
}

export interface EditorPageData {
  pageCount: number;
  pageHeightPx: number;
  chapters: ChapterPageInfo[];
}

// Book item types (chapters are markers, pages are content units)
export type BookItem = ChapterItem | PageItem;

export interface ChapterItem {
  type: 'chapter';
  id: string;
  title: string;
}

export interface PageItem {
  type: 'page';
  id: string;
  title?: string;
}

// Page content (loaded from markdown file)
export interface PageContent {
  id: string;
  title?: string;
  content: string;
}

// Book content (all pages with their content)
export interface BookContent {
  bookId: string;
  bookTitle: string;
  pages: PageContent[];
}

// Agent actions
export type AgentAction =
  | { type: 'read'; target: ContentAddress }
  | { type: 'edit'; target: ContentAddress; replacement: string }
  | { type: 'appendToContent'; target: ContentAddress; content: string }
  | { type: 'getCharacters'; filter?: string }
  | { type: 'getCharacter'; characterId: string }
  | { type: 'addCharacter'; name: string; description: string }
  | { type: 'editCharacter'; characterId: string; updates: Partial<Character> }
  | { type: 'deleteCharacter'; characterId: string }
  | { type: 'getEvents'; filter?: string }
  | { type: 'getEvent'; eventId: string }
  | { type: 'addEvent'; title: string; description: string; eventType: EventType }
  | { type: 'editEvent'; eventId: string; updates: Partial<StoryEvent> }
  | { type: 'deleteEvent'; eventId: string }
  | { type: 'searchContent'; query: string }
  | { type: 'getBookStructure' }
  | { type: 'getWorldData' }
  | { type: 'getWorldDataEntry'; worldDataId: string }
  | { type: 'addWorldData'; name: string; shortDescription: string; content: string }
  | { type: 'editWorldData'; worldDataId: string; name?: string; shortDescription?: string; content?: string }
  | { type: 'deleteWorldData'; worldDataId: string };

export interface BookCover {
  frontCover?: string;   // filename (e.g. "front-cover.png")
  backCover?: string;
}

export interface Book {
  id: string;
  title: string;
  items: BookItem[];          // ordered: chapters and pages (pages to be removed in Phase 2)
  content?: string;            // NEW: full document HTML for single-document editing
  metadata: BookMetadata;
  settings?: BookSettings;
  systemPrompt?: string;
  covers?: BookCover;
}

export interface BookMetadata {
  author: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Entity model
export type RelationType = 'ally' | 'enemy' | 'family' | 'mentor' | 'romantic' | 'other';
export type EventType = 'major' | 'minor' | 'background';

export interface CharacterAttribute {
  id: string;
  key: string;        // group name: "Personality", "Skills", "Inventory", etc.
  values: string[];   // list of values in this group
}

export interface Character {
  id: string;
  bookId: string;
  name: string;
  aliases: string[];
  description: string;
  attributes: CharacterAttribute[];
  entries: CharacterEntry[];
  relations: CharacterRelation[];
  storyPoints: StoryPoint[];
  createdAt: string;
  updatedAt: string;
  introduction?: {
    page: number;
    context: string;  // brief description of first appearance
  };
}

export interface CharacterEntry {
  id: string;
  bookId?: string;
  timestamp: string;  // In-story time
  eventId?: string;
  chapterId?: string;
  description: string;
  impact: string;
}

export interface CharacterRelation {
  id: string;
  targetCharacterId: string;
  type: RelationType;
  description: string;
}

export interface StoryPoint {
  id: string;
  bookId?: string;
  title: string;
  description: string;
  chapterId?: string;
  characters: string[];  // character IDs
  significance: number;  // 1-10
}

export interface TextLocation {
  chapterId?: string;
  pageId: string;
  startLine: number;
  endLine: number;
}

export interface StoryEvent {
  id: string;
  bookId: string;
  title: string;
  description: string;
  timestamp: string;  // In-story time
  characters: string[];  // character IDs
  chapterId?: string;
  type: EventType;
  consequences: string[];
  sortOrder: number;
  locations: TextLocation[];
}

export interface WorldData {
  id: string;
  bookId: string;
  name: string;
  shortDescription: string;
  content: string;
  category?: string;                    // e.g. "place", "organization", "faction", "artifact", "lore", "species"
  attributes?: Array<{ key: string; value: string }>;
  aliases?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Predefined world data category suggestions (free-form string, these are just suggestions)
export const WORLD_DATA_CATEGORIES = [
  'place', 'organization', 'faction', 'culture', 'artifact',
  'system', 'lore', 'species', 'resource', 'technology',
  'magic', 'cultivation', 'other',
] as const;

// Generic entity reference for relations
export type EntityRef =
  | { type: 'character'; id: string }
  | { type: 'event'; id: string }
  | { type: 'worldData'; id: string }
  | { type: 'page'; id: string }
  | { type: 'chapter'; id: string };

// First-class cross-entity relation
export interface StoryRelation {
  id: string;
  bookId: string;
  from: EntityRef;
  to: EntityRef;
  type: string;           // e.g. "ally", "enemy", "affected_by", "located_in", "member_of", "owns", "heard_of"
  label?: string;         // short human label, e.g. "quiet admiration", "rivalry"
  description: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BookSettings {
  pageSize: { width: number; height: number };  // in mm (A4 = 210x297)
  margins: { top: number; bottom: number; left: number; right: number };  // in mm
  fontFamily: string;  // e.g., "Times New Roman"
  fontSize: number;  // in pt (e.g., 12)
  lineSpacing: number;  // multiplier (1.0, 1.15, 1.5, 2.0)
}

export interface ImportedFont {
  family: string;          // font family name
  filename: string;        // original filename
  filePath: string;        // original file path (for re-import if needed)
  storedPath: string;      // path in userData where font was copied
  weight: string;          // detected weight ('400', '700', etc.)
  style: string;           // 'normal' or 'italic'
  importedAt: string;      // ISO date string
}

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ImportFormat = 'pdf' | 'docx' | 'odt' | 'txt';

export interface ImportState {
  id: string;
  bookId: string;
  filename: string;  // display name only (basename)
  sourcePath?: string;  // absolute path for re-import
  chapterHints?: string;  // optional user prompt/instructions for the AI agent during import
  format: ImportFormat;
  totalPages: number;
  currentPage: number;
  startPage?: number;  // defaults to 1
  endPage?: number;    // defaults to totalPages
  status: ImportStatus;
  providerId: string;
  model: string;
  effort: AiEffort;
  startedAt: string;
  updatedAt: string;
  error?: string;
  failedPages?: number[];
}

// API types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  images?: string[]; // Array of base64 data URLs or relative file paths for vision models
  timestamp: string;
  parts?: ChatMessagePart[];
  /** Present only for tool-role messages — maps to the tool call this result belongs to */
  toolCallId?: string;
  /** Present only for tool-role messages — human-readable tool name */
  toolCallName?: string;
}

export type ChatMessagePart =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall };

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

// Agent Task Queue (long-running autonomous work)
export interface AgentTask {
  id: string;
  displayName: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  completedAt?: string;
}

// Pending edits (accept/reject flow)
export interface PendingEdit {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  preview: string;
  before?: string;
}

// Agent Session types
export interface AgentSession {
  id: string;
  title: string;
  bookId?: string;  // Which book this session is associated with (project-level sessions)
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
  summary?: string;
  messageCount: number;
  commitCount: number;
  taskCount?: number;
  subAgentRunCount?: number;
}

export interface SessionData {
  session: AgentSession;
  messages: ChatMessage[];
  commits: SessionCommit[];
  tasks?: AgentTask[];
  subAgentRuns?: SubAgentRun[];
}

export interface SessionCommit {
  id: string;
  sessionId: string;
  timestamp: string;
  message: string;
  changes: CommitChange[];
}

export interface CommitChange {
  type: 'create' | 'edit' | 'update' | 'delete' | 'undo';
  entityType: 'book' | 'page' | 'character' | 'event' | 'chapter' | 'plan' | 'worldData' | 'relation';
  entityId: string;
  entityName?: string;
  before?: string;
  after?: string;
}

// AI Provider config
export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  /** Discovered context lengths per model ID (tokens). Populated by discover-models. */
  contextLengths?: Record<string, number>;
}

/**
 * AI model reasoning effort level.
 * Kept as `string` rather than a fixed union because each model family
 * defines its own supported effort values in a user-customizable config
 * (see EffortConfig.modelFamilies[].efforts) and OpenRouter can report
 * arbitrary values at runtime.
 */
export type AiEffort = string;

export interface ModelEffortEntry {
  /** Model name prefix to match (case-insensitive) */
  pattern: string;
  /** Supported effort values for this model family */
  efforts: string[];
  /** Default effort value */
  default: string;
  /** How to translate effort → API parameters. Defaults to 'reasoning_effort' if omitted. */
  mechanism?: 'reasoning_effort' | 'enable_thinking' | 'thinking_type' | 'always_on';
  /** For 'enable_thinking' mechanism: maps effort level → token budget. null = thinking OFF, number = thinking ON with budget cap. */
  thinkingBudgets?: Record<string, number | null>;
  /** For 'thinking_type' mechanism: also send reasoning_effort alongside thinking.type (needed for DeepSeek V4, rejected by Kimi). */
  alsoReasoningEffort?: boolean;
}

export interface EffortConfig {
  version: number;
  modelFamilies: ModelEffortEntry[];
  fallback: { efforts: string[]; default: string };
}

// ── Compaction settings ────────────────────────────────────────────────────

export interface CompactionSettings {
  enabled: boolean;
  thresholdPercent: number;       // 50-90, default 70
  strategy: 'summarize' | 'truncate' | 'sliding-window';
  keepRecent: number;             // messages to always keep, default 4
  useCustomModel: boolean;        // toggle — default false (use chat model)
  compactorProviderId: string;    // only relevant when useCustomModel = true
  compactorModel: string;         // only relevant when useCustomModel = true
}

export interface AiSettings {
  providers: AiProvider[];
  activeProviderId: string;
  activeModel: string;
  activeSkillIds: string[];
  /** Seconds to wait for the first chunk from the model server before timing out (default 300) */
  firstChunkTimeoutSec: number;
}

/** Per-project AI selections (provider, model, effort) persisted on disk. */
export interface ProjectAiSelections {
  providerId: string;
  model: string;
  effort: AiEffort;
}

// Writing Skills
export interface WritingSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;   // Injected into system prompt
  createdAt: string;
  updatedAt: string;
}

// Token usage tracking
export interface TokenUsageRecord {
  id: string;
  timestamp: string;
  sessionId?: string;
  projectId: string;
  projectName?: string;     // display name — may be missing for legacy records
  bookId?: string;
  source: 'chat' | 'import' | 'editor-inline';
  providerId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;     // from prompt_tokens_details?.cached_tokens ?? 0
  iterationCount: number;   // tool loop iterations (chat) or LLM calls per page (import)
  durationMs?: number;      // stream duration for perf comparison
}

export interface TokenUsageSummary {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  totalSessions: number;
  avgTokensPerSession: number;
  cacheHitRate: number;  // percentage 0-100
  recordsByDate: Array<{ date: string; totalTokens: number }>;
  recordsByModel: Array<{ model: string; totalTokens: number }>;
  recordsBySource: Array<{ source: string; totalTokens: number }>;
}

// ── Sub-Agent types ──────────────────────────────────────────────────

/** Model configuration with fallback chain */
export interface SubAgentModelConfig {
  providerId: string;
  model: string;
  effort: AiEffort;
}

/** User-created sub-agent definition (persisted) */
export interface SubAgent {
  id: string;
  name: string;           // e.g., "Sad Back Story Writer"
  description: string;    // max 100 chars, shown in UI hover
  systemPrompt: string;   // full prompt defining the sub-agent's role
  skillIds: string[];     // writing skill IDs to inject
  defaultModel: SubAgentModelConfig;
  fallbackModels: SubAgentModelConfig[];  // try in order if default fails
  maxStreams?: number;  // 0 or undefined = unlimited. Max LLM streams (iterations) before stopping.
  createdAt: string;
  updatedAt: string;
}

/** Active sub-agent run (ephemeral, per session) */
export interface SubAgentRun {
  id: string;
  subAgentId: string;
  subAgentName: string;       // config name
  agentName?: string;         // name given by main agent when delegating
  sessionId: string;      // parent session
  task: string;           // what the main agent delegated
  status: 'running' | 'completed' | 'error';
  result?: string;        // returned text (if sub-agent returned text, not edits)
  error?: string;
  messages: ChatMessage[];
  streamingContent?: string;      // in-progress text during LLM streaming (token-by-token)
  streamingReasoning?: string;    // in-progress reasoning during LLM streaming
  modelUsed?: string;     // which model actually ran (after fallback)
  startedAt: string;
  completedAt?: string;
}

// ── Story Planner types ──────────────────────────────────────────────────

export type PlanNodeType = 'chapter' | 'scene' | 'beat' | 'note';
export type PlanEdgeType = 'follows' | 'causes' | 'conflicts' | 'resolves';
export type PlanNodeStatus = 'draft' | 'in_progress' | 'complete' | 'cut';

export interface PlanNodeData {
  label: string;
  description?: string;
  status: PlanNodeStatus;
  level?: 'act' | 'chapter';       // for 'chapter' type nodes
  subplotId?: string;              // for grouping subplot beats
  parentId?: string;               // hierarchy link
  characters?: string[];           // character IDs involved
  notes?: string;                  // free-form notes
  generatedChapterId?: string;     // link to generated chapter
  meta?: Record<string, unknown>;  // extensible metadata
}

export interface PlanEdgeData {
  label?: string;
}

export interface PlanNode {
  id: string;
  type: PlanNodeType;
  data: PlanNodeData;
  position: { x: number; y: number };
}

export interface PlanEdge {
  id: string;
  source: string;
  target: string;
  type: PlanEdgeType;
  data?: PlanEdgeData;
}

export interface PlanModel {
  version: 1;
  nodes: PlanNode[];
  edges: PlanEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

// ── MCP Client types ──────────────────────────────────────────────────

/** MCP server config (persisted, shared for renderer UI) */
export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  timeoutMs?: number;
  createdAt: string;
  updatedAt: string;
}

/** MCP server status for UI display */
export type McpServerStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

/** MCP server with runtime status (for API responses) */
export interface McpServerInfo {
  config: McpServerConfig;
  status: McpServerStatus;
  error?: string;
  toolCount: number;
  toolNames: string[];
}

/** Progress event for generation pipeline */
export interface GenerationProgress {
  nodeId: string;
  nodeLabel: string;
  nodeType: PlanNodeType;
  status: 'pending' | 'generating' | 'complete' | 'error';
  chapterId?: string;
  error?: string;
  /** Which node number we're on (1-indexed) */
  current: number;
  /** Total nodes to process */
  total: number;
}
