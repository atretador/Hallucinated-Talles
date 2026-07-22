import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { app } from 'electron';
import { settingsStore } from './settings';
import type { TokenUsageRecord, TokenUsageSummary } from '../../shared/types';

// Simple promise-based mutex (async-mutex not available)
class SimpleLock {
  private _promise = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void;
    const next = new Promise<void>(r => release = r);
    const prev = this._promise;
    this._promise = next;
    await prev;
    return release!;
  }
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Single global lock for all token-usage writes
const globalLock = new SimpleLock();

/** Global NDJSON file stored in app userData (not per-project) */
function getGlobalLogFilePath(): string {
  return path.join(app.getPath('userData'), 'token-usage.ndjson');
}

export class TokenUsageService {
  private lock = globalLock;

  // ── Write ──────────────────────────────────────────────────────

  async addRecord(record: TokenUsageRecord): Promise<void> {
    const release = await this.lock.acquire();
    try {
      await this.ensureDir();
      const line = JSON.stringify(record) + '\n';
      await fsp.appendFile(getGlobalLogFilePath(), line, 'utf-8');

      // Check file size; if > 10 MB, trigger prune
      try {
        const stat = await fsp.stat(getGlobalLogFilePath());
        if (stat.size > MAX_FILE_SIZE_BYTES) {
          await this.pruneOld(true); // already locked
        }
      } catch {
        console.debug('[tokenUsageService] Stat failed, ignoring');
        // stat failed, ignore
      }
    } finally {
      release();
    }
  }

  // ── Read ───────────────────────────────────────────────────────

