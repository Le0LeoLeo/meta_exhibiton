import * as THREE from "three";

export type AvatarPose = "standing" | "sitting";

export type SittingLegTargets = {
  upperLeg: THREE.Quaternion;
  lowerLeg: THREE.Quaternion;
};

export const SITTING_ANIMATION_NAME = "Sit";
const SITTING_TRACK_NAMES = new Set([
  "UpperLegL.quaternion",
  "UpperLegR.quaternion",
  "LowerLegL.quaternion",
  "LowerLegR.quaternion",
  "FootL.position",
  "FootL.quaternion",
  "FootR.position",
  "FootR.quaternion",
]);

const BONE_FORWARD = new THREE.Vector3(0, -0.16, 1).normalize();
const BONE_DOWN = new THREE.Vector3(0, -1, 0);
const BONE_AXIS = new THREE.Vector3(0, 1, 0);

export function normalizeAvatarPose(value: unknown): AvatarPose {
  return value === "sitting" ? "sitting" : "standing";
}

export function createSittingLegTargets(
  upperLegRest = new THREE.Quaternion(),
  lowerLegRest = new THREE.Quaternion(),
): SittingLegTargets {
  const upperRestDirection = BONE_AXIS.clone().applyQuaternion(upperLegRest);
  const upperSwing = new THREE.Quaternion().setFromUnitVectors(
    upperRestDirection,
    BONE_FORWARD,
  );
  const upperLeg = upperSwing.multiply(upperLegRest.clone());
  const desiredLowerDirectionInUpperLegSpace =
    BONE_DOWN.clone().applyQuaternion(
    upperLeg.clone().invert(),
  );
  const lowerRestDirection =
    BONE_AXIS.clone().applyQuaternion(lowerLegRest);
  const lowerSwing = new THREE.Quaternion().setFromUnitVectors(
    lowerRestDirection,
    desiredLowerDirectionInUpperLegSpace,
  );
  const lowerLeg = lowerSwing.multiply(lowerLegRest.clone());

  return { upperLeg, lowerLeg };
}

