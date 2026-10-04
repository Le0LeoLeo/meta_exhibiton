import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch } from './request';

export type ExhibitionPassportTask =
  | { id: 'visit-count'; kind: 'visit-count'; target: number }
  | { id: 'dwell-one'; kind: 'dwell-one'; targetSeconds: number }
  | { id: 'engage-count'; kind: 'engage-count'; target: number };

export type PassportProgress = {
  completedTaskIds: string[];
  visitedCount: number;
  engagedCount: number;
  longestDwellSeconds: number;
  complete: boolean;
};

export type ExhibitionSouvenir = {
  schemaVersion: 1;
  galleryId: string;
  galleryTitle: string;
  galleryOwnerName: string;
  completedAt: string;
  visitedCount: number;
  engagedCount: number;
  totalDwellSeconds: number;
  favoriteExhibit: { id: string; title: string; thumbnailUrl: string | null } | null;
  reflection: string;
  token?: string;
};

export type ExhibitionPassport = {
  id: string;
  galleryId: string;
  status: 'active' | 'completed';
  tasks: ExhibitionPassportTask[];
  progress: PassportProgress;
  souvenir: ExhibitionSouvenir | null;
};

export type ExhibitionPassportApiError = Error & {
  status?: number;
  code?: string;
  progress?: Partial<PassportProgress>;
};

async function readOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const data = await parseJsonSafe(response);
  if (response.ok) return data as T;

  const error = errorFromResponse(data, fallback) as ExhibitionPassportApiError;
  error.status = response.status;
  if (data && typeof data === 'object') {
    if ('code' in data && typeof data.code === 'string') error.code = data.code;
    if ('progress' in data && data.progress && typeof data.progress === 'object') {
      error.progress = data.progress as Partial<PassportProgress>;
    }
  }
  throw error;
}

export async function getExhibitionPassport(token: string, galleryId: string): Promise<ExhibitionPassport> {
  const response = await apiFetch(apiUrl(`/api/exhibition-passports/${encodeURIComponent(galleryId)}`), {
    headers: authHeaders(token),
  });
  return readOrThrow(response, 'Failed to load exhibition passport');
}

export async function completeExhibitionPassport(token: string, galleryId: string, reflection: string): Promise<ExhibitionPassport> {
  const response = await apiFetch(apiUrl(`/api/exhibition-passports/${encodeURIComponent(galleryId)}/complete`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reflection }),
  });
  return readOrThrow(response, 'Failed to complete exhibition passport');
}

export async function shareExhibitionPassport(token: string, galleryId: string): Promise<{ token: string; sharePath: string }> {
  const response = await apiFetch(apiUrl(`/api/exhibition-passports/${encodeURIComponent(galleryId)}/share`), {
    method: 'POST',
    headers: authHeaders(token),
  });
  return readOrThrow(response, 'Failed to share exhibition souvenir');
}

export async function getExhibitionSouvenir(publicToken: string): Promise<ExhibitionSouvenir> {
  const response = await apiFetch(apiUrl(`/api/exhibition-souvenirs/${encodeURIComponent(publicToken)}`));
  return readOrThrow(response, 'Failed to load exhibition souvenir');
}

export async function listRecentExhibitionSouvenirs(limit = 6): Promise<ExhibitionSouvenir[]> {
  const response = await apiFetch(apiUrl(`/api/exhibition-souvenirs?limit=${encodeURIComponent(String(limit))}`));
  return readOrThrow(response, 'Failed to load recent exhibition souvenirs');
}
