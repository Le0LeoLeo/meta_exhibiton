import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarAppearanceV1 } from "./avatarAppearance";
import {
  CASUAL_AVATAR_BASE_ASSETS,
  CASUAL_AVATAR_ASSETS,
  createCasualAvatarScene,
  disposeCasualAvatarScene,
} from "./casualAvatar";
import { AVATAR_MANIFEST } from "./avatarManifest";
import {
  selectAvatarAnimation,
  type AvatarAnimationName,
} from "./useAvatarAnimation";
import {
  createAvatarEmoteClips,
  type AvatarEmoteState,
} from "./avatarEmote";
import {
  createSittingAnimationClip,
  SITTING_ANIMATION_NAME,
  type AvatarPose,
} from "./avatarPose";

const ANIMATION_FADE_SECONDS = 0.18;
const MIN_WALK_TIME_SCALE = 0.7;
const MAX_WALK_TIME_SCALE = 1.35;
const REFERENCE_WALK_SPEED = 1.4;
const SIT_TRANSITION_SECONDS = 0.28;

export type AvatarModelProps = {
  appearance: AvatarAppearanceV1;
  speed: number;
  emote?: AvatarEmoteState;
  emoteNonce?: number;
  playerSeed: string;
  castShadow?: boolean;
  lockHeadFacing?: boolean;
  staticPose?: boolean;
  pose?: AvatarPose;
};

