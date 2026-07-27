import type { WizardAsset } from './wizardStore';

export function replaceMediaPreviewUrls(scene: unknown, assets: WizardAsset[]): unknown {
  const replacements = new Map(
    assets
      .filter((asset) => asset.previewUrl && asset.url)
      .map((asset) => [asset.previewUrl as string, asset.url as string]),
  );

  const replace = (value: unknown): unknown => {
    if (typeof value === 'string') return replacements.get(value) ?? value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    }
    return value;
  };

  return replace(scene);
}

export function addMediaShareTokenToScene(scene: unknown, shareToken: string): unknown {
  const encodedToken = encodeURIComponent(shareToken);
  const addToken = (value: unknown): unknown => {
    if (typeof value === 'string' && /^\/api\/media\/[a-f0-9-]{36}$/i.test(value)) {
      return `${value}?shareToken=${encodedToken}`;
    }
    if (Array.isArray(value)) return value.map(addToken);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, addToken(item)]));
    }
    return value;
  };
  return addToken(scene);
}

export function stripMediaAccessTokensFromScene(scene: unknown): unknown {
  const strip = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const match = value.match(/^(\/api\/media\/[a-f0-9-]{36})(?:\?.*)?$/i);
      return match?.[1] ?? value;
    }
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, strip(item)]));
    }
    return value;
  };
  return strip(scene);
}
