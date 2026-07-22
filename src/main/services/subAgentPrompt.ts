import { FileService } from './fileService';
import * as skillsService from './skillsService';
import type { SubAgent } from '../../shared/types';

// ── Build Sub-Agent System Prompt ──────────────────────────────────

export async function buildSubAgentSystemPrompt(
  subAgent: SubAgent,
  projectId?: string,
  bookId?: string,
  context?: string[],
): Promise<string> {
  const sections: string[] = [subAgent.systemPrompt];

  // Inject skill instructions
  if (subAgent.skillIds.length > 0 && projectId) {
    try {
      const allSkills = await skillsService.listSkills(projectId);
      const matchedSkills = allSkills.filter(s => subAgent.skillIds.includes(s.id));
      if (matchedSkills.length > 0) {
        const skillSections = matchedSkills
          .map(s => `[Writing Skill: ${s.name}]\n${s.instructions}`)
          .join('\n\n');
        sections.push(skillSections);
      }
    } catch {
      console.debug('[subAgentPrompt] Skills not available, skipping');
      // Skills not available — skip
    }
  }

  // Inject requested context
  if (context && context.length > 0 && projectId) {
    try {
      const fileService = new FileService(projectId, bookId || undefined);
      const contextParts: string[] = [];

      for (const ctxType of context) {
        switch (ctxType) {
          case 'bookStructure': {
            const structure = await fileService.getBookStructure();
            if (structure) {
              const summary = [
                `Book: "${structure.title}" (id: ${structure.id})`,
                ...structure.items.map((item) =>
                  item.type === 'chapter'
                    ? `- Chapter: "${item.title}" (id: ${item.id})`
                    : `- Page: "${item.title || 'Untitled'}" (id: ${item.id})`
                ),
              ].join('\n');
              contextParts.push(`[Book Structure]\n${summary}`);
            }
            break;
          }
          case 'characters': {
            const { characters } = await fileService.getMetadata();
            if (characters && characters.length > 0) {
              contextParts.push(`[Characters]\n${characters.map(c => `${c.name}: ${c.description}`).join('\n')}`);
            }
            break;
          }
          case 'events': {
            const { events } = await fileService.getMetadata();
            if (events && events.length > 0) {
              contextParts.push(`[Events]\n${events.map(e => `${e.title} (${e.type}): ${e.description}`).join('\n')}`);
            }
            break;
          }
          case 'plan': {
            const plan = await fileService.getPlan();
            if (plan && plan.nodes.length > 0) {
              const summary = plan.nodes.map(n =>
                `- [${n.type}] "${n.data.label}" (id: ${n.id}, status: ${n.data.status})`
              ).join('\n');
              contextParts.push(`[Plan]\n${summary}`);
            }
            break;
          }
          case 'worldData': {
            const { worldData } = await fileService.getMetadata();
            if (worldData && worldData.length > 0) {
              const summary = worldData.map(w =>
                `- ${w.name}: ${w.shortDescription} (id: ${w.id})`
              ).join('\n');
              contextParts.push(`[World Data]\n${summary}`);
            }
            break;
          }
        }
      }

      if (contextParts.length > 0) {
        sections.push(contextParts.join('\n\n'));
      }
    } catch (err) {
      console.warn('[subAgentPrompt] Context loading failed:', err);
      sections.push('[Context loading failed — some context may be unavailable]');
    }
  }

  sections.push(
    'You are an autonomous sub-agent working on a specific task assigned to you. ' +
    'Complete your task using the available tools, then provide a clear summary of what you changed and why.\n\n' +

    // ── Constraints ──
    'CONSTRAINTS:\n' +
    '- You cannot delegate to other sub-agents — complete the task yourself.\n' +
    '- Focus on your assigned task. Do not wander off or start unrelated work.\n' +
    '- When your task is complete, stop calling tools and provide a summary.\n\n' +

    // ── Task Execution ──
    'TASK EXECUTION:\n' +
    '- Read the task description carefully. Break it into steps if complex.\n' +
    '- Use searchContent to understand the current state before making changes.\n' +
    '- Make targeted edits (editRange) rather than rewriting entire sections.\n' +
    '- If you need book structure, use listBooks and getBookStructure.\n\n' +

    // ── Book & Content Tools ──
    'BOOK & CONTENT:\n' +
    '- Use listBooks and getBookStructure to understand the project layout.\n' +
    '- Prefer editRange for targeted changes (low risk) and appendToContent to add at the end (safe).\n' +
    '- Use editContent ONLY for full rewrites — it replaces the ENTIRE document, all existing content is lost.\n' +
    '- Use insertChapter to create new chapter structure.\n' +
    '- Use searchContent to find relevant passages before making changes.\n\n' +

    // ── Mandatory Tracking ──
    'TRACKING (mandatory during writing/editing):\n' +
    '- Characters: register new named characters (addCharacter), update when they change (editCharacter with chapterId, description, impact), record relationships and introductions. Check existing characters before writing.\n' +
    '- Events: register significant plot developments (addEvent) with chapterId, text locations, involved characters, type (major/minor/background), and consequences. Check existing events before writing new scenes.\n' +
    '- World Data: register/update world-building elements (addWorldData/editWorldData). PROHIBITED: book/chapter titles, character names, or paraphrases. Check existing world data before writing scenes in a location.\n\n' +

    // ── Plan Management ──
    'PLAN MANAGEMENT:\n' +
    '- Use getPlan to view the outline, addPlanNode to create new nodes, updatePlanNode to change status.\n' +
    '- Use connectPlanNodes/disconnectPlanNodes to manage plan flow.\n' +
    '- Before adding new plan nodes, use getPlan and preserve existing nodes; update or connect existing nodes when better than duplicating.\n\n' +

    // ── Task Queue ──
    'TASK QUEUE:\n' +
    '- Use createTask, getTasks, completeTask to manage work items if your task involves multi-step tracking.\n\n' +

    // ── Output Quality ──
    'OUTPUT:\n' +
    '- After receiving tool results, think through what they mean before responding.\n' +
    '- Use markdown formatting (headers, lists, bold) for structure and readability.\n' +
    '- If a tool call fails, explain the error and suggest a fix.\n' +
    '- Maintain the established tone and style of the book when writing story content.\n' +
    '- End with a clear summary: what you changed, what you created, and why.',
  );

  return sections.join('\n\n');
}
