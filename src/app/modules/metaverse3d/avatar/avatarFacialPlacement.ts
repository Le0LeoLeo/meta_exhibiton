import type { AvatarAppearanceV1 } from "./avatarAppearance";

export type AvatarFacialPlacement = {
  eyes: {
    offsetY: number;
    spacing: number;
    scale: number;
  };
  eyebrows: {
    offsetY: number;
    spacing: number;
    rotation: number;
  };
  mouth: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
  };
};

export const DEFAULT_AVATAR_FACIAL_PLACEMENT = {
  eyes: { offsetY: 0, spacing: 0, scale: 1 },
  eyebrows: { offsetY: 0, spacing: 0, rotation: 0 },
  mouth: { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
} as const;

export const AVATAR_FACIAL_PLACEMENT_LIMITS = {
  eyes: {
    offsetY: { min: -0.1, max: 0.1, step: 0.005 },
    spacing: { min: -0.06, max: 0.08, step: 0.005 },
    scale: { min: 0.75, max: 1.35, step: 0.01 },
  },
  eyebrows: {
    offsetY: { min: -0.08, max: 0.1, step: 0.005 },
    spacing: { min: -0.06, max: 0.08, step: 0.005 },
    rotation: { min: -0.35, max: 0.35, step: 0.01 },
  },
  mouth: {
    offsetX: { min: -0.12, max: 0.12, step: 0.005 },
    offsetY: { min: -0.1, max: 0.08, step: 0.005 },
    scaleX: { min: 0.7, max: 1.4, step: 0.01 },
    scaleY: { min: 0.7, max: 1.4, step: 0.01 },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function normalizeAvatarFacialPlacement(
  value: unknown,
): AvatarFacialPlacement {
  const placement = isRecord(value) ? value : {};
  const eyes = isRecord(placement.eyes) ? placement.eyes : {};
  const eyebrows = isRecord(placement.eyebrows) ? placement.eyebrows : {};
  const mouth = isRecord(placement.mouth) ? placement.mouth : {};

  return {
    eyes: {
      offsetY: normalizeNumber(
        eyes.offsetY,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.offsetY.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.offsetY.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes.offsetY,
      ),
      spacing: normalizeNumber(
        eyes.spacing,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.spacing.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.spacing.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes.spacing,
      ),
      scale: normalizeNumber(
        eyes.scale,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.scale.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.scale.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes.scale,
      ),
    },
    eyebrows: {
      offsetY: normalizeNumber(
        eyebrows.offsetY,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.offsetY.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.offsetY.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.eyebrows.offsetY,
      ),
      spacing: normalizeNumber(
        eyebrows.spacing,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.spacing.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.spacing.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.eyebrows.spacing,
      ),
      rotation: normalizeNumber(
        eyebrows.rotation,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.rotation.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.rotation.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.eyebrows.rotation,
      ),
    },
    mouth: {
      offsetX: normalizeNumber(
        mouth.offsetX,
        AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.offsetX.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.offsetX.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth.offsetX,
      ),
      offsetY: normalizeNumber(
        mouth.offsetY,
        AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.offsetY.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.offsetY.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth.offsetY,
      ),
      scaleX: normalizeNumber(
        mouth.scaleX,
        AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.scaleX.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.scaleX.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth.scaleX,
      ),
      scaleY: normalizeNumber(
        mouth.scaleY,
        AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.scaleY.min,
        AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.scaleY.max,
        DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth.scaleY,
      ),
    },
  };
}

type FacialTransform = {
  position: [number, number, number];
  scale: [number, number, number];
  rotationZ: number;
};

export type AvatarFacialTransforms = {
  eyes: {
    left: FacialTransform;
    right: FacialTransform;
  };
  eyebrows: {
    left: FacialTransform;
    right: FacialTransform;
  };
  mouth: FacialTransform;
};

function scaleTuple(
  value: readonly [number, number, number],
  multiplier: number,
): [number, number, number] {
  return [
    value[0] * multiplier,
    value[1] * multiplier,
    value[2] * multiplier,
  ];
}

export function resolveAvatarFacialTransforms(
  appearance: AvatarAppearanceV1,
): AvatarFacialTransforms {
  const placement = normalizeAvatarFacialPlacement(
    appearance.facialPlacement,
  );
  const eyeX = 0.17 + placement.eyes.spacing;
  const eyeY = 2.55 + placement.eyes.offsetY;
  const baseEyeScale =
    appearance.eyes === "eyes02"
      ? [0.061, 0.034, 0.02] as const
      : appearance.eyes === "eyes03"
        ? [0.058, 0.072, 0.022] as const
        : [0.045, 0.052, 0.02] as const;
  const eyeScale = scaleTuple(baseEyeScale, placement.eyes.scale);

  const browX = 0.17 + placement.eyebrows.spacing;
  const browY = 2.655 + placement.eyebrows.offsetY;
  const browTilt =
    (appearance.eyebrows === "eyebrows03" ? 0.16 : 0) +
    placement.eyebrows.rotation;

  const baseMouthY = appearance.mouth === "mouth03" ? 2.405 : 2.41;
  const baseMouthScaleY = appearance.mouth === "mouth03" ? 0.78 : 1;

  return {
    eyes: {
      left: {
        position: [-eyeX, eyeY, 0.545],
        scale: [...eyeScale],
        rotationZ: 0,
      },
      right: {
        position: [eyeX, eyeY, 0.545],
        scale: [...eyeScale],
        rotationZ: 0,
      },
    },
    eyebrows: {
      left: {
        position: [-browX, browY, 0.545],
        scale: [1, 1, 1],
        rotationZ: -browTilt,
      },
      right: {
        position: [browX, browY, 0.545],
        scale: [1, 1, 1],
        rotationZ: browTilt,
      },
    },
    mouth: {
      position: [
        placement.mouth.offsetX,
        baseMouthY + placement.mouth.offsetY,
        0.57,
      ],
      scale: [
        placement.mouth.scaleX,
        baseMouthScaleY * placement.mouth.scaleY,
        1,
      ],
      rotationZ: appearance.mouth === "mouth02" ? Math.PI : 0,
    },
  };
}