  async getRecords(filters?: {
    from?: string;
    to?: string;
    model?: string;
    source?: 'chat' | 'import';
    project?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: TokenUsageRecord[]; total: number }> {
    const allRecords = await this.readAllRecords();
    const filtered = this.applyFilters(allRecords, filters);

    const total = filtered.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? total;
    const records = filtered.slice(offset, offset + limit);
    return { records, total };
  }

  async getSummary(filters?: {
    from?: string;
    to?: string;
    model?: string;
    source?: 'chat' | 'import';
    project?: string;
  }): Promise<TokenUsageSummary> {
    const allRecords = await this.readAllRecords();
    const filtered = this.applyFilters(allRecords, filters);

    if (filtered.length === 0) {
      return {
        totalTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCachedTokens: 0,
        totalSessions: 0,
        avgTokensPerSession: 0,
        cacheHitRate: 0,
        recordsByDate: [],
        recordsByModel: [],
        recordsBySource: [],
      };
    }

    const totalTokens = filtered.reduce((s, r) => s + r.totalTokens, 0);
    const totalPromptTokens = filtered.reduce((s, r) => s + r.promptTokens, 0);
    const totalCompletionTokens = filtered.reduce((s, r) => s + r.completionTokens, 0);
    const totalCachedTokens = filtered.reduce((s, r) => s + r.cachedTokens, 0);

    const sessionSet = new Set<string>();
    for (const r of filtered) {
      if (r.sessionId) sessionSet.add(r.sessionId);
    }
    const totalSessions = sessionSet.size;
    const avgTokensPerSession = totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0;
    const cacheHitRate = totalTokens > 0 ? Math.round((totalCachedTokens / totalTokens) * 100) : 0;

    // Group by date (YYYY-MM-DD)
    const dateMap = new Map<string, number>();
    for (const r of filtered) {
      const date = r.timestamp.slice(0, 10);
      dateMap.set(date, (dateMap.get(date) ?? 0) + r.totalTokens);
    }
    const recordsByDate = Array.from(dateMap.entries())
      .map(([date, totalTokens]) => ({ date, totalTokens }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by model
    const modelMap = new Map<string, number>();
    for (const r of filtered) {
      modelMap.set(r.model, (modelMap.get(r.model) ?? 0) + r.totalTokens);
    }
    const recordsByModel = Array.from(modelMap.entries())
      .map(([model, totalTokens]) => ({ model, totalTokens }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    // Group by source
    const sourceMap = new Map<string, number>();
    for (const r of filtered) {
      sourceMap.set(r.source, (sourceMap.get(r.source) ?? 0) + r.totalTokens);
    }
    const recordsBySource = Array.from(sourceMap.entries())
      .map(([source, totalTokens]) => ({ source, totalTokens }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    return {
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalCachedTokens,
      totalSessions,
      avgTokensPerSession,
      cacheHitRate,
      recordsByDate,
      recordsByModel,
      recordsBySource,
    };
  }

  async getModels(): Promise<string[]> {
    const allRecords = await this.readAllRecords();
    const modelSet = new Set<string>();
    for (const r of allRecords) {
      modelSet.add(r.model);
    }
    return Array.from(modelSet).sort();
  }

  /** Return distinct project ids that have usage records */
  async getProjects(): Promise<Array<{ projectId: string; projectName: string | undefined }>> {
    const allRecords = await this.readAllRecords();
    const seen = new Map<string, string | undefined>();
    for (const r of allRecords) {
      if (!seen.has(r.projectId)) {
        seen.set(r.projectId, r.projectName);
      }
    }
    return Array.from(seen.entries()).map(([projectId, projectName]) => ({ projectId, projectName }));
  }

  // ── Prune ──────────────────────────────────────────────────────

  async pruneOld(locked = false): Promise<void> {
    const release = locked ? null : await this.lock.acquire();
    try {
      const filePath = getGlobalLogFilePath();
      try {
        await fsp.access(filePath);
      } catch {
        return; // no file, nothing to prune
      }

      const retentionDays = settingsStore.get('tokenUsageRetentionDays', 90);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);
      const cutoffStr = cutoff.toISOString();

      const records = await this.readAllRecords();
      const keep = records.filter(r => r.timestamp >= cutoffStr);

      if (keep.length === records.length) {
        return; // nothing to remove
      }

      // Rewrite file with retained records
      const content = keep.map(r => JSON.stringify(r)).join('\n') + (keep.length > 0 ? '\n' : '');
      await fsp.writeFile(filePath, content, 'utf-8');
    } finally {
      release?.();
    }
  }

  // ── Internal helpers ───────────────────────────────────────────

  private applyFilters(
    records: TokenUsageRecord[],
    filters?: { from?: string; to?: string; model?: string; source?: 'chat' | 'import'; project?: string },
  ): TokenUsageRecord[] {
    // Normalize date-only filters to full ISO range for correct comparison
    const fromStr = filters?.from;
    const toStr = filters?.to && filters.to.length === 10
      ? filters.to + 'T23:59:59.999Z'   // date-only → inclusive end-of-day
      : filters?.to;

    return records.filter(r => {
      if (fromStr && r.timestamp < fromStr) return false;
      if (toStr && r.timestamp > toStr) return false;
      if (filters?.model && r.model !== filters.model) return false;
      if (filters?.source && r.source !== filters.source) return false;
      if (filters?.project && r.projectId !== filters.project) return false;
      return true;
    });
  }

  private async ensureDir(): Promise<void> {
    const dir = path.dirname(getGlobalLogFilePath());
    await fsp.mkdir(dir, { recursive: true });
  }

  private async readAllRecords(): Promise<TokenUsageRecord[]> {
    return this.readRecordsFromFile(getGlobalLogFilePath());
  }

  private async readRecordsFromFile(filePath: string): Promise<TokenUsageRecord[]> {
    try {
      await fsp.access(filePath);
    } catch {
      return [];
    }

    return new Promise<TokenUsageRecord[]>((resolve, reject) => {
      const records: TokenUsageRecord[] = [];
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });

      rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const record = JSON.parse(trimmed) as TokenUsageRecord;
          records.push(record);
        } catch {
          console.debug('[tokenUsageService] Skip corrupted lines');
          // Skip corrupted lines
        }
      });

      rl.on('close', () => resolve(records));
      rl.on('error', (err) => reject(err));
    });
  }
}
