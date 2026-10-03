import { AVATAR_MANIFEST } from "../../avatar/avatarManifest";
import * as THREE from "three";
import type { AvatarAppearanceV1 } from "../../avatar/avatarAppearance";
import { getAvatarEyeHeight } from "../../avatar/avatarEyeHeight";

export type RemoteAvatarPalette = {
  jacket: string;
  shirt: string;
  trousers: string;
  shoes: string;
  accent: string;
  hair: string;
  skin: string;
};

const REMOTE_AVATAR_PALETTES: readonly RemoteAvatarPalette[] = [
  {
    jacket: "#2563eb",
    shirt: "#dbeafe",
    trousers: "#172554",
    shoes: "#0f172a",
    accent: "#38bdf8",
    hair: "#312e2b",
    skin: "#efc6a8",
  },
  {
    jacket: "#0f766e",
    shirt: "#ccfbf1",
    trousers: "#134e4a",
    shoes: "#17202a",
    accent: "#2dd4bf",
    hair: "#292524",
    skin: "#d9a47f",
  },
  {
    jacket: "#7c3aed",
    shirt: "#ede9fe",
    trousers: "#2e1065",
    shoes: "#1e1b4b",
    accent: "#c084fc",
    hair: "#3f2d24",
    skin: "#f0c9aa",
  },
  {
    jacket: "#be123c",
    shirt: "#ffe4e6",
    trousers: "#4c0519",
    shoes: "#1f1720",
    accent: "#fb7185",
    hair: "#241c19",
    skin: "#b97855",
  },
  {
    jacket: "#b45309",
    shirt: "#fef3c7",
    trousers: "#451a03",
    shoes: "#292016",
    accent: "#fbbf24",
    hair: "#4a3025",
    skin: "#8f5d3f",
  },
];

function hashNickname(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getRemoteAvatarPalette(
  seed: string,
  appearance?: AvatarAppearanceV1,
): RemoteAvatarPalette {
  if (appearance) {
    return {
      jacket: AVATAR_MANIFEST.colors.top[appearance.colors.top],
      shirt: "#f5f5f4",
      trousers: AVATAR_MANIFEST.colors.bottom[appearance.colors.bottom],
      shoes: AVATAR_MANIFEST.colors.shoes[appearance.colors.shoes],
      accent: AVATAR_MANIFEST.colors.top[appearance.colors.top],
      hair: AVATAR_MANIFEST.colors.hair[appearance.colors.hair],
      skin: AVATAR_MANIFEST.colors.skin[appearance.colors.skin],
    };
  }
  return REMOTE_AVATAR_PALETTES[
    hashNickname(seed.trim().toLocaleLowerCase()) % REMOTE_AVATAR_PALETTES.length
  ];
}

export type RemoteAvatarMotion = {
  armSwing: number;
  legSwing: number;
  bob: number;
  lean: number;
  sittingBlend?: number;
};

type RemotePlayerTransformInput = {
  renderPosition: { x: number; y: number; z: number };
  renderYaw: number;
  appearance: AvatarAppearanceV1;
};

type AvatarAppearanceKeyInput = {
  version: number;
  body: string;
  head: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
  accessory: string;
  colors: {
    skin: string;
    hair: string;
    top: string;
    bottom: string;
    shoes: string;
  };
};

export function getRemotePlayerTransform(player: RemotePlayerTransformInput) {
  return {
    position: [
      player.renderPosition.x,
      player.renderPosition.y - getAvatarEyeHeight(player.appearance),
      player.renderPosition.z,
    ] as [number, number, number],
    rotation: [0, player.renderYaw + Math.PI, 0] as [
      number,
      number,
      number,
    ],
  };
}

export function getRemoteAppearanceKey(
  appearance: AvatarAppearanceKeyInput,
): string {
  return [
    appearance.version,
    appearance.body,
    appearance.head,
    appearance.hair,
    appearance.top,
    appearance.bottom,
    appearance.shoes,
    appearance.accessory,
    appearance.colors.skin,
    appearance.colors.hair,
    appearance.colors.top,
    appearance.colors.bottom,
    appearance.colors.shoes,
  ].join(":");
}

export function updateRemoteAvatarMotion(
  target: RemoteAvatarMotion,
  elapsedSeconds: number,
  speedMetersPerSecond: number,
  sitting = false,
  deltaSeconds = 1 / 60,
) {
  const sanitizedSpeed = Number.isFinite(speedMetersPerSecond)
    ? Math.max(0, speedMetersPerSecond)
    : 0;
  const movement = sitting ? 0 : Math.min(1, sanitizedSpeed / 1.8);
  const phase = elapsedSeconds * 8;
  const swing = Math.sin(phase) * 0.58 * movement;

  target.armSwing = movement === 0 ? 0 : swing;
  target.legSwing = movement === 0 ? 0 : -swing * 0.78;
  target.bob = Math.abs(Math.sin(phase)) * 0.028 * movement;
  target.lean =
    sanitizedSpeed === 0 ? 0 : -Math.min(0.07, sanitizedSpeed * 0.018);
  if (target.sittingBlend !== undefined || sitting) {
    target.sittingBlend = THREE.MathUtils.damp(
      target.sittingBlend ?? 0,
      sitting ? 1 : 0,
      8,
      deltaSeconds,
    );
  }
  return target;
}
