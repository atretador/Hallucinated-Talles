import { FileService } from './fileService';
import type { AiService } from './aiService';
import { pendingEdits, nextPendingEditId } from '../server/serverState';
import { delegateToSubAgent } from './subAgentRunner';
import * as subAgentService from './subAgentService';
import * as skillsService from './skillsService';
import { generateTaskId } from '../utils/idGenerator';
import type { PendingEdit, AgentTask } from '../../shared/types';

export interface ChatToolContext {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  emit: (event: string, data: unknown) => void;
  projectId: string;
  sessionId: string | undefined;
  bookId: string;
  agentTasks: AgentTask[];
  taskCounter: { value: number };
  fileService: FileService;
  aiService: AiService;
  externalMcpTools: unknown[];
  mcpToolCaller: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
}

export type ChatToolHandler = (ctx: ChatToolContext) => Promise<unknown>;

// ── Handlers ──────────────────────────────────────────────────────────

export async function handlePendingEdit(ctx: ChatToolContext): Promise<unknown> {
  const editId = nextPendingEditId();

  // Compute preview based on tool type
  let preview = '';
  if (ctx.toolName === 'editContent' || ctx.toolName === 'appendToContent') {
    preview = (ctx.args.content as string) ?? '';
  } else if (ctx.toolName === 'editRange') {
    const find = (ctx.args.find as string) ?? '';
    const replace = (ctx.args.replace as string) ?? '';
    preview = find ? `Find: ${find}\nReplace: ${replace}` : `Insert: ${replace}`;
  } else if (ctx.toolName === 'insertChapter') {
    preview = `Add chapter: "${ctx.args.title as string}"`;
  } else if (ctx.toolName === 'deleteChapter') {
    preview = `Delete chapter: "${ctx.args.chapterTitle as string}"`;
  }

  let before: string | undefined;
  try {
    before = await ctx.fileService.getBookContent();
  } catch {
    // document might be new — before stays undefined
  }

  const pendingEdit: PendingEdit = {
    id: editId,
    tool: ctx.toolName,
    args: ctx.args,
    preview,
    before,
  };
  pendingEdits.set(editId, pendingEdit);

  // Send pending_edit event to frontend
  ctx.emit('pending_edit', { pendingEdit });

  // Return a placeholder result so the LLM can continue
  return {
    pending: true,
    editId,
    message: `The proposed ${ctx.toolName} action is awaiting your approval.`,
  };
}

