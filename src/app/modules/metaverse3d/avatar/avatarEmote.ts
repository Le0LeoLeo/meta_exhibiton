import * as THREE from "three";

export const AVATAR_EMOTES = ["wave", "cheer", "clap", "bow"] as const;

export type AvatarEmote = (typeof AVATAR_EMOTES)[number];
export type AvatarEmoteState = "none" | AvatarEmote;
export type AvatarEmoteAnimationName = "Wave" | "Cheer" | "Clap" | "Bow";

const EMOTE_ANIMATION_NAMES: Record<AvatarEmote, AvatarEmoteAnimationName> = {
  wave: "Wave",
  cheer: "Cheer",
  clap: "Clap",
  bow: "Bow",
};

type QuaternionPose = Partial<Record<
  "Torso" | "ShoulderL" | "ShoulderR" | "UpperArmL" | "UpperArmR"
    | "LowerArmL" | "LowerArmR",
  [number, number, number]
>>;

export function normalizeAvatarEmote(value: unknown): AvatarEmoteState {
  return typeof value === "string"
    && (AVATAR_EMOTES as readonly string[]).includes(value)
    ? value as AvatarEmote
    : "none";
}

export function getAvatarEmoteAnimationName(
  emote: AvatarEmote,
): AvatarEmoteAnimationName {
  return EMOTE_ANIMATION_NAMES[emote];
}

function sampleIdleQuaternion(
  idleClip: THREE.AnimationClip | undefined,
  object: THREE.Object3D | undefined,
  name: string,
): THREE.Quaternion {
  const track = idleClip?.tracks.find(
    (candidate) => candidate.name === `${name}.quaternion`,
  );
  const sample = track?.createInterpolant().evaluate(0);
  return sample
    ? new THREE.Quaternion().fromArray(sample)
    : object?.quaternion.clone() ?? new THREE.Quaternion();
}

function applyEulerOffset(
  base: THREE.Quaternion,
  offset: [number, number, number] | undefined,
): THREE.Quaternion {
  if (!offset) return base.clone();
  return base.clone().multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...offset)),
  );
}

function createPoseClip(
  name: AvatarEmoteAnimationName,
  duration: number,
  times: number[],
  poses: QuaternionPose[],
  scene: THREE.Object3D,
  idleClip?: THREE.AnimationClip,
): THREE.AnimationClip {
  const bones = new Set(poses.flatMap((pose) => Object.keys(pose)));
  const tracks = [...bones].map((boneName) => {
    const base = sampleIdleQuaternion(
      idleClip,
      scene.getObjectByName(boneName),
      boneName,
    );
    const values = poses.flatMap((pose) => {
      const quaternion = applyEulerOffset(
        base,
        pose[boneName as keyof QuaternionPose],
      );
      return quaternion.toArray();
    });
    return new THREE.QuaternionKeyframeTrack(
      `${boneName}.quaternion`,
      times,
      values,
    );
  });
  return new THREE.AnimationClip(name, duration, tracks);
}

export function createAvatarEmoteClips(
  scene: THREE.Object3D,
  idleClip?: THREE.AnimationClip,
): THREE.AnimationClip[] {
  const rest: QuaternionPose = {
    Torso: [0, 0, 0],
    ShoulderL: [0, 0, 0],
    ShoulderR: [0, 0, 0],
    UpperArmL: [0, 0, 0],
    UpperArmR: [0, 0, 0],
    LowerArmL: [0, 0, 0],
    LowerArmR: [0, 0, 0],
  };
  const cheer: QuaternionPose = {
    ...rest,
    ShoulderL: [0, 0, -0.28],
    ShoulderR: [0, 0, 0.28],
    UpperArmL: [0, 0, -2.15],
    UpperArmR: [0, 0, 2.15],
    LowerArmL: [0, 0, -0.25],
    LowerArmR: [0, 0, 0.25],
  };
  const clapOpen: QuaternionPose = {
    ...rest,
    UpperArmL: [0.15, -0.2, -1.05],
    UpperArmR: [0.15, 0.2, 1.05],
    LowerArmL: [0, 0.9, -1.05],
    LowerArmR: [0, -0.9, 1.05],
  };
  const clapClosed: QuaternionPose = {
    ...clapOpen,
    UpperArmL: [0.15, -0.42, -1.18],
    UpperArmR: [0.15, 0.42, 1.18],
    LowerArmL: [0, 1.2, -1.25],
    LowerArmR: [0, -1.2, 1.25],
  };
  const bow: QuaternionPose = {
    ...rest,
    Torso: [0.72, 0, 0],
    UpperArmL: [-0.18, 0, -0.12],
    UpperArmR: [-0.18, 0, 0.12],
  };

  return [
    createPoseClip(
      "Cheer",
      1.8,
      [0, 0.28, 0.62, 1.18, 1.8],
      [rest, cheer, cheer, cheer, rest],
      scene,
      idleClip,
    ),
    createPoseClip(
      "Clap",
      2,
      [0, 0.3, 0.48, 0.66, 0.84, 1.02, 1.2, 1.38, 1.7, 2],
      [
        rest,
        clapOpen,
        clapClosed,
        clapOpen,
        clapClosed,
        clapOpen,
        clapClosed,
        clapOpen,
        clapOpen,
        rest,
      ],
      scene,
      idleClip,
    ),
    createPoseClip(
      "Bow",
      2,
      [0, 0.45, 1.3, 2],
      [rest, bow, bow, rest],
      scene,
      idleClip,
    ),
  ];
}
