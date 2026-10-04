import { create } from "zustand";
import type { Vec3 } from "./protocol";
import { DEFAULT_AVATAR_EYE_HEIGHT } from "../avatar/avatarEyeHeight";
import type { AvatarPose } from "../avatar/avatarPose";
import type { AvatarEmote } from "../avatar/avatarEmote";

type LocalPlayerState = {
  position: Vec3;
  yaw: number;
  pose: AvatarPose;
  emote: AvatarEmote | "none";
  emoteNonce: number;
  entranceRevision: number;
  returnToEntrance: () => void;
  setTransform: (position: Vec3, yaw: number, pose?: AvatarPose) => void;
  playEmote: (emote: AvatarEmote) => void;
  clearEmote: (emoteNonce: number) => void;
};

export const useLocalPlayerStore = create<LocalPlayerState>((set) => ({
  position: { x: 0, y: DEFAULT_AVATAR_EYE_HEIGHT, z: 5 },
  yaw: 0,
  pose: "standing",
  emote: "none",
  emoteNonce: 0,
  entranceRevision: 0,
  returnToEntrance: () => set((state) => ({ entranceRevision: state.entranceRevision + 1 })),
  setTransform: (position, yaw, pose = "standing") =>
    set({ position, yaw, pose }),
  playEmote: (emote) =>
    set((state) => ({ emote, emoteNonce: state.emoteNonce + 1 })),
  clearEmote: (emoteNonce) =>
    set((state) => state.emoteNonce === emoteNonce
      ? { emote: "none" }
      : state),
}));
