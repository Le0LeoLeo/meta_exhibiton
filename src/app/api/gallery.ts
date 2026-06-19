import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';

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
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GalleryDetail = GallerySummary & {
  sceneJson: string | null;
};

export type GalleryAdminSummary = {
  totalGalleries: number;
  publishedGalleries: number;
  totalItems: number;
  totalComments: number;
  totalVisitors: number;
  totalDwellSeconds: number;
  topGallery: GalleryAdminGallery | null;
};

export type GalleryAdminGallery = GallerySummary & {
  itemCount: number;
  commentCount: number;
  visitorCount: number;
  engagedCount: number;
  totalDwellSeconds: number;
  popularityScore: number;
  latestActivityAt: string;
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
  latestActivityAt: string;
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
};

export type GalleryUploadLink = {
  token: string;
  galleryId: string;
  itemId: string;
  canEditMetadata: boolean;
  expiresAt: string | null;
};

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
  const res = await fetch(apiUrl('/api/galleries/mine'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入展覽列表失敗');
  return data as { galleries: GallerySummary[] };
}

export async function getPublishedGalleries(): Promise<{ galleries: GallerySummary[] }> {
  const res = await fetch(apiUrl('/api/galleries/published'), {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入公開展覽列表失敗');
  return data as { galleries: GallerySummary[] };
}

export async function getPublishedGalleryById(id: string): Promise<{ gallery: GalleryDetail }> {
  const res = await fetch(apiUrl(`/api/galleries/published/${encodeURIComponent(id)}`));
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入公開展覽失敗');
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

export async function getGalleryAdminAnalytics(token: string): Promise<GalleryAdminAnalytics> {
  const res = await fetch(apiUrl('/api/galleries/admin/analytics'), {
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
  const res = await fetch(
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
  const res = await fetch(apiUrl('/api/share/galleries'), {
    headers: { 'x-gallery-share-token': shareToken },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, 'Failed to load shared gallery');
  return data as { gallery: GalleryDetail; access: GalleryShareAccess };
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

export async function updateSharedGallery(
  shareToken: string,
  payload: Partial<Pick<GalleryDetail, 'title' | 'description' | 'templateTitle' | 'templateImage' | 'category' | 'sceneJson'>>,
): Promise<{ gallery: GalleryDetail }> {
  const res = await fetch(apiUrl('/api/share/galleries'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-gallery-share-token': shareToken,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, 'Failed to update shared gallery');
  return data as { gallery: GalleryDetail };
}

export async function createGalleryShareLink(
  token: string,
  id: string,
  payload: { role: 'viewer' | 'editor'; expiresInHours?: number },
): Promise<{ share: GalleryShareLink }> {
  const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}/share-link`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立分享連結失敗');
  return data as { share: GalleryShareLink };
}

export async function publishGalleryById(
  token: string,
  id: string,
  competitionEntry?: { competitionId: string; statement: string; assets?: Array<{ name: string; url: string }> },
): Promise<{ gallery: GalleryDetail }> {
  const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}/publish`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ competitionEntry }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '發佈展覽失敗');
  return data as { gallery: GalleryDetail };
}

export async function createGalleryUploadLink(
  token: string,
  id: string,
  payload: { itemId: string; canEditMetadata?: boolean; expiresInHours?: number },
): Promise<{ uploadLink: { url: string; token: string; galleryId: string; itemId: string; canEditMetadata: boolean; expiresAt: string | null } }> {
  const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}/upload-link`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立上傳連結失敗');
  return data as { uploadLink: { url: string; token: string; galleryId: string; itemId: string; canEditMetadata: boolean; expiresAt: string | null } };
}

export async function getGalleryUploadLink(token: string): Promise<{ uploadLink: GalleryUploadLink; gallery: GalleryDetail; item?: unknown }> {
  const res = await fetch(apiUrl(`/api/upload-links/${encodeURIComponent(token)}`));
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入上傳連結失敗');
  return data as { uploadLink: GalleryUploadLink; gallery: GalleryDetail; item?: unknown };
}

export async function saveGalleryUploadLink(
  uploadToken: string,
  payload: {
    title?: string;
    artist?: string;
    description?: string;
    externalUrl?: string;
    content?: string;
    fileName?: string;
    fileMimeType?: string;
    videoThumbnailUrl?: string;
  },
): Promise<{ gallery: GalleryDetail | null; item: unknown }> {
  const res = await fetch(apiUrl(`/api/upload-links/${encodeURIComponent(uploadToken)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '儲存上傳內容失敗');
  return data as { gallery: GalleryDetail | null; item: unknown };
}

export async function revokeGalleryUploadLink(token: string, uploadToken: string): Promise<{ ok: true }> {
  const res = await fetch(apiUrl(`/api/upload-links/${encodeURIComponent(uploadToken)}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '撤銷上傳連結失敗');
  return data as { ok: true };
}

export async function unpublishGalleryById(token: string, id: string): Promise<{ gallery: GalleryDetail }> {
  const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(id)}/publish`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '取消發佈展覽失敗');
  return data as { gallery: GalleryDetail };
}
