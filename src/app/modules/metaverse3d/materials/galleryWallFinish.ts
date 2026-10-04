export interface GalleryWallFinish {
  color: string;
  isFeatureTint: boolean;
}

const WARM_WHITE: Rgb = [225, 222, 214];
const FEATURE_TINTS: readonly Rgb[] = [
  [231, 235, 229],
  [238, 231, 227],
  [232, 231, 237],
];
const FEATURE_RATE = 13;

type Rgb = readonly [number, number, number];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseHexColor(value: string): Rgb | null {
  const match = /^#([\da-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function toHexColor(color: Rgb): string {
  return `#${color
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixColor(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((channel, index) =>
    channel + (to[index] - channel) * amount,
  ) as unknown as Rgb;
}

/**
 * Produces a restrained exhibition-wall finish without runtime randomness.
 * Caller-side guards decide whether a wall is eligible for built-in finishing.
 */
export function getGalleryWallFinish(
  segmentId: string,
  baseColor: string,
  allowFeatureTint: boolean,
): GalleryWallFinish {
  const supplied = parseHexColor(baseColor) ?? WARM_WHITE;
  const warmBase = supplied.map((channel, index) =>
    Math.min(channel, WARM_WHITE[index]),
  ) as unknown as Rgb;
  const hash = stableHash(segmentId);
  const isFeatureTint = allowFeatureTint && hash % FEATURE_RATE === 0;

  if (!isFeatureTint) {
    return { color: toHexColor(warmBase), isFeatureTint: false };
  }

  const tint = FEATURE_TINTS[(hash >>> 8) % FEATURE_TINTS.length];
  return {
    color: toHexColor(mixColor(warmBase, tint, 0.18)),
    isFeatureTint: true,
  };
}
