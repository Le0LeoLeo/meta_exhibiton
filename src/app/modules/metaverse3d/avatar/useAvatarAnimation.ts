import {
  getAvatarEmoteAnimationName,
  type AvatarEmoteAnimationName,
  type AvatarEmoteState,
} from "./avatarEmote";

export type AvatarAnimationName =
  | "Idle"
  | "Walk"
  | AvatarEmoteAnimationName;

const START_WALK_SPEED = 0.14;
const STOP_WALK_SPEED = 0.07;

export function selectAvatarAnimation(
  speedMetersPerSecond: number,
  emote: AvatarEmoteState,
  previous: AvatarAnimationName,
): AvatarAnimationName {
  if (emote !== "none") return getAvatarEmoteAnimationName(emote);
  const speed = Number.isFinite(speedMetersPerSecond)
    ? Math.max(0, speedMetersPerSecond)
    : 0;
  if (previous === "Walk" && speed >= STOP_WALK_SPEED) return "Walk";
  return speed >= START_WALK_SPEED ? "Walk" : "Idle";
}
