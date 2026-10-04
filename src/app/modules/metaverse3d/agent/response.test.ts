import { describe, expect, it } from 'vitest';
import { getAgentResponse } from './response';
import type { AgentResponseContext } from './types';

const wave = {
  id: 'wave', type: 'painting' as const, position: [0, 1.5, 0] as [number, number, number],
  title: 'Under the Wave', artist: 'Hokusai', description: 'Label by Ava. A woodblock print.',
  imageUrl: '/wave.jpg',
  workContext: {
    contribution: 'I wrote the label.',
    process: 'Ben noticed I had written 1850, so I fixed the date to about 1830–32.',
    reflection: 'I learned to write down where every date comes from.',
    sources: [{ label: 'The Met record', url: 'https://example.org/wave', excerpt: 'about 1830–32' }],
  },
};

const ask = (question: string, overrides: Partial<AgentResponseContext> = {}) => getAgentResponse({
  question, personality: 'expert', exhibit: wave, nearbyExhibits: [], preferredLanguage: 'en', ...overrides,
});

describe('local guide fallback', () => {
  it('answers process questions from the creator notes and marks them as the creator account', () => {
    const answer = ask('Why did the student change the date on this label?');
    expect(answer).toContain('Ben noticed I had written 1850');
    expect(answer).toContain('not an independently checked fact');
    expect(answer).not.toContain('Image analysis');
  });

  it('answers learning questions with the reflection', () => {
    expect(ask('What did the student learn from this work?')).toContain('write down where every date comes from');
    expect(ask('學生從這件作品學到什麼？', { preferredLanguage: 'zh-TW' })).toContain('根據創作者對「Under the Wave」的自述（反思）');
  });

  it('lists sources without claiming to have opened them', () => {
    const answer = ask('What sources did they use?');
    expect(answer).toContain('The Met record (supplied excerpt: "about 1830–32")');
    expect(answer).toContain('I have not opened any linked pages');
  });

  it('invites questions about the recorded learning story for general questions', () => {
    const answer = ask('Introduce this work');
    expect(answer).toContain('Under the Wave by Hokusai: Label by Ava.');
    expect(answer).toContain('The creator also shared their reflection, process, contribution.');
  });

  it('says it cannot see the image only when asked about what the image looks like', () => {
    expect(ask('What colours are in the picture?')).toMatch(/^I can't analyze the image right now/);
    expect(ask('目前畫面有什麼顏色？', { preferredLanguage: 'zh-TW' })).toMatch(/^目前無法分析圖片/);
  });

  it('falls back to the description when the asked field was not recorded', () => {
    const exhibit = { ...wave, workContext: { contribution: 'I wrote the label.' } };
    expect(ask('What was the final outcome?', { exhibit })).toContain('Label by Ava. A woodblock print.');
  });

  it('asks the visitor to pick a work when none is in focus', () => {
    expect(ask('What did they learn?', { exhibit: null })).toMatch(/^Which work caught your eye/);
  });
});
