import { describe, expect, it } from 'vitest';
import { graduationErrorMessage } from './errors';

describe('graduation errors', () => {
  it('distinguishes expired deadlines from stale revisions in all locales', () => {
    for (const locale of ['zh-TW', 'zh-CN', 'en']) {
      const deadline = graduationErrorMessage({ status: 409, code: 'DEADLINE_PASSED' }, locale);
      const revision = graduationErrorMessage({ status: 409, code: 'REVISION_CONFLICT' }, locale);
      expect(deadline).not.toBe(revision);
    }
    expect(graduationErrorMessage({ code: 'DEADLINE_PASSED' }, 'zh-TW')).toContain('截止');
    expect(graduationErrorMessage({ code: 'INVITE_NOT_FOUND' }, 'zh-CN')).toContain('邀请码');
  });
  it('does not expose raw unknown server errors to users', () => {
    expect(graduationErrorMessage(new Error('SELECT secret FROM users'), 'en')).not.toContain('SELECT');
    expect(graduationErrorMessage({ status: 429 }, 'en')).toContain('Too many');
  });
  it('gives actionable localized guidance for AI evidence and decision conflicts', () => {
    const codes = ['INVALID_EVIDENCE', 'INPUT_REVISION_CONFLICT', 'SUGGESTION_NEEDS_REVIEW', 'DECISION_ALREADY_RECORDED'];
    for (const locale of ['zh-TW', 'zh-CN', 'en']) {
      for (const code of codes) {
        expect(graduationErrorMessage({ status: 409, code }, locale)).not.toBe(graduationErrorMessage({ code: 'GENERIC' }, locale));
      }
    }
    expect(graduationErrorMessage({ code: 'SUGGESTION_NEEDS_REVIEW' }, 'en')).toMatch(/edit|reject/i);
    expect(graduationErrorMessage({ code: 'SUGGESTION_NEEDS_REVIEW' }, 'en')).toContain('questions and sources');
    expect(graduationErrorMessage({ code: 'INPUT_REVISION_CONFLICT' }, 'en')).toContain('fresh suggestion');
  });
});
