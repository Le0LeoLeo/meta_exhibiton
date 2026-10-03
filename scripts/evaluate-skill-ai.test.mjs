import { describe, it, expect } from 'vitest';
import { prepareEvaluation, runEvaluation } from './evaluate-skill-ai.mjs';

const cases = ['normal', 'missing', 'contradictory', 'link_only', 'adversarial'].flatMap(category => Array.from({ length: 5 }, (_, i) => ({
  id: `${category}-${i}`, category, input: 'Synthetic action.', sources: [], expectedChecks: ['No invention.'], label: 'synthetic fixed test; not executed',
})));

describe('synthetic skill evaluation', () => {
  it('balances a bounded sample across all categories rather than only easy cases', () => {
    const sample = prepareEvaluation(cases, 10);
    for (const category of new Set(cases.map(item => item.category))) expect(sample.filter(item => item.category === category)).toHaveLength(2);
    expect(() => prepareEvaluation(cases, 100)).toThrow();
    expect(() => prepareEvaluation([...cases, cases[0]])).toThrow();
  });
  it('retains fallback and failed calls, and never equates valid output with learning or semantic success', async () => {
    let n = 0;
    const result = await runEvaluation(prepareEvaluation(cases, 3), { invoke: async () => {
      n++;
      if (n === 1) return { status: 'ready', suggestions: [{ summary: 'Unsupported claim' }] };
      if (n === 2) return { status: 'fallback' };
      throw new Error('Do not expose transport details');
    } });
    expect(result.summary).toMatchObject({ total: 3, ready: 1, fallback: 1, errors: 1 });
    expect(result.educationalStudy).toBe(false);
    expect(result.results.every(item => item.humanReview.status === 'pending')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('transport details');
  });
  it('maps fixture URL sources to the same link type used by the application', () => {
    const fixture = cases.map(item => item.id === 'link_only-0' ? { ...item, sources: [{ id: 'link', kind: 'url', url: 'https://example.invalid/record' }] } : item);
    expect(prepareEvaluation(fixture, 5).find(item => item.category === 'link_only').input.evidence[0]).toMatchObject({ kind: 'link', content: '', url: 'https://example.invalid/record' });
    expect(() => prepareEvaluation(cases.map(item => ({ ...item, sources: [{ id: 'bad', kind: 'unknown' }] })))).toThrow();
  });
});
