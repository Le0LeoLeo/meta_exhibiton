import { describe, expect, it } from 'vitest';
import { normalizeWorkContext } from './workContext';

describe('authored exhibit context', () => {
  it('keeps only bounded exhibit fields and safe source links', () => {
    const value = normalizeWorkContext({ contribution: 'I built the prototype', privateNotes: 'excluded',
      sources: [{ label: 'Report', url: 'https://example.org/report', excerpt: 'Observed result', privateNotes: 'excluded' },
        { label: 'Unsafe', url: 'javascript:alert(1)' }], reflection: 'x'.repeat(2100) });
    expect(value).toEqual({ contribution: 'I built the prototype', reflection: 'x'.repeat(2000),
      sources: [{ label: 'Report', url: 'https://example.org/report', excerpt: 'Observed result' }, { label: 'Unsafe' }] });
  });
  it('tolerates malformed legacy imports without introducing empty data', () => {
    for (const value of [null, [], 'bad', { sources: [null, 3, { label: 1 }] }, { outcome: 3 }]) expect(normalizeWorkContext(value)).toBeUndefined();
  });
  it('caps sources and preserves a link without inventing an excerpt', () => {
    const value = normalizeWorkContext({ sources: Array.from({ length: 10 }, () => ({ label: 'Link', url: 'https://example.org' })) });
    expect(value?.sources).toHaveLength(5);
    expect(value?.sources?.[0]).not.toHaveProperty('excerpt');
  });
});
