import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch } from './request';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

let inMemoryAuth: AuthResponse | null = null;
const authListeners = new Set<() => void>();

function notifyAuthListeners() {
  for (const listener of authListeners) listener();
}

export function subscribeAuth(listener: () => void) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export async function registerUser(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
  const res = await apiFetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '註冊失敗');
  return data as AuthResponse;
}

export async function loginUser(payload: { email: string; password: string }): Promise<AuthResponse> {
  const res = await apiFetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '登入失敗');
  return data as AuthResponse;
}

export function saveAuth(auth: AuthResponse, opts?: { remember?: boolean }) {
  void opts;
  inMemoryAuth = auth;
  clearLegacyAuthStorage();
  notifyAuthListeners();
}

export function loadAuth(): { token: string | null; user: AuthUser | null; source: 'local' | 'session' | 'none' } {
  if (inMemoryAuth) return { ...inMemoryAuth, source: 'none' };

  return { token: null, user: null, source: 'none' };
}

export function clearAuth() {
  inMemoryAuth = null;
  notifyAuthListeners();
  void logoutUser().catch(() => undefined);
  clearLegacyAuthStorage();
}

function clearLegacyAuthStorage() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_user');
}

export async function logoutUser(): Promise<void> {
  await apiFetch(apiUrl('/api/auth/logout'), { method: 'POST' });
}

export async function getMe(token?: string | null): Promise<AuthResponse> {
  const res = await apiFetch(apiUrl('/api/auth/me'), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const error = errorFromResponse(data, '載入個人資料失敗') as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return data as AuthResponse;
}

export async function updateMyName(token: string, name: string): Promise<AuthResponse> {
  const res = await apiFetch(apiUrl('/api/users/me'), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '更新姓名失敗');
  return data as AuthResponse;
}

export async function changePassword(token: string, payload: { currentPassword: string; newPassword: string }): Promise<{ ok: true }> {
  const res = await apiFetch(apiUrl('/api/auth/change-password'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '修改密碼失敗');
  return data as { ok: true };
}

export async function deleteMyAccount(token: string): Promise<{ ok: true }> {
  const res = await apiFetch(apiUrl('/api/users/me'), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '刪除帳號失敗');
  return data as { ok: true };
}

export async function exportMyData(token: string): Promise<Blob> {
  const res = await apiFetch(apiUrl('/api/users/me/export'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw errorFromResponse(data, '個人資料匯出失敗');
  }
  return res.blob();
}
