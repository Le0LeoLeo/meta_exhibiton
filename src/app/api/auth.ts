import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export async function registerUser(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '註冊失敗');
  return data as AuthResponse;
}

export async function loginUser(payload: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '登入失敗');
  return data as AuthResponse;
}

function loadAuthFromStorage(storage: Storage): { token: string | null; user: AuthUser | null } {
  const token = storage.getItem('auth_token');
  const rawUser = storage.getItem('auth_user');
  let user: AuthUser | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as AuthUser;
    } catch {
      user = null;
    }
  }
  return { token, user };
}

export function saveAuth(auth: AuthResponse, opts?: { remember?: boolean }) {
  const remember = opts?.remember ?? true;
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem('auth_token', auth.token);
  storage.setItem('auth_user', JSON.stringify(auth.user));

  const other = remember ? sessionStorage : localStorage;
  other.removeItem('auth_token');
  other.removeItem('auth_user');
}

export function loadAuth(): { token: string | null; user: AuthUser | null; source: 'local' | 'session' | 'none' } {
  const fromLocal = loadAuthFromStorage(localStorage);
  if (fromLocal.token) return { ...fromLocal, source: 'local' };

  const fromSession = loadAuthFromStorage(sessionStorage);
  if (fromSession.token) return { ...fromSession, source: 'session' };

  return { token: null, user: null, source: 'none' };
}

export function clearAuth() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_user');
}

export async function getMe(token: string): Promise<{ user: AuthUser }> {
  const res = await fetch(apiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入個人資料失敗');
  return data as { user: AuthUser };
}

export async function updateMyName(token: string, name: string): Promise<AuthResponse> {
  const res = await fetch(apiUrl('/api/users/me'), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '更新姓名失敗');
  return data as AuthResponse;
}

export async function changePassword(token: string, payload: { currentPassword: string; newPassword: string }): Promise<{ ok: true }> {
  const res = await fetch(apiUrl('/api/auth/change-password'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '修改密碼失敗');
  return data as { ok: true };
}

export async function deleteMyAccount(token: string): Promise<{ ok: true }> {
  const res = await fetch(apiUrl('/api/users/me'), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '刪除帳號失敗');
  return data as { ok: true };
}
