/** Generate a unique ID with a given prefix. Uses timestamp + random for uniqueness. */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

/** Generate a task ID. */
export function generateTaskId(): string {
  return generateId('task');
}

/** Generate a commit ID. */
export function generateCommitId(): string {
  return generateId('commit');
}
