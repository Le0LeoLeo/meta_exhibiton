import { describe, expect, it } from "vitest";
import {
  getAvatarAnimationPhase,
  getAvatarInitialIdleTime,
  getWalkAnimationTimeScale,
  removeAvatarHeadScaleTracks,
  removeAvatarPreviewHeadMotionTracks,
} from "./AvatarModel";
import * as THREE from "three";

describe("AvatarModel animation helpers", () => {
  it("creates a stable per-player animation phase", () => {
    const first = getAvatarAnimationPhase("visitor-42");

    expect(first).toBe(getAvatarAnimationPhase("visitor-42"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(first).not.toBe(getAvatarAnimationPhase("visitor-43"));
  });

  it("clamps walk animation time scale to a natural range", () => {
    expect(getWalkAnimationTimeScale(0)).toBe(0.7);
    expect(getWalkAnimationTimeScale(1.4)).toBe(1);
    expect(getWalkAnimationTimeScale(20)).toBe(1.35);
    expect(getWalkAnimationTimeScale(Number.NaN)).toBe(0.7);
  });

  it("holds the customizer preview on the neutral first idle frame", () => {
    expect(getAvatarInitialIdleTime(4.2, 0.65, true)).toBe(0);
    expect(getAvatarInitialIdleTime(4.2, 0.65, false)).toBeCloseTo(2.73);
  });

  it("removes animation tracks that overwrite the selected face shape", () => {
    const headScale = new THREE.VectorKeyframeTrack(
      "Head.scale",
      [0, 1],
      [1, 1, 1, 1, 1, 1],
    );
    const headRotation = new THREE.QuaternionKeyframeTrack(
      "Head.quaternion",
      [0, 1],
      [0, 0, 0, 1, 0, 0, 0, 1],
    );
    const source = new THREE.AnimationClip("Idle", 1, [
      headScale,
      headRotation,
    ]);

    const [result] = removeAvatarHeadScaleTracks([source]);

    expect(result).not.toBe(source);
    expect(result.tracks.map((track) => track.name)).toEqual([
      "Head.quaternion",
    ]);
    expect(source.tracks).toHaveLength(2);
  });

  it("keeps the customization preview facing forward", () => {
    const source = new THREE.AnimationClip("Idle", 1, [
      new THREE.VectorKeyframeTrack(
        "Head.position",
        [0, 1],
        [0, 0, 0, 0, 0, 0],
      ),
      new THREE.QuaternionKeyframeTrack(
        "Head.quaternion",
        [0, 1],
        [0, 0, 0, 1, 0, 0, 0, 1],
      ),
      new THREE.QuaternionKeyframeTrack(
        "Neck.quaternion",
        [0, 1],
        [0, 0, 0, 1, 0, 0, 0, 1],
      ),
      new THREE.VectorKeyframeTrack(
        "Hips.position",
        [0, 1],
        [0, 0, 0, 0, 0, 0],
      ),
    ]);

    const [result] = removeAvatarPreviewHeadMotionTracks([source]);

    expect(result.tracks.map((track) => track.name)).toEqual([
      "Hips.position",
    ]);
  });
});
