import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarAppearanceV1 } from "./avatarAppearance";
import {
  createConfiguredAvatarScene,
  disposeConfiguredAvatarScene,
} from "./configureAvatarScene";
import { AVATAR_MANIFEST } from "./avatarManifest";
import {
  selectAvatarAnimation,
  type AvatarAnimationName,
  type AvatarEmote,
} from "./useAvatarAnimation";

const ANIMATION_FADE_SECONDS = 0.18;
const MIN_WALK_TIME_SCALE = 0.7;
const MAX_WALK_TIME_SCALE = 1.35;
const REFERENCE_WALK_SPEED = 1.4;

export type AvatarModelProps = {
  appearance: AvatarAppearanceV1;
  speed: number;
  emote?: AvatarEmote;
  playerSeed: string;
  castShadow?: boolean;
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
  playerSeed,
}: {
  animations: THREE.AnimationClip[];
  scene: THREE.Object3D;
  speed: number;
  emote: AvatarEmote;
  playerSeed: string;
}) {
  const { actions, mixer } = useAnimations(animations, scene);
  const currentNameRef = useRef<AvatarAnimationName>("Idle");
  const previousEmoteRef = useRef<AvatarEmote>("none");
  const initializedActionsRef = useRef(new Set<THREE.AnimationAction>());
  const phase = useMemo(() => getAvatarAnimationPhase(playerSeed), [playerSeed]);

  useEffect(() => {
    const idle = getAction(actions, "Idle");
    if (!idle || initializedActionsRef.current.has(idle)) return;

    idle.reset();
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.time = phase * Math.max(idle.getClip().duration, 0);
    idle.play();
    initializedActionsRef.current.add(idle);
    currentNameRef.current = "Idle";
  }, [actions, phase]);

  useEffect(() => {
    const currentName = currentNameRef.current;
    const requestedName = selectAvatarAnimation(speed, emote, currentName);
    const waveWasRequested =
      emote === "wave" && previousEmoteRef.current !== "wave";
    previousEmoteRef.current = emote;

    if (requestedName === "Wave" && !waveWasRequested) return;
    if (requestedName === currentName && requestedName !== "Walk") return;

    const previousAction = getAction(actions, currentName);
    const nextAction = getAction(actions, requestedName);
    if (!nextAction) return;

    if (requestedName === "Walk") {
      nextAction.setEffectiveTimeScale(getWalkAnimationTimeScale(speed));
    }

    if (requestedName === "Wave") {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    }

    if (requestedName !== currentName) {
      nextAction.reset();
      if (
        (requestedName === "Idle" || requestedName === "Walk") &&
        !initializedActionsRef.current.has(nextAction)
      ) {
        nextAction.time = phase * Math.max(nextAction.getClip().duration, 0);
        initializedActionsRef.current.add(nextAction);
      }
      nextAction.play();
      if (previousAction) {
        nextAction.crossFadeFrom(previousAction, ANIMATION_FADE_SECONDS, true);
      } else {
        nextAction.fadeIn(ANIMATION_FADE_SECONDS);
      }
      currentNameRef.current = requestedName;
    }
  }, [actions, emote, phase, speed]);

  useEffect(() => {
    const handleFinished = (event: { action: THREE.AnimationAction }) => {
      const wave = getAction(actions, "Wave");
      if (!wave || event.action !== wave) return;

      const locomotionName = selectAvatarAnimation(
        speed,
        "none",
        currentNameRef.current,
      );
      const nextName = locomotionName === "Wave" ? "Idle" : locomotionName;
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
      nextAction.crossFadeFrom(wave, ANIMATION_FADE_SECONDS, true);
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
  playerSeed,
  castShadow = true,
}: AvatarModelProps) {
  const gltf = useGLTF(AVATAR_MANIFEST.modelUrl);
  const configured = useMemo(
    () => createConfiguredAvatarScene(gltf.scene, appearance),
    [appearance, gltf.scene],
  );

  useEffect(() => {
    configured.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = castShadow;
    });
  }, [castShadow, configured.scene]);

  useEffect(
    () => () => disposeConfiguredAvatarScene(configured),
    [configured],
  );

  return (
    <>
      <AvatarModelAnimations
        animations={gltf.animations}
        scene={configured.scene}
        speed={speed}
        emote={emote}
        playerSeed={playerSeed}
      />
      <primitive object={configured.scene} dispose={null} />
    </>
  );
}

if (AVATAR_MANIFEST.assetReady) {
  useGLTF.preload(AVATAR_MANIFEST.modelUrl);
}
