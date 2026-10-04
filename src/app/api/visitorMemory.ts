import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch } from './request';

export type VisitorMemoryPayload = {
  visitedExhibitIds?: string[];
  engagedExhibitIds?: string[];
  dwellSecondsByExhibit?: Record<string, number>;
  preferredPersonality?: 'xiaobai' | 'expert' | 'humor';
  preferredLanguage?: string;
  lastRecommendedExhibitId?: string | null;
};

export type VisitorMemoryResponse = {
  id: string;
  userId: string;
  galleryId: string;
  visitedExhibitIds: string[];
  engagedExhibitIds: string[];
  dwellSecondsByExhibit: Record<string, number>;
  preferredPersonality: string;
  preferredLanguage: string;
  lastRecommendedExhibitId: string | null;
  updatedAt: string;
};

export async function loadVisitorMemory(
  token: string,
  galleryId: string,
): Promise<{ memory: VisitorMemoryResponse | null }> {
  const res = await apiFetch(apiUrl(`/api/visitor-memory/${encodeURIComponent(galleryId)}`), {
    method: 'GET',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '讀取訪客記憶失敗');
  return data as { memory: VisitorMemoryResponse | null };
}

export async function saveVisitorMemory(
  token: string,
  galleryId: string,
  payload: VisitorMemoryPayload,
): Promise<{ ok: boolean }> {
  const res = await apiFetch(apiUrl(`/api/visitor-memory/${encodeURIComponent(galleryId)}`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '儲存訪客記憶失敗');
  return data as { ok: boolean };
}
