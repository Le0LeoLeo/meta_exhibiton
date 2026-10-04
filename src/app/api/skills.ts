import { graduationRequest } from './graduation';
import { LONG_API_TIMEOUT_MS } from './request';

export type SkillEvidence = {
  id: string;
  kind: 'text' | 'link';
  label: string;
  source: string;
  occurredAt?: string;
  visibility: 'private' | 'teacher' | 'public';
  content?: string;
  url?: string;
};

export type SkillCardInput = {
  title: string;
  context: string;
  role: string;
  actions: string;
  outcome: string;
  reflection: string;
  summary: string;
  tags: string[];
  visibility: 'private' | 'teacher' | 'public';
  evidence: SkillEvidence[];
};

export type SkillCard = SkillCardInput & {
  id: string;
  projectId: string;
  status: 'draft' | 'submitted' | 'returned' | 'approved';
  revision: number;
  feedback?: string;
};

export type PublicSkill = Pick<SkillCard, 'id' | 'title' | 'context' | 'role' | 'actions' | 'outcome' | 'reflection' | 'summary' | 'tags' | 'status' | 'evidence'>;

export type SkillSuggestion = {
  id?: string;
  title: string;
  summary: string;
  tags: string[];
  evidenceIds: string[];
  reviewStatus?: 'ready' | 'needs_review';
  invalidEvidenceIds?: string[];
  reviewReason?: string | null;
};

export type SkillSuggestionResult = {
  status: 'ready' | 'fallback';
  runId?: string;
  inputRevision?: number;
  provider?: string;
  model?: string;
  suggestions: SkillSuggestion[];
  questions: { question: string; missingField?: string }[];
  evidenceAssessment?: { evidenceId: string; source: string; status: string; sourceState: 'text_provided' | 'link_only' }[];
};

export type SkillSuggestionDecision = 'adopted' | 'modified' | 'rejected';
export type SkillSuggestionRecord = SkillSuggestion & {
  id: string;
  decision: SkillSuggestionDecision | null;
  decisionTitle?: string | null;
  decisionSummary?: string | null;
  decisionTags?: string[] | null;
  reason?: string | null;
  checkedEvidenceIds?: string[];
  decidedAt?: string | null;
};
export type SkillSuggestionRun = {
  id: string;
  provider: string;
  model: string | null;
  status: 'ready' | 'fallback';
  inputRevision?: number;
  promptVersion?: string | null;
  warning?: string | null;
  evidenceAssessment?: NonNullable<SkillSuggestionResult['evidenceAssessment']>;
  createdAt: string;
  suggestions: SkillSuggestionRecord[];
  questions: SkillSuggestionResult['questions'];
};

export const listSkills = (projectId: string) =>
  graduationRequest<{ skills: SkillCard[] }>(`/projects/${encodeURIComponent(projectId)}/skills`);

export const createSkill = (projectId: string, input: SkillCardInput) =>
  graduationRequest<{ skill: SkillCard }>(`/projects/${encodeURIComponent(projectId)}/skills`, 'POST', input);

export const updateSkill = (skillId: string, input: SkillCardInput, expectedRevision: number) =>
  graduationRequest<{ skill: SkillCard }>(`/skills/${encodeURIComponent(skillId)}`, 'PATCH', { ...input, expectedRevision });

export const deleteSkill = (skillId: string, expectedRevision: number) =>
  graduationRequest<{ ok: true }>(`/skills/${encodeURIComponent(skillId)}`, 'DELETE', { expectedRevision });

export const submitSkill = (skillId: string, expectedRevision: number) =>
  graduationRequest<{ skill: SkillCard }>(`/skills/${encodeURIComponent(skillId)}/submit`, 'POST', { expectedRevision });

export const reviewSkill = (skillId: string, decision: 'approved' | 'returned', feedback: string, expectedRevision: number) =>
  graduationRequest<{ skill: SkillCard }>(`/skills/${encodeURIComponent(skillId)}/review`, 'POST', { decision, feedback, expectedRevision });

export const suggestSkill = (projectId: string, skillId: string, expectedRevision: number, selectedEvidenceIds: string[], options?: { signal?: AbortSignal }) =>
  graduationRequest<SkillSuggestionResult>(`/projects/${encodeURIComponent(projectId)}/skills/suggest`, 'POST',
    { skillId, expectedRevision, selectedEvidenceIds }, { ...options, timeoutMs: LONG_API_TIMEOUT_MS });

export const listSkillSuggestions = (skillId: string) =>
  graduationRequest<{ runs: SkillSuggestionRun[] }>(`/skills/${encodeURIComponent(skillId)}/suggestions`);

export type SkillDecisionInput = {
  expectedRevision: number;
  inputRevision: number;
  reason: string;
  checkedEvidenceIds: string[];
};

export const decideSkillSuggestion = (skillId: string, suggestionId: string, decision: SkillSuggestionDecision,
  input: SkillDecisionInput, content?: Pick<SkillSuggestion, 'title' | 'summary' | 'tags'>) =>
  graduationRequest<{ suggestion: SkillSuggestionRecord }>(`/skills/${encodeURIComponent(skillId)}/suggestions/${encodeURIComponent(suggestionId)}/decision`, 'POST', { decision, ...content, ...input });