async function handleCreateTask(ctx: ChatToolContext): Promise<unknown> {
  ctx.taskCounter.value++;
  const task: AgentTask = {
    id: generateTaskId(),
    displayName: (ctx.args.displayName as string) || 'Untitled Task',
    content: (ctx.args.content as string) || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  ctx.agentTasks.push(task);

  // Persist task to session
  if (ctx.sessionId) {
    try {
      const sessionFs = new FileService(ctx.projectId);
      await sessionFs.addTask(ctx.sessionId, task);
    } catch (err) {
      console.warn('[chatToolHandlers] Failed to persist task to session', err);
    }
  }

  ctx.emit('task_update', { tasks: ctx.agentTasks });
  return { success: true, taskId: task.id, displayName: task.displayName };
}

async function handleCompleteTask(ctx: ChatToolContext): Promise<unknown> {
  const task = ctx.agentTasks.find(t => t.id === ctx.args.taskId);
  if (task) {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();

    // Persist task update to session
    if (ctx.sessionId) {
      try {
        const sessionFs = new FileService(ctx.projectId);
        await sessionFs.updateTask(ctx.sessionId, task.id, {
          status: 'completed',
          completedAt: task.completedAt,
        });
      } catch (err) {
        console.warn('[chatToolHandlers] Failed to persist task update to session', err);
      }
    }

    ctx.emit('task_update', { tasks: ctx.agentTasks });
    return { success: true, taskId: task.id, displayName: task.displayName };
  }
  return { error: `Task '${ctx.args.taskId}' not found` };
}

async function handleGetTasks(ctx: ChatToolContext): Promise<unknown> {
  return { tasks: ctx.agentTasks };
}

async function handleDelegateToSubAgent(ctx: ChatToolContext): Promise<unknown> {
  const subAgentId = ctx.args.subAgentId as string;
  const task = ctx.args.task as string;
  const agentName = ctx.args.agentName as string | undefined;
  const context = ctx.args.context as string[] | undefined;

  if (!subAgentId || !task) {
    return { error: 'subAgentId and task are required' };
  }

  try {
    const sessionFs = new FileService(ctx.projectId);
    const runId = await delegateToSubAgent(
      subAgentId, task, ctx.sessionId ?? '', ctx.projectId, ctx.bookId, sessionFs,
      agentName, context,
      ctx.externalMcpTools as any,
      ctx.mcpToolCaller,
    );

    // Persist the new run to session immediately
    if (ctx.sessionId) {
      try {
        const run = subAgentService.getSubAgentRun(runId);
        if (run) {
          await sessionFs.addSubAgentRun(ctx.sessionId, { ...run });
        }
      } catch (err) {
        console.warn('[chatToolHandlers] Failed to persist sub-agent run to session', err);
      }
    }

    // Emit sub_agent_update event
    const run = subAgentService.getSubAgentRun(runId);
    if (run) {
      ctx.emit('sub_agent_update', { run });
    }

    return {
      success: true,
      runId,
      message: `Task delegated to sub-agent "${agentName || 'unnamed'}". Use getSubAgentResult(runId="${runId}") to check progress or awaitSubAgentResult(runId="${runId}") to wait for completion.`,
    };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleListSubAgents(_ctx: ChatToolContext): Promise<unknown> {
  try {
    const agents = await subAgentService.listSubAgents();
    return {
      subAgents: agents.map(a => ({
        id: a.id,
        name: a.name.slice(0, 48),
        description: a.description.slice(0, 128),
      })),
    };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleGetSubAgentResult(ctx: ChatToolContext): Promise<unknown> {
  try {
    const run = subAgentService.getSubAgentRun(ctx.args.runId as string);
    if (run) {
      return {
        status: run.status,
        result: run.result,
        error: run.error,
        agentName: run.agentName || run.subAgentName,
        modelUsed: run.modelUsed,
        task: run.task,
      };
    }
    return { error: `Run '${ctx.args.runId}' not found` };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleAwaitSubAgentResult(ctx: ChatToolContext): Promise<unknown> {
  const runId = ctx.args.runId as string;
  if (!runId) {
    return { error: 'runId is required' };
  }

  // Poll until the run completes (max 5 minutes)
  const maxWait = 5 * 60 * 1000;
  const pollInterval = 2000;
  const startTime = Date.now();

  let run = subAgentService.getSubAgentRun(runId);
  while (run && run.status === 'running' && Date.now() - startTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    run = subAgentService.getSubAgentRun(runId);
  }

  if (!run) {
    return { error: `Run ${runId} not found` };
  }
  if (run.status === 'running') {
    return { error: 'Timed out waiting for sub-agent', status: 'running' };
  }
  return {
    status: run.status,
    result: run.result,
    error: run.error,
    agentName: run.agentName || run.subAgentName,
    modelUsed: run.modelUsed,
  };
}

async function handleListSkills(ctx: ChatToolContext): Promise<unknown> {
  try {
    const skills = await skillsService.listSkills(ctx.projectId);
    return {
      skills: skills.map(s => ({
        id: s.id,
        name: s.name.slice(0, 48),
        description: s.description.slice(0, 128),
      })),
    };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleGetSkill(ctx: ChatToolContext): Promise<unknown> {
  try {
    const skill = await skillsService.getSkill(ctx.projectId, ctx.args.skillId as string);
    if (skill) {
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
      };
    }
    return { error: `Skill '${ctx.args.skillId}' not found` };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleCreateSkill(ctx: ChatToolContext): Promise<unknown> {
  try {
    const name = String(ctx.args.name || '').trim().slice(0, 48);
    const description = String(ctx.args.description || '').trim().slice(0, 128);
    const instructions = String(ctx.args.instructions || '').trim();
    if (!name || !instructions) {
      return { error: 'name and instructions are required' };
    }
    const skill = await skillsService.saveSkill(ctx.projectId, {
      id: '',
      name,
      description,
      instructions,
      createdAt: '',
      updatedAt: '',
    }, 'project');
    const allSkills = await skillsService.listSkills(ctx.projectId);
    ctx.emit('skill_update', { skills: allSkills });
    return { success: true, id: skill.id, name: skill.name, description: skill.description };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleUpdateSkill(ctx: ChatToolContext): Promise<unknown> {
  try {
    const skillId = ctx.args.skillId as string;
    if (!skillId) { return { error: 'skillId is required' }; }

    const existing = await skillsService.getSkill(ctx.projectId, skillId);
    if (!existing) { return { error: `Skill '${skillId}' not found` }; }

    const name = ctx.args.name != null ? String(ctx.args.name).trim().slice(0, 48) : existing.name;
    const description = ctx.args.description != null ? String(ctx.args.description).trim().slice(0, 128) : existing.description;
    const instructions = ctx.args.instructions != null ? String(ctx.args.instructions).trim() : existing.instructions;

    const updated = await skillsService.saveSkill(ctx.projectId, {
      ...existing, name, description, instructions,
    }, 'project');
    const allSkills = await skillsService.listSkills(ctx.projectId);
    ctx.emit('skill_update', { skills: allSkills });
    return { success: true, id: updated.id, name: updated.name, description: updated.description };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleDeleteSkill(ctx: ChatToolContext): Promise<unknown> {
  try {
    const skillId = ctx.args.skillId as string;
    if (!skillId) { return { error: 'skillId is required' }; }

    const deleted = await skillsService.deleteSkill(ctx.projectId, skillId);
    if (deleted) {
      const allSkills = await skillsService.listSkills(ctx.projectId);
      ctx.emit('skill_update', { skills: allSkills });
    }
    return deleted ? { success: true } : { error: `Skill '${skillId}' not found` };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleCreateSubAgent(ctx: ChatToolContext): Promise<unknown> {
  try {
    const name = String(ctx.args.name || '').trim().slice(0, 48);
    const description = String(ctx.args.description || '').trim().slice(0, 128);
    const systemPrompt = String(ctx.args.systemPrompt || '').trim();
    if (!name || !description || !systemPrompt) {
      return { error: 'name, description, and systemPrompt are required' };
    }

    // Default to the currently active provider/model
    const aiSettings = ctx.aiService.getSettings();
    const defaultModel = {
      providerId: aiSettings.activeProviderId,
      model: aiSettings.activeModel,
      effort: 'auto',
    };
    const agent = await subAgentService.saveSubAgent({
      id: '',
      name,
      description,
      systemPrompt,
      skillIds: [],
      defaultModel,
      fallbackModels: [],
      createdAt: '',
      updatedAt: '',
    });
    const allAgents = await subAgentService.listSubAgents();
    ctx.emit('sub_agent_definition_update', { subAgents: allAgents });
    return { success: true, id: agent.id, name: agent.name, description: agent.description };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleUpdateSubAgent(ctx: ChatToolContext): Promise<unknown> {
  try {
    const agentId = ctx.args.agentId as string;
    if (!agentId) { return { error: 'agentId is required' }; }

    const existing = await subAgentService.getSubAgent(agentId);
    if (!existing) { return { error: `Sub-agent '${agentId}' not found` }; }

    const updated = await subAgentService.saveSubAgent({
      ...existing,
      name: ctx.args.name != null ? String(ctx.args.name).trim().slice(0, 48) : existing.name,
      description: ctx.args.description != null ? String(ctx.args.description).trim().slice(0, 128) : existing.description,
      systemPrompt: ctx.args.systemPrompt != null ? String(ctx.args.systemPrompt).trim() : existing.systemPrompt,
    });
    const allAgents = await subAgentService.listSubAgents();
    ctx.emit('sub_agent_definition_update', { subAgents: allAgents });
    return { success: true, id: updated.id, name: updated.name, description: updated.description };
  } catch (err) {
    return { error: String(err) };
  }
}

async function handleDeleteSubAgent(ctx: ChatToolContext): Promise<unknown> {
  try {
    const agentId = ctx.args.agentId as string;
    if (!agentId) { return { error: 'agentId is required' }; }

    const deleted = await subAgentService.deleteSubAgent(agentId);
    if (deleted) {
      const allAgents = await subAgentService.listSubAgents();
      ctx.emit('sub_agent_definition_update', { subAgents: allAgents });
    }
    return deleted ? { success: true } : { error: `Sub-agent '${agentId}' not found` };
  } catch (err) {
    return { error: String(err) };
  }
}

// ── Handler Map ───────────────────────────────────────────────────────

export const CHAT_TOOL_HANDLERS: Record<string, ChatToolHandler> = {
  editRange: async (ctx) => {
    const { handleEditRange } = await import('./tools/pageTools');
    const result = await handleEditRange(ctx.args, ctx.fileService, ctx.bookId);
    // Emit content update so editor refreshes
    const finalContent = await ctx.fileService.getBookContent();
    ctx.emit('content_updated', { content: finalContent });
    return result.result;
  },
  editContent: async (ctx) => {
    const { handleEditContent } = await import('./tools/pageTools');
    const result = await handleEditContent(ctx.args, ctx.fileService, ctx.bookId);
    // Emit content update so editor refreshes
    ctx.emit('content_updated', { content: ctx.args.content as string });
    return result.result;
  },
  appendToContent: async (ctx) => {
    const { handleAppendToContent } = await import('./tools/pageTools');
    const result = await handleAppendToContent(ctx.args, ctx.fileService, ctx.bookId);
    // Emit content update — read the final content from disk since appendToContent modifies it
    const finalContent = await ctx.fileService.getBookContent();
    ctx.emit('content_updated', { content: finalContent });
    return result.result;
  },
  insertChapter: async (ctx) => {
    const { handleInsertChapter } = await import('./tools/pageTools');
    const result = await handleInsertChapter(ctx.args, ctx.fileService, ctx.bookId);
    return result.result;
  },
  deleteChapter: async (ctx) => {
    const { handleDeleteChapter } = await import('./tools/pageTools');
    const result = await handleDeleteChapter(ctx.args, ctx.fileService, ctx.bookId);
    return result.result;
  },
  createTask: handleCreateTask,
  completeTask: handleCompleteTask,
  getTasks: handleGetTasks,
  delegateToSubAgent: handleDelegateToSubAgent,
  listSubAgents: handleListSubAgents,
  getSubAgentResult: handleGetSubAgentResult,
  awaitSubAgentResult: handleAwaitSubAgentResult,
  listSkills: handleListSkills,
  getSkill: handleGetSkill,
  createSkill: handleCreateSkill,
  updateSkill: handleUpdateSkill,
  deleteSkill: handleDeleteSkill,
  createSubAgent: handleCreateSubAgent,
  updateSubAgent: handleUpdateSubAgent,
  deleteSubAgent: handleDeleteSubAgent,
};
