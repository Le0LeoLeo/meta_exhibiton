import { createHash } from 'node:crypto';

const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };

export const SKILL_PROMPT_VERSION = 'skill-reflection-v4';

export function selectSkillEvidence(savedEvidence, selectedEvidenceIds) {
  if (!Array.isArray(selectedEvidenceIds)) fail(400, 'INVALID_INPUT', 'Select the evidence to include in the AI request');
  if (selectedEvidenceIds.some((id) => typeof id !== 'string' || !id.trim()) || new Set(selectedEvidenceIds).size !== selectedEvidenceIds.length) {
    fail(400, 'INVALID_INPUT', 'Selected evidence IDs must be unique non-empty strings');
  }
  const byId = new Map(savedEvidence.map((item) => [item.id, item]));
  const missing = selectedEvidenceIds.filter((id) => !byId.has(id));
  if (missing.length) fail(400, 'INVALID_EVIDENCE', 'One or more selected evidence items do not belong to this card');
  return selectedEvidenceIds.map((id) => byId.get(id));
}

export function evidenceSourceState(evidence) {
  return evidence.kind === 'link' ? 'link_only' : evidence.content?.trim() ? 'text_provided' : 'student_account';
}

export function evidenceForAi(evidence) {
  return evidence.map(({ id, kind, label, source, occurredAt, visibility, content }) => ({
    id, kind, label, source, occurredAt: occurredAt || null, visibility,
    content: kind === 'text' ? content || '' : '',
  }));
}

export function evidenceFingerprint(evidence) {
  const stable = evidence.map((item) => ({ id: item.id, kind: item.kind, label: item.label, source: item.source,
    occurredAt: item.occurredAt || null, visibility: item.visibility, content: item.content || '', url: item.url || '' }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function assessSuggestionEvidence(suggestions, selectedEvidence, { hasEvidenceQuestion = false } = {}) {
  const selectedById = new Map(selectedEvidence.map((item) => [typeof item === 'string' ? item : item.id, item]));
  return suggestions.map((suggestion) => {
    const invalidEvidenceIds = [...new Set(suggestion.evidenceIds.filter((id) => !selectedById.has(id)))];
    const citedLinkIds = [...new Set(suggestion.evidenceIds.filter((id) => selectedById.has(id)
      && typeof selectedById.get(id) === 'object' && evidenceSourceState(selectedById.get(id)) === 'link_only'))];
    const reasons = [];
    if (invalidEvidenceIds.length) reasons.push(`The model cited evidence that was not selected for this run: ${invalidEvidenceIds.join(', ')}`);
    if (citedLinkIds.length) reasons.push(`The suggestion cites link-only sources whose contents were not read: ${citedLinkIds.join(', ')}`);
    if (hasEvidenceQuestion) reasons.push('The model identified evidence as unresolved; review the claim before relying on it');
    const reviewReason = reasons.length ? reasons.join('. ') : null;
    return {
      ...suggestion,
      reviewStatus: reviewReason ? 'needs_review' : 'ready',
      invalidEvidenceIds,
      reviewReason,
    };
  });
}

export function sameSkillAiInput(current, runInput) {
  const relevant = (value) => JSON.stringify({
    context: value.context || '', role: value.role || '', actions: value.actions || '', outcome: value.outcome || '', reflection: value.reflection || '',
    evidence: (value.evidence || []).map((e) => ({ id: e.id, kind: e.kind, label: e.label, source: e.source, occurredAt: e.occurredAt || null,
      visibility: e.visibility, content: e.content || '' })).sort((a, b) => a.id.localeCompare(b.id)),
  });
  return relevant(current) === relevant(runInput);
}
