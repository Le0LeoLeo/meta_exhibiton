import { apiUrl, authHeaders, parseJsonSafe } from './base';
import { apiFetch, LONG_API_TIMEOUT_MS } from './request';
import type { QuickExhibitionDraft, QuickExhibitionLanguage, QuickExhibitionPatch } from '@/app/features/quick-exhibition/types';

export class QuickExhibitionError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly galleryId?: string) {
    super(message);
    this.name = 'QuickExhibitionError';
  }
}

async function request(
  token: string,
  draftId: string,
  method: string,
  suffix = '',
  body?: unknown,
): Promise<QuickExhibitionDraft> {
  const response = await apiFetch(apiUrl(`/api/quick-exhibitions/${encodeURIComponent(draftId)}${suffix}`), {
    method,
    headers: authHeaders(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new QuickExhibitionError(data?.code ?? 'QUICK_EXHIBITION_FAILED', response.status, data?.message ?? 'Unable to complete the exhibition.', typeof data?.galleryId === 'string' ? data.galleryId : undefined);
  }
  if (!data || typeof data.draftId !== 'string' || !Number.isInteger(data.revision) || !Array.isArray(data.input?.assets)) {
    throw new QuickExhibitionError('INVALID_RESPONSE', 502, 'Invalid exhibition response.');
  }
  return data as QuickExhibitionDraft;
}

export function createQuickExhibition(token: string, draftId: string, input: { title?: string; language: QuickExhibitionLanguage }) {
  return request(token, draftId, 'PUT', '', input);
}

export function getQuickExhibition(token: string, draftId: string) {
  return request(token, draftId, 'GET');
}

export function patchQuickExhibition(token: string, draftId: string, patch: QuickExhibitionPatch) {
  return request(token, draftId, 'PATCH', '', patch);
}

export function buildQuickExhibition(token: string, draftId: string, input: { requestId: string; expectedRevision: number }) {
  return request(token, draftId, 'POST', '/build', input);
}

export function applyQuickExhibition(token: string, draftId: string, input: { requestId: string; expectedRevision: number }) {
  return request(token, draftId, 'POST', '/apply', input);
}

export function discardQuickExhibition(token: string, draftId: string, input: { requestId: string; expectedRevision: number }) {
  return request(token, draftId, 'POST', '/discard', input);
}
