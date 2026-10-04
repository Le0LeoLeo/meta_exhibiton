const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim();

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE) return normalizedPath;
  return `${API_BASE}${normalizedPath}`;
}

export async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function errorFromResponse(data: unknown, fallback: string) {
  const msg = typeof data === 'object' && data !== null && 'message' in data
    ? data.message
    : undefined;
  return new Error(typeof msg === 'string' && msg.trim() ? msg : fallback);
}

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  } as const;
}
