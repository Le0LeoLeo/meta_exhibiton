import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createAvatarEmoteClips,
  getAvatarEmoteAnimationName,
  normalizeAvatarEmote,
} from "./avatarEmote";

describe("avatar emotes", () => {
  it("normalizes supported emotes and rejects unknown values", () => {
    expect(normalizeAvatarEmote("clap")).toBe("clap");
    expect(normalizeAvatarEmote("dance")).toBe("none");
    expect(normalizeAvatarEmote(null)).toBe("none");
    expect(getAvatarEmoteAnimationName("bow")).toBe("Bow");
  });

  it("creates finite one-shot clips for the procedural emotes", () => {
    const scene = new THREE.Group();
    [
      "Torso",
      "ShoulderL",
      "ShoulderR",
      "UpperArmL",
      "UpperArmR",
      "LowerArmL",
      "LowerArmR",
    ].forEach((name) => {
      const bone = new THREE.Bone();
      bone.name = name;
      scene.add(bone);
    });

    const clips = createAvatarEmoteClips(scene);

    expect(clips.map((clip) => clip.name)).toEqual(["Cheer", "Clap", "Bow"]);
    expect(clips.every((clip) => clip.duration > 0)).toBe(true);
    expect(clips.flatMap((clip) => clip.tracks).every(
      (track) => Array.from(track.values).every(Number.isFinite),
    )).toBe(true);
  });
});