export function createSittingAnimationClip(
  scene?: THREE.Object3D,
  idleClip?: THREE.AnimationClip,
): THREE.AnimationClip {
  const sampleTrack = (
    name: string,
    fallback: readonly number[],
  ): number[] => {
    const track = idleClip?.tracks.find((candidate) => candidate.name === name);
    if (!track) return [...fallback];
    return Array.from(track.createInterpolant().evaluate(0));
  };
  const applyQuaternionSample = (
    object: THREE.Object3D,
    name: string,
  ) => {
    object.quaternion.fromArray(
      sampleTrack(name, object.quaternion.toArray()),
    );
  };
  const applyPositionSample = (
    object: THREE.Object3D,
    name: string,
  ) => {
    object.position.fromArray(sampleTrack(name, object.position.toArray()));
  };
  const footTargets = new Map<
    "L" | "R",
    { position: THREE.Vector3; quaternion: THREE.Quaternion }
  >();

  const targetFor = (side: "L" | "R") =>
    createSittingLegTargets(
      scene?.getObjectByName(`UpperLeg${side}`)?.quaternion,
      scene?.getObjectByName(`LowerLeg${side}`)?.quaternion,
    );
  const legTargets = new Map<"L" | "R", SittingLegTargets>();
  const savedTransforms: Array<{
    object: THREE.Object3D;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  }> = [];

  if (scene) {
    for (const side of ["L", "R"] as const) {
      const upper = scene.getObjectByName(`UpperLeg${side}`);
      const lower = scene.getObjectByName(`LowerLeg${side}`);
      const foot = scene.getObjectByName(`Foot${side}`);
      if (!upper || !lower || !foot || !foot.parent) continue;

      for (const object of [upper, lower, foot]) {
        savedTransforms.push({
          object,
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
        });
      }
      applyQuaternionSample(upper, `UpperLeg${side}.quaternion`);
      applyQuaternionSample(lower, `LowerLeg${side}.quaternion`);
      applyPositionSample(foot, `Foot${side}.position`);
      applyQuaternionSample(foot, `Foot${side}.quaternion`);
      scene.updateMatrixWorld(true);

      const kneePosition = lower.getWorldPosition(new THREE.Vector3());
      const standingFootPosition = foot.getWorldPosition(new THREE.Vector3());
      const shinLength = kneePosition.distanceTo(standingFootPosition);
      const standingFootWorldQuaternion =
        foot.getWorldQuaternion(new THREE.Quaternion());
      const targets = createSittingLegTargets(
        upper.quaternion,
        lower.quaternion,
      );
      legTargets.set(side, targets);
      upper.quaternion.copy(targets.upperLeg);
      lower.quaternion.copy(targets.lowerLeg);
      scene.updateMatrixWorld(true);

      const lowerWorldQuaternion =
        lower.getWorldQuaternion(new THREE.Quaternion());
      const ankleWorldPosition = lower
        .getWorldPosition(new THREE.Vector3())
        .add(
          BONE_AXIS.clone()
            .applyQuaternion(lowerWorldQuaternion)
            .normalize()
            .multiplyScalar(shinLength),
        );
      const footPosition = foot.parent.worldToLocal(ankleWorldPosition);
      const parentWorldQuaternion =
        foot.parent.getWorldQuaternion(new THREE.Quaternion());
      const footQuaternion = parentWorldQuaternion
        .invert()
        .multiply(standingFootWorldQuaternion);
      footTargets.set(side, {
        position: footPosition,
        quaternion: footQuaternion,
      });
    }

    for (const saved of savedTransforms) {
      saved.object.position.copy(saved.position);
      saved.object.quaternion.copy(saved.quaternion);
    }
    scene.updateMatrixWorld(true);
  }

  const leftTargets = legTargets.get("L") ?? targetFor("L");
  const rightTargets = legTargets.get("R") ?? targetFor("R");
  const times = [0, 1];
  const quaternionValues = (quaternion: THREE.Quaternion) => [
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w,
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w,
  ];

  const constantVectorValues = (vector: THREE.Vector3) => [
    vector.x,
    vector.y,
    vector.z,
    vector.x,
    vector.y,
    vector.z,
  ];
  const retainedIdleTracks = idleClip?.tracks
    .filter((track) => !SITTING_TRACK_NAMES.has(track.name))
    .map((track) => track.clone()) ?? [];
  const leftFoot = footTargets.get("L");
  const rightFoot = footTargets.get("R");
  const sittingTracks: THREE.KeyframeTrack[] = [
    new THREE.QuaternionKeyframeTrack(
      "UpperLegL.quaternion",
      times,
      quaternionValues(leftTargets.upperLeg),
    ),
    new THREE.QuaternionKeyframeTrack(
      "UpperLegR.quaternion",
      times,
      quaternionValues(rightTargets.upperLeg),
    ),
    new THREE.QuaternionKeyframeTrack(
      "LowerLegL.quaternion",
      times,
      quaternionValues(leftTargets.lowerLeg),
    ),
    new THREE.QuaternionKeyframeTrack(
      "LowerLegR.quaternion",
      times,
      quaternionValues(rightTargets.lowerLeg),
    ),
  ];
  if (leftFoot) {
    sittingTracks.push(
      new THREE.VectorKeyframeTrack(
        "FootL.position",
        times,
        constantVectorValues(leftFoot.position),
      ),
      new THREE.QuaternionKeyframeTrack(
        "FootL.quaternion",
        times,
        quaternionValues(leftFoot.quaternion),
      ),
    );
  }
  if (rightFoot) {
    sittingTracks.push(
      new THREE.VectorKeyframeTrack(
        "FootR.position",
        times,
        constantVectorValues(rightFoot.position),
      ),
      new THREE.QuaternionKeyframeTrack(
        "FootR.quaternion",
        times,
        quaternionValues(rightFoot.quaternion),
      ),
    );
  }

  return new THREE.AnimationClip(
    SITTING_ANIMATION_NAME,
    idleClip?.duration ?? 1,
    [...retainedIdleTracks, ...sittingTracks],
  );
}
