const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim();

function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE) return normalizedPath;
  return `${API_BASE}${normalizedPath}`;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function errorFromResponse(data: any, fallback: string) {
  const msg = data?.message;
  return new Error(typeof msg === 'string' && msg.trim() ? msg : fallback);
}

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

  // 確保另一個 storage 不會殘留舊的登入狀態
  const other = remember ? sessionStorage : localStorage;
  other.removeItem('auth_token');
  other.removeItem('auth_user');
}

/**
 * 優先讀 localStorage，其次讀 sessionStorage
 */
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

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  } as const;
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

export type GallerySummary = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  templateTitle: string;
  templateImage: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};

export type GalleryDetail = GallerySummary & {
  sceneJson: string | null;
};

export async function getMyGalleries(token: string): Promise<{ galleries: GallerySummary[] }> {
  const res = await fetch(apiUrl('/api/galleries/mine'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入展覽列表失敗');
  return data as { galleries: GallerySummary[] };
}

export async function createGallery(
  token: string,
  payload: {
    title: string;
    description: string;
    templateTitle: string;
    templateImage: string;
    category: string;
    sceneJson?: string;
  },
): Promise<{ gallery: GalleryDetail }> {
  const res = await fetch(apiUrl('/api/galleries'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立展覽失敗');
  return data as { gallery: GalleryDetail };
}

export async function getGalleryById(token: string, id: string): Promise<{ gallery: GalleryDetail }> {
  const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入展覽內容失敗');
  return data as { gallery: GalleryDetail };
}

export async function deleteGalleryById(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '刪除展覽失敗');
  return data as { ok: true };
}

export async function updateGalleryById(
  token: string,
  id: string,
  payload: Partial<Pick<GalleryDetail, 'title' | 'description' | 'templateTitle' | 'templateImage' | 'category' | 'sceneJson'>>,
): Promise<{ gallery: GalleryDetail }> {
  const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '儲存展覽失敗');
  return data as { gallery: GalleryDetail };
}

export async function generateGuideTts(payload: {
  title?: string;
  artist?: string;
  description?: string;
  voice?: string;
}): Promise<Blob> {
  const res = await fetch(apiUrl('/api/tts/guide'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw errorFromResponse(data, '語音導覽產生失敗');
  }

  return await res.blob();
}
