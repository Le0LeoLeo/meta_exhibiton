import { apiUrl, parseJsonSafe } from './base';
import { apiFetch, LONG_API_TIMEOUT_MS } from './request';
import { loadAuth } from './auth';

export type CvEvidence = { id?: string; kind: 'text' | 'link'; label: string; source: string;
  visibility: 'private' | 'public'; occurredAt?: string; content: string; url: string };
export type CvCardInput = { title: string; context: string; role: string; actions: string; outcome: string;
  reflection: string; summary: string; tags: string[]; visibility: 'private' | 'public'; evidence: CvEvidence[] };
export type CvCard = CvCardInput & { id: string; revision: number; createdAt: string; updatedAt: string };
export type CvProfileInput = { headline: string; about: string; galleryId: string | null };
export type CvProfile = CvProfileInput & { name: string; publishedAt: string | null; token: string | null };
export type CvMine = { profile: CvProfile; cards: CvCard[] };
export type CvPublic = { profile: CvProfileInput & { name: string; cards: CvCard[] }; publishedAt: string };
export type CvSuggestionResult = { status: 'ready' | 'fallback'; warning?: string; runId: string;
  suggestions: { title: string; summary: string; tags: string[]; evidenceIds: string[] }[];
  questions: { question: string; missingField: string }[] };
export type CvSuggestionRun = { id: string; input: CvCard; result: CvSuggestionResult;
  decisions: Record<number, 'adopted' | 'modified' | 'rejected'>; createdAt: string };

export async function cvRequest<T>(path: string, method = 'GET', body?: unknown,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const token = loadAuth().token;
  const response = await apiFetch(apiUrl(`/api/cv${path}`), {
    method,
    signal: options.signal,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, { timeoutMs: options.timeoutMs });
  const data = await parseJsonSafe(response);
  if (!response.ok) throw Object.assign(new Error(data?.message || 'CV request failed'), { status: response.status, code: data?.code });
  return data as T;
}

export function suggestCvCard(cardId: string, options?: { signal?: AbortSignal }) {
  return cvRequest<CvSuggestionResult>(`/cards/${encodeURIComponent(cardId)}/suggest`, 'POST', {},
    { ...options, timeoutMs: LONG_API_TIMEOUT_MS });
}
