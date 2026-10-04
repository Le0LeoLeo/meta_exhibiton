import type { ExhibitItem } from './types';

/** Only authored exhibit fields belong in scenes and Agent context. */
export function normalizeWorkContext(value: unknown): ExhibitItem['workContext'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const result: NonNullable<ExhibitItem['workContext']> = {};
  for (const key of ['contribution', 'process', 'outcome', 'reflection'] as const) {
    if (typeof input[key] === 'string' && input[key].trim()) result[key] = input[key].trim().slice(0, 2000);
  }
  if (Array.isArray(input.sources)) {
    result.sources = input.sources.slice(0, 5).flatMap((value: unknown) => {
      if (!value || typeof value !== 'object') return [];
      const source = value as Record<string, unknown>;
      if (typeof source.label !== 'string' || !source.label.trim()) return [];
      const entry: { label: string; url?: string; excerpt?: string } = { label: source.label.trim().slice(0, 200) };
      if (typeof source.url === 'string' && source.url.length <= 1000 && /^https?:\/\//i.test(source.url)) {
        try {
          const url = new URL(source.url);
          if (['http:', 'https:'].includes(url.protocol)) entry.url = source.url;
        } catch { /* Invalid links are never rendered or sent to the Agent. */ }
      }
      if (typeof source.excerpt === 'string' && source.excerpt.trim()) entry.excerpt = source.excerpt.trim().slice(0, 2000);
      return [entry];
    });
    if (!result.sources.length) delete result.sources;
  }
  return Object.keys(result).length ? result : undefined;
}
