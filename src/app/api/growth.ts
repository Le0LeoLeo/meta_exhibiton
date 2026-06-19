import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';

export type GrowthChild = {
  id: string;
  ownerId: string;
  name: string;
  birthday: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GrowthExhibit = {
  id: string;
  ownerId: string;
  childId: string;
  title: string;
  templateId: string;
  introStory: string;
  isPrivate: boolean;
  shareRole?: 'viewer' | 'editor';
  shareExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  child: {
    name: string;
    birthday: string;
  };
};

export type GrowthAsset = {
  id: string;
  ownerId: string;
  exhibitId: string;
  type: 'photo' | 'video' | 'audio' | 'text';
  title: string;
  contentUrl: string | null;
  note: string | null;
  capturedAt: string | null;
  createdAt: string;
};

export type GrowthComment = {
  id: string;
  ownerId: string;
  exhibitId: string;
  userName: string;
  content: string;
  createdAt: string;
};

export type GrowthRecommendation = {
  exhibitId: string;
  route: string;
  score: number;
  reason: string;
  childName: string;
  title: string;
  introStory: string;
  templateId: string;
  childBirthday: string;
  assetCount: number;
  commentCount: number;
  latestActivityAt: string | null;
};

export async function createGrowthChild(
  token: string,
  payload: { name: string; birthday: string; avatarUrl?: string },
): Promise<{ child: GrowthChild }> {
  const res = await fetch(apiUrl('/api/growth/children'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立孩子資料失敗');
  return data as { child: GrowthChild };
}

export async function getMyGrowthChildren(token: string): Promise<{ children: GrowthChild[] }> {
  const res = await fetch(apiUrl('/api/growth/children/mine'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入孩子列表失敗');
  return data as { children: GrowthChild[] };
}

export async function createGrowthExhibit(
  token: string,
  payload: { childId: string; title: string; templateId: string; introStory: string; isPrivate?: boolean },
): Promise<{ exhibit: Omit<GrowthExhibit, 'child'> }> {
  const res = await fetch(apiUrl('/api/growth/exhibits'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立成長展館失敗');
  return data as { exhibit: Omit<GrowthExhibit, 'child'> };
}

export async function getMyGrowthExhibits(token: string): Promise<{ exhibits: GrowthExhibit[] }> {
  const res = await fetch(apiUrl('/api/growth/exhibits/mine'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入成長展館列表失敗');
  return data as { exhibits: GrowthExhibit[] };
}

export async function getMyGrowthRecommendations(
  token: string,
  params?: { mode?: string; interest?: string; depth?: string },
): Promise<{ route: GrowthRecommendation | null; routes: GrowthRecommendation[]; preferences?: { mode: string; interest: string; depth: string } }> {
  const query = new URLSearchParams();
  if (params?.mode) query.set('mode', params.mode);
  if (params?.interest) query.set('interest', params.interest);
  if (params?.depth) query.set('depth', params.depth);
  const res = await fetch(apiUrl(`/api/growth/recommendations/mine${query.toString() ? `?${query.toString()}` : ''}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入推薦路線失敗');
  return data as { route: GrowthRecommendation | null; routes: GrowthRecommendation[] };
}

export async function createGrowthAsset(
  token: string,
  payload: {
    exhibitId: string;
    type: GrowthAsset['type'];
    title: string;
    contentUrl?: string;
    note?: string;
    capturedAt?: string;
  },
): Promise<{ asset: GrowthAsset }> {
  const res = await fetch(apiUrl('/api/growth/assets'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '新增成長素材失敗');
  return data as { asset: GrowthAsset };
}

export async function uploadGrowthAsset(
  token: string,
  payload: {
    exhibitId: string;
    title: string;
    note?: string;
    capturedAt?: string;
    fileName: string;
    mimeType: string;
    dataBase64: string;
  },
): Promise<{ asset: GrowthAsset }> {
  const res = await fetch(apiUrl('/api/growth/assets/upload'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '上傳成長素材失敗');
  return data as { asset: GrowthAsset };
}

export async function getGrowthAssetsByExhibit(token: string, exhibitId: string): Promise<{ assets: GrowthAsset[] }> {
  const res = await fetch(apiUrl(`/api/growth/exhibits/${encodeURIComponent(exhibitId)}/assets`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入成長素材失敗');
  return data as { assets: GrowthAsset[] };
}

export async function createGrowthComment(
  token: string,
  payload: { exhibitId: string; userName: string; content: string },
): Promise<{ comment: GrowthComment }> {
  const res = await fetch(apiUrl('/api/growth/comments'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '新增留言失敗');
  return data as { comment: GrowthComment };
}

export async function getGrowthCommentsByExhibit(token: string, exhibitId: string): Promise<{ comments: GrowthComment[] }> {
  const res = await fetch(apiUrl(`/api/growth/exhibits/${encodeURIComponent(exhibitId)}/comments`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入留言失敗');
  return data as { comments: GrowthComment[] };
}

export async function createGrowthShareLink(
  token: string,
  exhibitId: string,
  payload?: { role?: 'viewer' | 'editor'; expiresInHours?: number },
): Promise<{ share: { url: string; token: string; role: 'viewer' | 'editor'; expiresAt: string | null } }> {
  const res = await fetch(apiUrl(`/api/growth/exhibits/${encodeURIComponent(exhibitId)}/share-link`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立分享連結失敗');
  return data as { share: { url: string; token: string; role: 'viewer' | 'editor'; expiresAt: string | null } };
}

export async function getSharedGrowthExhibit(token: string): Promise<{ exhibit: GrowthExhibit; access: { viaShare: true; role: 'viewer' | 'editor' } }> {
  const res = await fetch(apiUrl(`/api/share/growth/exhibits/${encodeURIComponent(token)}`));
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入分享展館失敗');
  return data as { exhibit: GrowthExhibit; access: { viaShare: true; role: 'viewer' | 'editor' } };
}

export async function getSharedGrowthAssets(token: string): Promise<{ assets: GrowthAsset[] }> {
  const res = await fetch(apiUrl(`/api/share/growth/exhibits/${encodeURIComponent(token)}/assets`));
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入分享素材失敗');
  return data as { assets: GrowthAsset[] };
}

export async function getSharedGrowthComments(token: string): Promise<{ comments: GrowthComment[] }> {
  const res = await fetch(apiUrl(`/api/share/growth/exhibits/${encodeURIComponent(token)}/comments`));
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入分享留言失敗');
  return data as { comments: GrowthComment[] };
}

export async function postSharedGrowthComment(
  token: string,
  payload: { userName: string; content: string },
): Promise<{ comment: GrowthComment }> {
  const res = await fetch(apiUrl(`/api/share/growth/exhibits/${encodeURIComponent(token)}/comments`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '留言失敗');
  return data as { comment: GrowthComment };
}
