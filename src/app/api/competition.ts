import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch } from './request';

export type Competition = {
  id: string;
  hostGalleryId: string;
  title: string;
  description: string;
  rules: string;
  coverImage: string | null;
  isPublic: boolean;
  registrationDeadline: string;
  votingDeadline: string | null;
  status: 'draft' | 'open' | 'closed' | 'voting' | 'judging' | 'completed';
  createdBy: string;
  createdByName?: string | null;
  hostGallery?: {
    title: string;
    templateImage: string;
    category: string;
  };
  submissionFields?: Array<{
    id: string;
    label: string;
    placeholder?: string;
    accept?: string;
    multiple?: boolean;
    type: 'text' | 'textarea' | 'file';
    required: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type CompetitionEntry = {
  id: string;
  competitionId: string;
  galleryId: string;
  galleryOwnerId: string;
  statement: string;
  assets: Array<{ name: string; url: string }>;
  submission?: Record<string, string | string[]>;
  status: 'pending' | 'approved' | 'rejected';
  rank: number | null;
  voteCount: number;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  ownerName?: string | null;
  competitionTitle?: string;
  competitionStatus?: string;
  competitionRegistrationDeadline?: string;
};

export type CompetitionPublishEntry = {
  competitionId: string;
  submission: Record<string, string | string[]>;
  assets?: Array<{
    name: string;
    url: string;
  }>;
};

export async function getCompetitions(includePrivate = false, adminSecret?: string): Promise<{ competitions: Competition[] }> {
  const qs = includePrivate ? '?includePrivate=true' : '';
  const headers: Record<string, string> = {};
  if (adminSecret) headers['x-admin-secret'] = adminSecret;
  const res = await apiFetch(apiUrl(`/api/competitions${qs}`), { headers });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入比賽列表失敗');
  return data as { competitions: Competition[] };
}

export async function getCompetitionById(id: string, adminSecret?: string): Promise<{ competition: Competition; entries: CompetitionEntry[] }> {
  const headers: Record<string, string> = {};
  if (adminSecret) headers['x-admin-secret'] = adminSecret;
  const res = await apiFetch(apiUrl(`/api/competitions/${encodeURIComponent(id)}`), { headers });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入比賽失敗');
  return data as { competition: Competition; entries: CompetitionEntry[] };
}

export async function createCompetition(token: string, payload: {
  hostGalleryId: string;
  title: string;
  description: string;
  rules: string;
  coverImage?: string | null;
  isPublic?: boolean;
  registrationDeadline: string;
  votingDeadline?: string | null;
  submissionFields?: Array<{
    id: string;
    label: string;
    placeholder?: string;
    accept?: string;
    multiple?: boolean;
    type: 'text' | 'textarea' | 'file';
    required: boolean;
  }>;
  status?: Competition['status'];
}): Promise<{ competition: Competition }> {
  const res = await apiFetch(apiUrl('/api/competitions'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '建立比賽失敗');
  return data as { competition: Competition };
}

export async function updateCompetition(token: string, id: string, payload: Partial<{
  title: string;
  description: string;
  rules: string;
  coverImage: string | null;
  isPublic: boolean;
  registrationDeadline: string;
  votingDeadline: string | null;
  submissionFields?: Array<{
    id: string;
    label: string;
    placeholder?: string;
    accept?: string;
    multiple?: boolean;
    type: 'text' | 'textarea' | 'file';
    required: boolean;
  }>;
  status: Competition['status'];
}>): Promise<{ competition: Competition }> {
  const res = await apiFetch(apiUrl(`/api/competitions/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '更新比賽失敗');
  return data as { competition: Competition };
}

export async function createCompetitionEntry(token: string, payload: CompetitionPublishEntry): Promise<{ entry: CompetitionEntry }> {
  const res = await apiFetch(apiUrl('/api/competitions/entries'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : '報名比賽失敗';
    throw errorFromResponse(data, message);
  }
  return data as { entry: CompetitionEntry };
}

export async function getMyCompetitionEntries(token: string): Promise<{ entries: CompetitionEntry[] }> {
  const res = await apiFetch(apiUrl('/api/competition-entries/mine'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入參賽資料失敗');
  return data as { entries: CompetitionEntry[] };
}

export async function getMyHostedCompetitions(token: string): Promise<{ competitions: Competition[] }> {
  const res = await apiFetch(apiUrl('/api/competitions/hosted/mine'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入主辦比賽資料失敗');
  return data as { competitions: Competition[] };
}

export async function deleteCompetitionEntry(token: string, competitionId: string, entryId: string): Promise<{ ok: true }> {
  const res = await apiFetch(apiUrl(`/api/competitions/${encodeURIComponent(competitionId)}/entries/${encodeURIComponent(entryId)}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '刪除投稿失敗');
  return data as { ok: true };
}

export async function voteCompetitionEntry(token: string, competitionId: string, entryId: string): Promise<{ entry: CompetitionEntry }> {
  const res = await apiFetch(apiUrl(`/api/competitions/${encodeURIComponent(competitionId)}/entries/${encodeURIComponent(entryId)}/vote`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '投票失敗');
  return data as { entry: CompetitionEntry };
}

export async function getAdminCompetitionEntries(token: string, competitionId: string, adminSecret?: string): Promise<{ entries: CompetitionEntry[] }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (adminSecret?.trim()) headers['x-admin-secret'] = adminSecret.trim();
  const res = await apiFetch(apiUrl(`/api/admin/competitions/${encodeURIComponent(competitionId)}/entries`), {
    headers,
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '載入比賽後台資料失敗');
  return data as { entries: CompetitionEntry[] };
}

export async function reviewCompetitionEntry(token: string, entryId: string, payload: { status?: CompetitionEntry['status']; rank?: number | null }): Promise<{ entry: CompetitionEntry }> {
  const res = await apiFetch(apiUrl(`/api/admin/competition-entries/${encodeURIComponent(entryId)}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '更新參賽資料失敗');
  return data as { entry: CompetitionEntry };
}
