import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createSittingAnimationClip,
  createSittingLegTargets,
  normalizeAvatarPose,
} from "./avatarPose";

describe("avatar sitting pose", () => {
  it("points the thigh forward and the shin down", () => {
    const upperRest = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.45, 0.1, -0.2),
    );
    const lowerRest = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3, 0.05, 0.08),
    );
    const targets = createSittingLegTargets(upperRest, lowerRest);
    const boneAxis = new THREE.Vector3(0, 1, 0);
    const thighDirection = boneAxis
      .clone()
      .applyQuaternion(targets.upperLeg);
    const shinDirection = boneAxis
      .clone()
      .applyQuaternion(targets.lowerLeg)
      .applyQuaternion(targets.upperLeg);

    expect(thighDirection.z).toBeGreaterThan(0.95);
    expect(shinDirection.y).toBeLessThan(-0.99);
  });

  it("builds a constant four-track sitting animation", () => {
    const clip = createSittingAnimationClip();

    expect(clip.name).toBe("Sit");
    expect(clip.tracks.map((track) => track.name)).toEqual([
      "UpperLegL.quaternion",
      "UpperLegR.quaternion",
      "LowerLegL.quaternion",
      "LowerLegR.quaternion",
    ]);
  });

  it("normalizes unknown network values to standing", () => {
    expect(normalizeAvatarPose("sitting")).toBe("sitting");
    expect(normalizeAvatarPose("flying")).toBe("standing");
    expect(normalizeAvatarPose(undefined)).toBe("standing");
  });
});
