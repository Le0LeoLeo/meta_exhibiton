import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dictionaries } from '@/app/i18n/catalogs';

beforeEach(() => { vi.resetModules(); sessionStorage.removeItem('metaexpo-home-slogan'); });
afterEach(() => { vi.restoreAllMocks(); sessionStorage.removeItem('metaexpo-home-slogan'); });

it('never repeats the previous headline on reload, even with identical random input', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const first = await import('./homeSlogans');
  const previous = first.getHomeSlogan();
  expect(first.getHomeSlogan()).toBe(previous);
  vi.resetModules();
  const reloaded = await import('./homeSlogans');
  expect(reloaded.getHomeSlogan()).not.toEqual(previous);
});

it.each(['-1', '999', 'NaN', ''])('ignores stale or malformed stored selections: %s', async stored => {
  sessionStorage.setItem('metaexpo-home-slogan', stored);
  const { getHomeSlogan, homeSlogans } = await import('./homeSlogans');
  expect(homeSlogans).toContain(getHomeSlogan());
});

it('keeps a stable headline when storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  const { getHomeSlogan, homeSlogans } = await import('./homeSlogans');
  const selected = getHomeSlogan();
  expect(homeSlogans).toContain(selected);
  expect(getHomeSlogan()).toBe(selected);
});

it('provides distinct, complete headlines in all three languages', async () => {
  const { homeSlogans } = await import('./homeSlogans');
  for (const locale of ['zh-TW', 'zh-CN', 'en'] as const) {
    const headlines = homeSlogans.map(pair => pair.map(key => {
      expect(dictionaries[locale][key]).toBeTruthy();
      return dictionaries[locale][key];
    }).join(''));
    expect(new Set(headlines).size).toBe(homeSlogans.length);
  }
});
