import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch } from './request';

export type GallerySummary = {
  id: string;
  ownerId: string;
  ownerName?: string | null;
  title: string;
  description: string;
  templateTitle: string;
  templateImage: string;
  category: string;
  shareRole?: 'viewer' | 'editor';
  shareExpiresAt?: string | null;
  isPublished?: boolean;
  isBox?: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
  quickDraftId?: string | null;
  reviewAccess?: boolean;
};

export type GalleryDetail = GallerySummary & {
  sceneJson: string | null;
};

export class GalleryConflictError extends Error {
  constructor() {
    super('This exhibition has changed. Your local changes have been preserved.');
    this.name = 'GalleryConflictError';
  }
}

type GalleryUpdate = Partial<Pick<GalleryDetail, 'title' | 'description' | 'templateTitle' | 'templateImage' | 'category' | 'sceneJson'>> & { expectedRevision: number };

export type GalleryAdminSummary = {
  totalGalleries: number;
  publishedGalleries: number;
  totalItems: number;
  totalComments: number;
  totalVisitors: number;
  totalVisits: number;
  averageVisitSeconds: number;
  totalDwellSeconds: number;
  topGallery: GalleryAdminGallery | null;
};

export type GalleryAdminGallery = GallerySummary & {
  itemCount: number;
  commentCount: number;
  visitorCount: number;
  visitCount: number;
  engagedCount: number;
  totalDwellSeconds: number;
  popularityScore: number;
  latestActivityAt: string | null;
};

export type GalleryAdminItem = {
  galleryId: string;
  galleryTitle: string;
  itemId: string;
  title: string;
  artist: string | null;
  type: string;
  commentCount: number;
  visitorCount: number;
  engagedCount: number;
  dwellSeconds: number;
  popularityScore: number;
  latestActivityAt: string | null;
};

export type GalleryAdminComment = {
  id: string;
  galleryId: string;
  galleryTitle: string;
  itemId: string;
  itemTitle: string;
  userName: string;
  content: string;
  createdAt: string;
};

export type GalleryAdminAnalytics = {
  summary: GalleryAdminSummary;
  galleries: GalleryAdminGallery[];
  items: GalleryAdminItem[];
  comments: GalleryAdminComment[];
  availableGalleries: Array<{ id: string; title: string }>;
  daily: Array<{ date: string; visitCount: number; visitorCount: number; totalDwellSeconds: number }>;
  period: { range: GalleryAnalyticsRange; from: string; to: string; timeZone: 'Asia/Hong_Kong' };
  measurementStartedAt: string | null;
};

export type GalleryAnalyticsRange = '7d' | '30d' | '90d';

export type GalleryShareAccess = {
  viaShare: true;
  role: 'viewer' | 'editor';
};

export type GalleryShareLink = {
  url: string;
  token: string;
  role: 'viewer' | 'editor';
  expiresAt: string | null;
};

export async function getMyGalleries(token: string): Promise<{ galleries: GallerySummary[] }> {
  const res = await apiFetch(apiUrl('/api/galleries/mine'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入展覽列表失敗');
  return data as { galleries: GallerySummary[] };
}

export async function getPublishedGalleries(options: { after?: string; limit?: number } = {}): Promise<{ galleries: GallerySummary[]; nextCursor?: string | null }> {
  const query = new URLSearchParams();
  if (options.after) query.set('after', options.after);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  const res = await apiFetch(apiUrl(`/api/galleries/published${query.size ? `?${query}` : ''}`), {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入公開展覽列表失敗');
  return data as { galleries: GallerySummary[]; nextCursor?: string | null };
}

export async function getPublishedGalleryById(id: string): Promise<{ gallery: GalleryDetail }> {
  const res = await apiFetch(apiUrl(`/api/galleries/published/${encodeURIComponent(id)}`));
  const data = await parseJsonSafe(res);
  if (!res.ok) throw Object.assign(errorFromResponse(data, '載入公開展覽失敗'), { status: res.status });
  return data as { gallery: GalleryDetail };
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
  const res = await apiFetch(apiUrl('/api/galleries'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立展覽失敗');
  return data as { gallery: GalleryDetail };
}

export async function getGalleryById(token: string, id: string): Promise<{ gallery: GalleryDetail }> {
  const res = await apiFetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw Object.assign(errorFromResponse(data, '載入展覽內容失敗'), { status: res.status });
  return data as { gallery: GalleryDetail };
}

export async function getGalleryAdminAnalytics(token: string, options: { range?: GalleryAnalyticsRange; galleryId?: string } = {}): Promise<GalleryAdminAnalytics> {
  const query = new URLSearchParams({ range: options.range ?? '30d' });
  if (options.galleryId) query.set('galleryId', options.galleryId);
  const res = await apiFetch(apiUrl(`/api/galleries/admin/analytics?${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '無法載入展覽後台數據');
  return data as GalleryAdminAnalytics;
}

export async function deleteGalleryComment(
  token: string,
  payload: { galleryId: string; itemId: string; commentId: string },
): Promise<{ ok: true }> {
  const res = await apiFetch(
    apiUrl(`/api/galleries/${encodeURIComponent(payload.galleryId)}/items/${encodeURIComponent(payload.itemId)}/comments/${encodeURIComponent(payload.commentId)}`),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '無法刪除評論');
  return data as { ok: true };
}

export async function getSharedGallery(
  shareToken: string,
): Promise<{ gallery: GalleryDetail; access: GalleryShareAccess }> {
  const res = await apiFetch(apiUrl('/api/share/galleries'), {
    headers: { 'x-gallery-share-token': shareToken },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, 'Failed to load shared gallery');
  return data as { gallery: GalleryDetail; access: GalleryShareAccess };
}

export async function deleteGalleryById(token: string, id: string): Promise<{ ok: true }> {
  const res = await apiFetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}`), {
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
  payload: GalleryUpdate,
): Promise<{ gallery: GalleryDetail }> {
  const res = await apiFetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 409 && data?.code === 'GALLERY_CONFLICT') throw new GalleryConflictError();
  if (!res.ok) throw errorFromResponse(data, '儲存展覽失敗');
  return data as { gallery: GalleryDetail };
}

export async function updateSharedGallery(
  shareToken: string,
  payload: GalleryUpdate,
): Promise<{ gallery: GalleryDetail }> {
  const res = await apiFetch(apiUrl('/api/share/galleries'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-gallery-share-token': shareToken,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 409 && data?.code === 'GALLERY_CONFLICT') throw new GalleryConflictError();
  if (!res.ok) throw errorFromResponse(data, 'Failed to update shared gallery');
  return data as { gallery: GalleryDetail };
}

export async function createGalleryShareLink(
  token: string,
  id: string,
  payload: { role: 'viewer' | 'editor'; expiresInHours?: number },
): Promise<{ share: GalleryShareLink }> {
  const res = await apiFetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}/share-link`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立分享連結失敗');
  return data as { share: GalleryShareLink };
}

export async function publishGalleryById(token: string, id: string): Promise<{ gallery: GalleryDetail }> {
  const res = await apiFetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}/publish`), {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '發佈展覽失敗');
  return data as { gallery: GalleryDetail };
}

export async function unpublishGalleryById(token: string, id: string): Promise<{ gallery: GalleryDetail }> {
  const res = await apiFetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}/publish`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '取消發佈展覽失敗');
  return data as { gallery: GalleryDetail };
}
