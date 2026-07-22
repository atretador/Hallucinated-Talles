import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { SubAgent, SubAgentRun } from '../../shared/types';

// ── Storage ────────────────────────────────────────────────────────

function getStoragePath(): string {
  return path.join(app.getPath('userData'), 'sub-agents.json');
}

async function readAll(): Promise<SubAgent[]> {
  try {
    const raw = await fs.readFile(getStoragePath(), 'utf-8');
    return JSON.parse(raw) as SubAgent[];
  } catch {
    return [];
  }
}

async function writeAll(agents: SubAgent[]): Promise<void> {
  await fs.mkdir(path.dirname(getStoragePath()), { recursive: true });
  await fs.writeFile(getStoragePath(), JSON.stringify(agents, null, 2), 'utf-8');
}

// ── CRUD ───────────────────────────────────────────────────────────

export async function listSubAgents(): Promise<SubAgent[]> {
  return readAll();
}

export async function getSubAgent(id: string): Promise<SubAgent | undefined> {
  const agents = await readAll();
  return agents.find(a => a.id === id);
}

export async function saveSubAgent(agent: SubAgent): Promise<SubAgent> {
  const agents = await readAll();
  const now = new Date().toISOString();

  if (agent.id) {
    // Update existing
    const idx = agents.findIndex(a => a.id === agent.id);
    const updated = { ...agent, updatedAt: now };
    if (idx >= 0) {
      agents[idx] = updated;
    } else {
      agents.push(updated);
    }
    await writeAll(agents);
    return updated;
  }

  // Create new
  const created: SubAgent = {
    ...agent,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  agents.push(created);
  await writeAll(agents);
  return created;
}

export async function deleteSubAgent(id: string): Promise<boolean> {
  const agents = await readAll();
  const idx = agents.findIndex(a => a.id === id);
  if (idx < 0) return false;
  agents.splice(idx, 1);
  await writeAll(agents);
  return true;
}

// ── In-Memory Run Tracking ─────────────────────────────────────────

export const activeRuns = new Map<string, SubAgentRun>();
export const runAbortControllers = new Map<string, AbortController>();

export function getSubAgentRun(runId: string): SubAgentRun | undefined {
  return activeRuns.get(runId);
}

export function listSubAgentRuns(sessionId?: string): SubAgentRun[] {
  const runs = Array.from(activeRuns.values());
  if (sessionId) {
    return runs.filter(r => r.sessionId === sessionId);
  }
  return runs;
}

export function cancelSubAgentRun(runId: string): boolean {
  const controller = runAbortControllers.get(runId);
  if (controller) {
    controller.abort();
    runAbortControllers.delete(runId);
    const run = activeRuns.get(runId);
    if (run && run.status === 'running') {
      run.status = 'error';
      run.error = 'Cancelled by user';
      run.completedAt = new Date().toISOString();
    }
    return true;
  }
  return false;
}

// ── Re-exports for convenience ─────────────────────────────────────
// subAgentRunner.ts provides delegateToSubAgent and run execution.
// subAgentPrompt.ts provides buildSubAgentSystemPrompt.