export function getAvatarAnimationPhase(playerSeed: string): number {
  let hash = 2166136261;
  for (const character of playerSeed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

export function getWalkAnimationTimeScale(speedMetersPerSecond: number): number {
  const safeSpeed = Number.isFinite(speedMetersPerSecond)
    ? Math.max(0, speedMetersPerSecond)
    : 0;
  return THREE.MathUtils.clamp(
    safeSpeed / REFERENCE_WALK_SPEED,
    MIN_WALK_TIME_SCALE,
    MAX_WALK_TIME_SCALE,
  );
}

export function getAvatarInitialIdleTime(
  duration: number,
  phase: number,
  staticPose: boolean,
): number {
  return staticPose ? 0 : phase * Math.max(duration, 0);
}

export function removeAvatarHeadScaleTracks(
  animations: THREE.AnimationClip[],
): THREE.AnimationClip[] {
  return animations.map((clip) => {
    const tracks = clip.tracks.filter(
      (track) =>
        track.name !== "Head.scale" &&
        !track.name.endsWith(".bones[Head].scale"),
    );
    if (tracks.length === clip.tracks.length) return clip;
    return new THREE.AnimationClip(
      clip.name,
      clip.duration,
      tracks.map((track) => track.clone()),
      clip.blendMode,
    );
  });
}

export function removeAvatarPreviewHeadMotionTracks(
  animations: THREE.AnimationClip[],
): THREE.AnimationClip[] {
  return removeAvatarHeadScaleTracks(animations).map((clip) => {
    const tracks = clip.tracks.filter(
      (track) =>
        ![
          "Head.position",
          "Head.quaternion",
          "Neck.position",
          "Neck.quaternion",
        ].includes(track.name),
    );
    if (tracks.length === clip.tracks.length) return clip;
    return new THREE.AnimationClip(
      clip.name,
      clip.duration,
      tracks.map((track) => track.clone()),
      clip.blendMode,
    );
  });
}

function getAction(
  actions: Partial<Record<string, THREE.AnimationAction | null>>,
  name: AvatarAnimationName,
) {
  return actions[name] ?? undefined;
}

function AvatarModelAnimations({
  animations,
  scene,
  speed,
  emote,
  emoteNonce,
  playerSeed,
  staticPose,
  pose,
}: {
  animations: THREE.AnimationClip[];
  scene: THREE.Object3D;
  speed: number;
  emote: AvatarEmoteState;
  emoteNonce: number;
  playerSeed: string;
  staticPose: boolean;
  pose: AvatarPose;
}) {
  const { actions, mixer } = useAnimations(animations, scene);
  const currentNameRef = useRef<AvatarAnimationName>("Idle");
  const previousEmoteNonceRef = useRef(0);
  const initializedActionsRef = useRef(new Set<THREE.AnimationAction>());
  const sittingRef = useRef(false);
  const phase = useMemo(() => getAvatarAnimationPhase(playerSeed), [playerSeed]);

  useEffect(() => {
    const idle = getAction(actions, "Idle");
    if (!idle || initializedActionsRef.current.has(idle)) return;

    idle.reset();
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.time = getAvatarInitialIdleTime(
      idle.getClip().duration,
      phase,
      staticPose,
    );
    idle.paused = staticPose;
    idle.play();
    initializedActionsRef.current.add(idle);
    currentNameRef.current = "Idle";
  }, [actions, phase, staticPose]);

  useEffect(() => {
    const sitting = actions[SITTING_ANIMATION_NAME];
    if (!sitting) return;

    const locomotion = getAction(actions, currentNameRef.current);
    if (pose === "sitting") {
      if (sittingRef.current) return;
      sittingRef.current = true;
      sitting.reset();
      sitting.setLoop(THREE.LoopRepeat, Infinity);
      sitting.clampWhenFinished = false;
      sitting.play();
      if (locomotion) {
        sitting.crossFadeFrom(locomotion, SIT_TRANSITION_SECONDS, true);
      } else {
        sitting.fadeIn(SIT_TRANSITION_SECONDS);
      }
      return;
    }

    if (!sittingRef.current) return;
    sittingRef.current = false;
    if (locomotion) {
      locomotion.reset();
      locomotion.setLoop(THREE.LoopRepeat, Infinity);
      locomotion.play();
      locomotion.crossFadeFrom(sitting, SIT_TRANSITION_SECONDS, true);
    } else {
      sitting.fadeOut(SIT_TRANSITION_SECONDS);
    }
  }, [actions, pose]);

  useEffect(() => {
    const currentName = currentNameRef.current;
    const requestedName = selectAvatarAnimation(speed, emote, currentName);
    const emoteWasRequested =
      emote !== "none" && emoteNonce !== previousEmoteNonceRef.current;
    previousEmoteNonceRef.current = emoteNonce;

    if (emote !== "none" && !emoteWasRequested) return;
    const replayingEmote =
      emoteWasRequested && requestedName === currentName;
    if (
      requestedName === currentName
      && requestedName !== "Walk"
      && !replayingEmote
    ) {
      return;
    }

    const previousAction = getAction(actions, currentName);
    const nextAction = getAction(actions, requestedName);
    if (!nextAction) return;

    if (requestedName === "Walk") {
      nextAction.setEffectiveTimeScale(getWalkAnimationTimeScale(speed));
    }

    if (emote !== "none") {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    }

    if (requestedName !== currentName || replayingEmote) {
      nextAction.reset();
      if (
        (requestedName === "Idle" || requestedName === "Walk") &&
        !initializedActionsRef.current.has(nextAction)
      ) {
        nextAction.time = phase * Math.max(nextAction.getClip().duration, 0);
        initializedActionsRef.current.add(nextAction);
      }
      nextAction.play();
      if (previousAction && previousAction !== nextAction) {
        nextAction.crossFadeFrom(previousAction, ANIMATION_FADE_SECONDS, true);
      } else if (!replayingEmote) {
        nextAction.fadeIn(ANIMATION_FADE_SECONDS);
      }
      currentNameRef.current = requestedName;
    }
  }, [actions, emote, emoteNonce, phase, speed]);

  useEffect(() => {
    const handleFinished = (event: { action: THREE.AnimationAction }) => {
      const finishedName = currentNameRef.current;
      if (finishedName === "Idle" || finishedName === "Walk") return;
      const finishedEmote = getAction(actions, finishedName);
      if (!finishedEmote || event.action !== finishedEmote) return;

      const locomotionName = selectAvatarAnimation(
        speed,
        "none",
        currentNameRef.current,
      );
      const nextName =
        locomotionName === "Idle" || locomotionName === "Walk"
          ? locomotionName
          : "Idle";
      const nextAction = getAction(actions, nextName);
      if (!nextAction) return;

      nextAction.reset();
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
      if (nextName === "Walk") {
        nextAction.setEffectiveTimeScale(getWalkAnimationTimeScale(speed));
      }
      if (!initializedActionsRef.current.has(nextAction)) {
        nextAction.time = phase * Math.max(nextAction.getClip().duration, 0);
        initializedActionsRef.current.add(nextAction);
      }
      nextAction.play();
      nextAction.crossFadeFrom(
        finishedEmote,
        ANIMATION_FADE_SECONDS,
        true,
      );
      currentNameRef.current = nextName;
    };

    mixer.addEventListener("finished", handleFinished);
    return () => mixer.removeEventListener("finished", handleFinished);
  }, [actions, mixer, phase, speed]);

  return null;
}

export function AvatarModel({
  appearance,
  speed,
  emote = "none",
  emoteNonce = 0,
  playerSeed,
  castShadow = true,
  lockHeadFacing = false,
  staticPose = false,
  pose = "standing",
}: AvatarModelProps) {
  const baseModelUrl = CASUAL_AVATAR_BASE_ASSETS[appearance.body];
  const hairModelUrl = CASUAL_AVATAR_ASSETS[appearance.body][appearance.hair];
  const baseModelGltf = useGLTF(baseModelUrl);
  const hairModelGltf = useGLTF(hairModelUrl);
  const configured = useMemo(
    () =>
      createCasualAvatarScene(
        baseModelGltf.scene,
        appearance,
        castShadow,
        hairModelGltf.scene,
      ),
    [appearance, baseModelGltf.scene, castShadow, hairModelGltf.scene],
  );
  const animations = useMemo(
    () =>
      lockHeadFacing
        ? removeAvatarPreviewHeadMotionTracks(baseModelGltf.animations)
        : removeAvatarHeadScaleTracks(baseModelGltf.animations),
    [baseModelGltf.animations, lockHeadFacing],
  );
  const animationsWithSitting = useMemo(
    () => [
      ...animations,
      ...createAvatarEmoteClips(
        configured.scene,
        animations.find((clip) => clip.name === "Idle"),
      ),
      createSittingAnimationClip(
        configured.scene,
        animations.find((clip) => clip.name === "Idle"),
      ),
    ],
    [animations, configured.scene],
  );

  useEffect(
    () => () => disposeCasualAvatarScene(configured),
    [configured],
  );

  return (
    <>
      <AvatarModelAnimations
        key={configured.scene.uuid}
        animations={animationsWithSitting}
        scene={configured.scene}
        speed={speed}
        emote={emote}
        emoteNonce={emoteNonce}
        playerSeed={playerSeed}
        staticPose={staticPose}
        pose={pose}
      />
      <primitive object={configured.scene} dispose={null} />
    </>
  );
}

if (AVATAR_MANIFEST.assetReady) {
  Object.values(CASUAL_AVATAR_ASSETS).forEach((body) =>
    Object.values(body).forEach((url) => useGLTF.preload(url)),
  );
}
