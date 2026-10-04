import { afterEach, describe, expect, it, vi } from 'vitest';
import { suggestSkill } from './graduationSkillService.js';

afterEach(() => vi.unstubAllEnvs());

describe('graduation capability suggestions', () => {
  it('uses the configured chat completion path and retains unsupported evidence references for review', async () => {
    vi.stubEnv('QWEN_MODEL', 'qwen-test');
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      suggestions: [{ title: 'Facilitation', summary: 'Helped a group choose.', tags: ['communication'], evidenceIds: ['evidence-1', 'invented-id'] }],
      questions: [{ question: 'What changed after your action?', missingField: 'outcome' }],
    }) } }] });
    const result = await suggestSkill({ context: 'Workshop', role: 'Facilitator', actions: 'Asked questions', outcome: '', reflection: '', evidence: [
      { id: 'evidence-1', kind: 'text', label: 'Note', source: 'Workshop record', content: 'Led discussion', url: '' },
    ] }, { client: { chat: { completions: { create } } } });
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].model).toBe('qwen-test');
    expect(create.mock.calls[0][0].enable_thinking).toBe(false);
    expect(create.mock.calls[0][0].messages[0].content).toContain('concise first-person portfolio drafts');
    expect(result.promptVersion).toBe('skill-reflection-v4');
    expect(result.status).toBe('ready');
    expect(result.suggestions[0].evidenceIds).toEqual(['evidence-1', 'invented-id']);
    expect(result.warning).toBe('HUMAN_REVIEW_REQUIRED');
  });

  it('marks no-key guidance as fallback instead of presenting deterministic prompts as AI output', async () => {
    vi.stubEnv('QWEN_API_KEY', ''); vi.stubEnv('DASHSCOPE_API_KEY', '');
    const result = await suggestSkill({ context: '', role: '', actions: '', outcome: '', reflection: '', evidence: [] });
    expect(result.status).toBe('fallback');
    expect(result.warning).toBe('AI_UNAVAILABLE_NO_KEY');
    expect(result.provider).toBe('none');
    expect(result.questions.some((item) => item.missingField === 'evidence')).toBe(true);
  });

  it('does not send link URLs to the provider and labels links as not read', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ suggestions: [], questions: [] }) } }] });
    const result = await suggestSkill({ context: 'Research', role: '', actions: '', outcome: '', reflection: '', evidence: [
      { id: 'link-1', kind: 'link', label: 'School site', source: 'Student link', url: 'https://school.test/?token=private', content: '' },
    ] }, { client: { chat: { completions: { create } } } });
    const providerPayload = JSON.stringify(create.mock.calls[0][0]);
    expect(providerPayload).not.toContain('token=private');
    expect(result.evidenceAssessment).toMatchObject([{ evidenceId: 'link-1', sourceState: 'link_only' }]);
  });

  it('marks drafts for review when the model says evidence is unresolved', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      suggestions: [{ title: 'I helped the group', summary: 'I presented the result.', tags: [], evidenceIds: ['text-1'] }],
      questions: [{ question: 'What supports that the presentation happened?', missingField: 'evidence' }],
    }) } }] });
    const result = await suggestSkill({ context: 'Class', role: 'Student', actions: 'I presented the result.', outcome: '', reflection: '', evidence: [
      { id: 'text-1', kind: 'text', label: 'Draft slides', source: 'Student upload', content: 'Presentation draft', url: '' },
    ] }, { client: { chat: { completions: { create } } } });
    expect(result.suggestions[0]).toMatchObject({ reviewStatus: 'needs_review', reviewReason: expect.stringContaining('unresolved') });
  });
});
