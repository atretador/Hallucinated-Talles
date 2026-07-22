import { FileService } from '../services/fileService';
import type { ChatMessage, ChatMessagePart, PlanModel } from '../../shared/types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/** Resolve a human-readable project title from its directory name */
export async function resolveProjectTitle(projectId: string): Promise<string> {
  try {
    const bookList = await FileService.listBooks(projectId);
    if (bookList.length > 0) {
      const fs = new FileService(projectId, bookList[0]);
      const structure = await fs.getBookStructure();
      return structure.title ?? projectId;
    }
    return projectId;
  } catch {
    return projectId;
  }
}

export function toOpenAIMessage(msg: ChatMessage): ChatCompletionMessageParam {
  if (msg.role === 'system') {
    return { role: 'system', content: msg.content };
  }

  // Build multimodal content for user messages with images
  if (msg.role === 'user' && msg.images && msg.images.length > 0) {
    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
    > = [{ type: 'text', text: msg.content }];
    for (const img of msg.images) {
      content.push({
        type: 'image_url',
        image_url: { url: img, detail: 'auto' },
      });
    }
    return { role: 'user', content };
  }

  if (msg.role === 'user') {
    return { role: 'user', content: msg.content };
  }

  const textContent = (msg.parts ?? [])
    .filter((part): part is Extract<ChatMessagePart, { type: 'text' }> => part.type === 'text')
    .map(part => part.content)
    .join('') || msg.content || null;
  const toolCalls = (msg.parts ?? [])
    .filter((part): part is Extract<ChatMessagePart, { type: 'tool_call' }> => part.type === 'tool_call')
    .map(part => part.toolCall);

  const result: {
    role: 'assistant';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  } = {
    role: 'assistant',
    content: textContent,
  };
  if (toolCalls.length > 0) {
    result.tool_calls = toolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.args),
      },
    }));
  }
  return result as ChatCompletionMessageParam;
}

/** Mask an API key, showing only the last 4 characters */
export function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

/** Simple topological sort for plan nodes based on 'follows' edges */
export function topologicalSort(plan: PlanModel): typeof plan.nodes {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of plan.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of plan.edges) {
    if (edge.type === 'follows') {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      adjacency.get(edge.source)!.push(edge.target);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: typeof plan.nodes = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = plan.nodes.find(n => n.id === id)!;
    sorted.push(node);
    for (const neighbor of adjacency.get(id) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // If some nodes weren't sorted (cycles), append them at the end
  for (const node of plan.nodes) {
    if (!sorted.find(n => n.id === node.id)) {
      sorted.push(node);
    }
  }

  return sorted;
}
