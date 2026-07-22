import * as fs from 'fs/promises';
import * as path from 'path';
import { getEffectiveProjectsDir } from './settings';
import type { ProjectAiSelections } from '../../shared/types';

const FILE_NAME = '.ai-selections.json';

export async function getProjectAiSelections(projectId: string): Promise<ProjectAiSelections | null> {
  const filePath = path.join(getEffectiveProjectsDir(), projectId, FILE_NAME);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as ProjectAiSelections;
  } catch {
    return null;
  }
}

export async function saveProjectAiSelections(projectId: string, selections: ProjectAiSelections): Promise<void> {
  const projectDir = path.join(getEffectiveProjectsDir(), projectId);
  await fs.mkdir(projectDir, { recursive: true });
  const filePath = path.join(projectDir, FILE_NAME);
  await fs.writeFile(filePath, JSON.stringify(selections, null, 2));
}
