import { apiUrl, parseJsonSafe } from './base';
import { apiFetch, LONG_API_TIMEOUT_MS } from './request';
import { loadAuth } from './auth';
import type { PublicSkill } from './skills';

export type GraduationClass = {
  id: string; ownerId: string; title: string; description: string;
  deadline: string | null; createdAt: string; role: 'teacher' | 'student'; inviteToken?: string;
};
export type ProjectInput = {
  title: string; researchQuestion: string; concept: string; process: string;
  outcome: string; team: string; supervisor: string; galleryId?: string | null;
};
export type GraduationProject = ProjectInput & {
  id: string; classId: string; ownerId: string; authorName: string;
  status: 'draft' | 'submitted' | 'returned' | 'approved'; revision: number;
  feedback: string; createdAt: string; updatedAt: string;
};
export type GraduationReview = {
  id: string; projectId: string; authorName: string; role: 'teacher' | 'student';
  visibility: 'public' | 'private'; content: string; createdAt: string;
};
export type PublicProject = ProjectInput & {
  id: string; authorName: string; reviews?: GraduationReview[]; skills?: PublicSkill[]; withdrawnAt?: string | null;
};
export type GraduationRelease = {
  id: string; classId: string; version: number; token: string; title: string;
  description: string; createdAt: string; projects: PublicProject[]; groups?: CurationGroup[]; withdrawnAt?: string | null;
};
export type CurationGroup = { title: string; rationale: string; guide?: string; projectIds: string[] };
export type CurationPlan = { revision: number; groups: CurationGroup[]; projectRevisions: Record<string, number>; source: 'ai' | 'rules' | 'manual'; warnings: string[] };
export type ClassDetail = { class: GraduationClass; projects: GraduationProject[]; reviews: GraduationReview[]; members?: { name: string; status: GraduationProject['status'] | null }[] };
export type GraduationQuestion = { id: string; projectId: string; authorName: string; content: string; createdAt: string;
  reply: string; replyName: string; replyRole: 'teacher' | 'student' | ''; repliedAt: string | null; releaseToken?: string };
export type CurationEvaluation = { planRevision: number; baselineMinutes: number; actualMinutes: number; quality: number; notes: string; createdAt: string };

export async function graduationRequest<T>(path: string, method = 'GET', body?: unknown,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const token = loadAuth().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await apiFetch(apiUrl(`/api/graduation${path}`), {
    method, headers, signal: options.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, { timeoutMs: options.timeoutMs });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw Object.assign(new Error(data?.message || 'Unable to complete this request.'), {
      status: response.status, code: data?.code,
    });
  }
  if (!data || typeof data !== 'object') throw new Error('Invalid graduation response');
  return data as T;
}

export function suggestGraduationCuration(classId: string, language: string, options?: { signal?: AbortSignal }) {
  return graduationRequest<{ plan: CurationPlan }>(`/classes/${encodeURIComponent(classId)}/curation/suggest`, 'POST',
    { language }, { ...options, timeoutMs: LONG_API_TIMEOUT_MS });
}

export function submitGraduationProject(id: string, expectedRevision: number, skillCards: { id: string; revision: number }[]) {
  return graduationRequest<{ project: GraduationProject }>(`/projects/${encodeURIComponent(id)}/submit-with-skills`, 'POST', { expectedRevision, skillCards });
}

export function reviewGraduationProject(id: string, input: {
  expectedRevision: number; decision: 'approved' | 'returned'; feedback: string; skillCards: { id: string; revision: number }[];
}) {
  return graduationRequest<{ project: GraduationProject }>(`/projects/${encodeURIComponent(id)}/review-with-skills`, 'POST', input);
}

export function exportGraduationData(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
