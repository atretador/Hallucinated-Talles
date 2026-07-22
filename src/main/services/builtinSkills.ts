import type { WritingSkill } from '../../shared/types';

/**
 * Built-in skills shipped with the app.
 * These teach the agent how to manage skills and sub-agents.
 * They appear in listSkills alongside user-created skills.
 */
export const builtinSkills: WritingSkill[] = [
  {
    id: '_builtin_skill_management',
    name: 'Skill Management',
    description: 'Create, edit, and delete writing skills on user request',
    instructions: `When the user wants to create, edit, or delete a writing skill, use these tools:

## Create a Skill
Call createSkill with:
- name: short name (max 48 chars) — e.g. "Victorian Dialogue Style"
- description: brief summary (max 128 chars) — what the skill does
- instructions: full instructions the agent follows when this skill is active

## Edit a Skill
Call updateSkill with the skillId and any fields to change (name, description, instructions).
Only pass fields the user wants changed.

## Delete a Skill
Call deleteSkill with the skillId. Confirm with the user first.

## Tips
- Keep instructions specific and actionable — tell the agent exactly what to do
- Focus on one concern per skill (dialogue style, world-building rules, formatting conventions)
- The user can describe what they want in natural language — translate that into clear instructions
- After creating, confirm the skill was saved and how it can be activated`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '_builtin_agent_management',
    name: 'Agent Management',
    description: 'Create, edit, and delete sub-agents on user request',
    instructions: `When the user wants to create, edit, or delete a sub-agent, use these tools:

## Create a Sub-Agent
Call createSubAgent with:
- name: short name (max 48 chars) — e.g. "Dialogue Editor"
- description: brief summary (max 128 chars) — what the agent does
- systemPrompt: full system prompt defining the agent's role, behavior, and constraints

## Edit a Sub-Agent
Call updateSubAgent with the agentId and any fields to change (name, description, systemPrompt).
Only pass fields the user wants changed.

## Delete a Sub-Agent
Call deleteSubAgent with the agentId. Confirm with the user first.

## Tips
- The system prompt is the agent's identity — be specific about its role, scope, and output format
- The agent inherits the current AI provider/model by default
- Sub-agents can be delegated tasks via delegateToSubAgent — think about what tasks this agent should handle
- After creating, confirm the agent was saved and how it can be used`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
