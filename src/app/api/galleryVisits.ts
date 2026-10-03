import { loadAuth } from './auth';
import { apiUrl, authHeaders } from './base';
import { apiFetch } from './request';

export type GalleryVisitPayload = {
  visitorId: string;
  sessionId: string;
  mode: '2d' | '3d';
  activeSeconds: number;
  itemDwellSeconds: Record<string, number>;
};

export async function recordGalleryVisit(galleryId: string, payload: GalleryVisitPayload, shareToken?: string, keepalive = false) {
  const { token } = loadAuth();
  const response = await apiFetch(apiUrl(`/api/galleries/${encodeURIComponent(galleryId)}/visits`), {
    method: 'POST',
    headers: {
      ...(token ? authHeaders(token) : { 'Content-Type': 'application/json' }),
      ...(shareToken ? { 'x-gallery-share-token': shareToken } : {}),
    },
    body: JSON.stringify(payload),
    keepalive,
  });
  if (!response.ok) throw new Error('Visit could not be recorded');
}
