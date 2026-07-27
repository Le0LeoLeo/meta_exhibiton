import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch } from './request';
import {
  normalizeAvatarAppearance,
  type AvatarAppearanceV1,
} from '../modules/metaverse3d/avatar/avatarAppearance';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarAppearance: AvatarAppearanceV1;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

let inMemoryAuth: AuthResponse | null = null;
const authListeners = new Set<() => void>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAuthResponse(value: unknown): AuthResponse {
  if (!isRecord(value) || typeof value.token !== 'string' || !isRecord(value.user)) {
    throw new Error('Invalid authentication response');
  }
  const { user } = value;
  if (
    typeof user.id !== 'string'
    || typeof user.email !== 'string'
    || typeof user.name !== 'string'
  ) {
    throw new Error('Invalid authentication response');
  }
  return {
    token: value.token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarAppearance: normalizeAvatarAppearance(user.avatarAppearance),
    },
  };
}

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
  return normalizeAuthResponse(data);
}

export async function loginUser(payload: { email: string; password: string }): Promise<AuthResponse> {
  const res = await apiFetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '登入失敗');
  return normalizeAuthResponse(data);
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
  return normalizeAuthResponse(data);
}

export async function updateMyName(token: string, name: string): Promise<AuthResponse> {
  const res = await apiFetch(apiUrl('/api/users/me'), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '更新姓名失敗');
  return normalizeAuthResponse(data);
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

export async function updateMyAvatar(
  token: string,
  appearance: AvatarAppearanceV1,
): Promise<{ avatarAppearance: AvatarAppearanceV1 }> {
  const res = await apiFetch(apiUrl('/api/users/me/avatar'), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(appearance),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '無法儲存角色外觀');
  if (!isRecord(data)) throw new Error('Invalid avatar response');
  return { avatarAppearance: normalizeAvatarAppearance(data.avatarAppearance) };
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
