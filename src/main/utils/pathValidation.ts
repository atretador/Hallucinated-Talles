import path from 'node:path';

/**
 * Check if a resolved file path is contained within a target directory.
 * Uses path.resolve to normalize both paths before comparison.
 */
export function isWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);
  return resolvedFile.startsWith(resolvedDir + path.sep) || resolvedFile === resolvedDir;
}

/**
 * Validate that a projectId does not contain path traversal sequences.
 * Rejects: "..", "/", "\", null bytes, and empty strings.
 */
export function isValidProjectId(projectId: string): boolean {
  if (!projectId || typeof projectId !== 'string') return false;
  if (projectId.includes('\0')) return false;
  if (projectId === '..' || projectId === '.') return false;
  // Reject any path separator or traversal sequence
  if (projectId.includes('/') || projectId.includes('\\') || projectId.includes('..')) return false;
  return true;
}
