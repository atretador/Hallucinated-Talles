export const API_BASE = `http://localhost:${window.electron?.getApiPort() ?? '3000'}/api`;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Returns standard headers including project/book ID for raw fetch() calls */
export function getStandardHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const projectId = (window as unknown as Record<string, unknown>).__activeProjectId as string;
  if (projectId && projectId !== 'default') {
    headers['x-project-id'] = projectId;
  }
  const bookId = (window as unknown as Record<string, unknown>).__activeBookId as string;
  if (bookId) {
    headers['x-book-id'] = bookId;
  }
  return headers;
}

/** Returns the API base URL for raw fetch() calls */
export function getApiBase(): string {
  return API_BASE;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const headers: Record<string, string> = body ? { 'Content-Type': 'application/json' } : {};

  // Send active project ID for multi-project support
  const projectId = (window as unknown as Record<string, unknown>).__activeProjectId as string;
  if (projectId && projectId !== 'default') {
    headers['x-project-id'] = projectId;
  }

  // Send active book ID for multi-book support
  const bookId = (window as unknown as Record<string, unknown>).__activeBookId as string;
  if (bookId) {
    headers['x-book-id'] = bookId;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    let message = `API error: ${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch { /* non-JSON error body — keep default message */ }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { signal }),

  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),

  put: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PUT', body, signal }),

  patch: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PATCH', body, signal }),

  delete: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'DELETE', signal }),
};
