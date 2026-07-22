import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { getEffectiveProjectsDir } from './settings';
import { builtinSkills } from './builtinSkills';
import type { WritingSkill } from '../../shared/types';

// Frontmatter delimiter
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

/** Get the global skills directory (user-wide, available across all projects) */
function getGlobalSkillsDir(): string {
  return path.join(app.getPath('userData'), 'skills');
}

/** Get the project-local skills directory */
function getProjectSkillsDir(projectId: string): string {
  return path.join(getEffectiveProjectsDir(), projectId, 'skills');
}

/** Parse YAML frontmatter + body from a .md file */
function parseSkillFile(content: string, filename: string): WritingSkill {
  const match = content.match(FRONTMATTER_RE);
  const id = filename.replace(/\.md$/i, '');

  if (match) {
    const frontmatter = match[1];
    const body = match[2].trim();
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

    return {
      id,
      name: nameMatch?.[1]?.trim() || id,
      description: descMatch?.[1]?.trim() || '',
      instructions: body,
      createdAt: '',
      updatedAt: '',
    };
  }

  // No frontmatter — use filename as name, entire content as instructions
  return {
    id,
    name: id,
    description: '',
    instructions: content.trim(),
    createdAt: '',
    updatedAt: '',
  };
}

/** Serialize a skill back to .md with frontmatter */
function serializeSkill(skill: WritingSkill): string {
  const lines = ['---'];
  lines.push(`name: ${skill.name}`);
  if (skill.description) {
    lines.push(`description: ${skill.description}`);
  }
  lines.push('---');
  lines.push('');
  lines.push(skill.instructions);
  return lines.join('\n');
}

/** Read all .md skill files from a directory */
async function readSkillsFromDir(dir: string): Promise<WritingSkill[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const skills: WritingSkill[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      try {
        const content = await fs.readFile(path.join(dir, entry.name), 'utf-8');
        const stat = await fs.stat(path.join(dir, entry.name));
        const skill = parseSkillFile(content, entry.name);
        skill.createdAt = stat.birthtime.toISOString();
        skill.updatedAt = stat.mtime.toISOString();
        skills.push(skill);
      } catch {
        console.debug('[skillsService] Skip unreadable files');
        // Skip unreadable files
      }
    }

    return skills;
  } catch {
    return []; // Directory doesn't exist yet
  }
}

/**
 * List all skills for a project.
 * Reads global skills, then project skills. Same filename → project overrides global.
 */
export async function listSkills(projectId: string): Promise<WritingSkill[]> {
  // Start with built-in skills
  const merged = new Map<string, WritingSkill>();
  for (const skill of builtinSkills) {
    merged.set(skill.id, skill);
  }

  // Layer global user skills on top
  const globalSkills = await readSkillsFromDir(getGlobalSkillsDir());
  for (const skill of globalSkills) {
    merged.set(skill.id, skill);
  }

  // Layer project skills on top (project overrides global/built-in by id)
  const projectSkills = await readSkillsFromDir(getProjectSkillsDir(projectId));
  for (const skill of projectSkills) {
    merged.set(skill.id, skill);
  }

  return Array.from(merged.values());
}

/** Get a single skill by id (project takes precedence) */
export async function getSkill(projectId: string, id: string): Promise<WritingSkill | undefined> {
  // Try project first
  const projectDir = getProjectSkillsDir(projectId);
  const projectFile = path.join(projectDir, `${id}.md`);
  try {
    const content = await fs.readFile(projectFile, 'utf-8');
    const stat = await fs.stat(projectFile);
    const skill = parseSkillFile(content, `${id}.md`);
    skill.createdAt = stat.birthtime.toISOString();
    skill.updatedAt = stat.mtime.toISOString();
    return skill;
  } catch {
    console.debug('[skillsService] Not in project, trying global');
    // Not in project, try global
  }

  const globalDir = getGlobalSkillsDir();
  const globalFile = path.join(globalDir, `${id}.md`);
  try {
    const content = await fs.readFile(globalFile, 'utf-8');
    const stat = await fs.stat(globalFile);
    const skill = parseSkillFile(content, `${id}.md`);
    skill.createdAt = stat.birthtime.toISOString();
    skill.updatedAt = stat.mtime.toISOString();
    return skill;
  } catch {
    return undefined;
  }

  // Check built-in skills
  const builtin = builtinSkills.find(s => s.id === id);
  if (builtin) return builtin;

  return undefined;
}

/** Save a skill. scope: 'global' writes to userData, 'project' writes to project dir. */
export async function saveSkill(
  projectId: string,
  skill: WritingSkill,
  scope: 'global' | 'project',
): Promise<WritingSkill> {
  const dir = scope === 'global' ? getGlobalSkillsDir() : getProjectSkillsDir(projectId);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${skill.id}.md`;
  const filePath = path.join(dir, filename);
  const content = serializeSkill(skill);
  await fs.writeFile(filePath, content, 'utf-8');

  const stat = await fs.stat(filePath);
  skill.createdAt = stat.birthtime.toISOString();
  skill.updatedAt = stat.mtime.toISOString();
  return skill;
}

/** Delete a skill by id. Tries project dir first, then global. */
export async function deleteSkill(projectId: string, id: string): Promise<boolean> {
  const projectFile = path.join(getProjectSkillsDir(projectId), `${id}.md`);
  const globalFile = path.join(getGlobalSkillsDir(), `${id}.md`);

  for (const filePath of [projectFile, globalFile]) {
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      console.debug('[skillsService] File does not exist at this location, trying next');
      // File doesn't exist at this location, try next
    }
  }
  return false;
}

/** Read raw file content for a skill (for editing) */
export async function getSkillRaw(projectId: string, id: string): Promise<{ content: string; scope: 'global' | 'project' } | undefined> {
  // Try project first
  const projectFile = path.join(getProjectSkillsDir(projectId), `${id}.md`);
  try {
    const content = await fs.readFile(projectFile, 'utf-8');
    return { content, scope: 'project' };
  } catch {
    console.debug('[skillsService] Skill not in project');
    // Not in project
  }

  const globalFile = path.join(getGlobalSkillsDir(), `${id}.md`);
  try {
    const content = await fs.readFile(globalFile, 'utf-8');
    return { content, scope: 'global' };
  } catch {
    return undefined;
  }
}

/** Ensure the global skills directory exists */
export async function ensureGlobalSkillsDir(): Promise<string> {
  const dir = getGlobalSkillsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Ensure a project's skills directory exists */
export async function ensureProjectSkillsDir(projectId: string): Promise<string> {
  const dir = getProjectSkillsDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
