import { afterEach, describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './formatDate';

const original = document.documentElement.lang;
afterEach(() => { document.documentElement.lang = original; });

describe('formatDate', () => {
  it('uses the interface language instead of the system language', () => {
    const value = '2026-10-04T06:59:35Z';
    document.documentElement.lang = 'en';
    expect(formatDateTime(value)).toBe(new Date(value).toLocaleString('en'));
    expect(formatDate(value)).toBe(new Date(value).toLocaleDateString('en'));
    document.documentElement.lang = 'zh-TW';
    expect(formatDateTime(value)).toBe(new Date(value).toLocaleString('zh-TW'));
  });
});
