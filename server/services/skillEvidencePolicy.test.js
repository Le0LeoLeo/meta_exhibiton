import { describe, expect, it } from 'vitest';
import { assessSuggestionEvidence, evidenceFingerprint, evidenceForAi, evidenceSourceState, selectSkillEvidence } from './skillEvidencePolicy.js';

describe('skill evidence policy', () => {
  const saved = [
    { id: 'text-1', kind: 'text', label: 'Journal', source: 'Student log', occurredAt: null, visibility: 'private', content: 'I planned the activity.', url: '' },
    { id: 'link-1', kind: 'link', label: 'School page', source: 'School site', occurredAt: null, visibility: 'private', content: '', url: 'https://school.test/?token=secret' },
  ];

  it('accepts only IDs from this saved card, including a deliberately selected private item', () => {
    expect(selectSkillEvidence(saved, ['text-1'])).toEqual([saved[0]]);
    expect(() => selectSkillEvidence(saved, ['another-card-evidence'])).toThrow(expect.objectContaining({ code: 'INVALID_EVIDENCE' }));
    expect(() => selectSkillEvidence(saved, ['text-1', 'text-1'])).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('marks provided text and unread links distinctly and excludes raw URLs from AI input', () => {
    const selected = selectSkillEvidence(saved, ['text-1', 'link-1']);
    expect(selected.map(evidenceSourceState)).toEqual(['text_provided', 'link_only']);
    expect(evidenceForAi(selected)).toEqual([
      { id: 'text-1', kind: 'text', label: 'Journal', source: 'Student log', occurredAt: null, visibility: 'private', content: 'I planned the activity.' },
      { id: 'link-1', kind: 'link', label: 'School page', source: 'School site', occurredAt: null, visibility: 'private', content: '' },
    ]);
    expect(JSON.stringify(evidenceForAi(selected))).not.toContain('secret');
  });

  it('retains unsupported IDs and explains why the suggestion needs review', () => {
    expect(assessSuggestionEvidence([{ title: 'Claim', evidenceIds: ['text-1', 'invented'] }], [saved[0]])[0]).toMatchObject({
      evidenceIds: ['text-1', 'invented'], reviewStatus: 'needs_review', invalidEvidenceIds: ['invented'],
      reviewReason: expect.stringContaining('invented'),
    });
  });

  it('flags citations to unread links and claims while evidence is unresolved', () => {
    const suggestion = { title: 'Claim', evidenceIds: ['link-1'] };
    expect(assessSuggestionEvidence([suggestion], [saved[1]])[0]).toMatchObject({
      reviewStatus: 'needs_review', reviewReason: expect.stringContaining('link-only'), invalidEvidenceIds: [],
    });
    expect(assessSuggestionEvidence([{ ...suggestion, evidenceIds: ['text-1'] }], [saved[0]], { hasEvidenceQuestion: true })[0]).toMatchObject({
      reviewStatus: 'needs_review', reviewReason: expect.stringContaining('unresolved'),
    });
  });

  it('fingerprints saved link changes without storing or sending the URL itself', () => {
    const selected = selectSkillEvidence(saved, ['link-1']);
    expect(evidenceFingerprint(selected)).not.toBe(evidenceFingerprint([{ ...selected[0], url: 'https://school.test/?token=changed' }]));
    expect(evidenceFingerprint(saved)).toBe(evidenceFingerprint([...saved].reverse()));
  });
});
