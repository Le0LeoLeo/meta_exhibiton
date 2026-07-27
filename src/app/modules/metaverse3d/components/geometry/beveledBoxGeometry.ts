import { RoundedBoxGeometry } from "three-stdlib";

export type BoxDimensions = readonly [number, number, number];

export const DEFAULT_BEVEL_RADIUS = 0.008;
export const DEFAULT_BEVEL_SEGMENTS = 2;

const MAX_BEVEL_SEGMENTS = 2;
const MAX_BEVEL_RATIO = 0.49;

export function normalizeBevelSize(
  dimensions: BoxDimensions,
  radius: number,
): number {
  const smallestDimension = Math.min(...dimensions);
  return Math.min(Math.max(0, radius), smallestDimension * MAX_BEVEL_RATIO);
}

export function createBeveledBoxGeometry(
  dimensions: BoxDimensions,
  radius = DEFAULT_BEVEL_RADIUS,
  segments = DEFAULT_BEVEL_SEGMENTS,
): RoundedBoxGeometry {
  const [width, height, depth] = dimensions;
  const normalizedSegments = Math.min(
    MAX_BEVEL_SEGMENTS,
    Math.max(1, Math.round(segments)),
  );

  return new RoundedBoxGeometry(
    width,
    height,
    depth,
    normalizedSegments,
    normalizeBevelSize(dimensions, radius),
  );
}
