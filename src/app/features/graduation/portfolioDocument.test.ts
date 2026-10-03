import { describe, expect, it } from 'vitest';
import { portfolioDocument } from './portfolioDocument';
import type { GraduationProject } from '@/app/api/graduation';

describe('standalone portfolio export', () => {
  it('escapes user text, retains process and final text and excludes private review and live media', () => {
    const p = { title: '<script>alert(1)</script>', authorName: 'A & B', researchQuestion: 'Why?', concept: '<img src=x onerror=alert(1)>',
      process: 'First\nSecond', outcome: 'Final', team: '', supervisor: '', revision: 4, feedback: 'PRIVATE', galleryId: 'private-gallery' } as GraduationProject;
    const html = portfolioDocument([p], { portfolio: 'Portfolio', by: 'Author', version: 'Version', researchQuestion: 'Question', concept: 'Concept', process: 'Process', outcome: 'Outcome', team: 'Team', supervisor: 'Supervisor' });
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('First\nSecond'); expect(html).toContain('Final'); expect(html).toContain('Version 4');
    expect(html).not.toContain('PRIVATE'); expect(html).not.toContain('private-gallery'); expect(html).toContain('@media print');
  });
});
