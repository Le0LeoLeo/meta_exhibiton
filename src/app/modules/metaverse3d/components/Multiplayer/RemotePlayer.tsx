import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AvatarModel } from "../../avatar/AvatarModel";
import { AvatarModelBoundary } from "../../avatar/AvatarModelBoundary";
import { AVATAR_MANIFEST } from "../../avatar/avatarManifest";
import {
  ProceduralAvatarFallback,
  type ProceduralAvatarFallbackHandle,
} from "../../avatar/ProceduralAvatarFallback";
import type { RemotePlayerState } from "../../network/multiplayerStore";
import {
  getRemoteAppearanceKey,
  getRemoteAvatarPalette,
  getRemotePlayerTransform,
  updateRemoteAvatarMotion,
} from "./remotePlayerAppearance";

type RemotePlayerProps = {
  player: RemotePlayerState;
};

const SHARED_GEOMETRIES = {
  groundRing: new THREE.RingGeometry(0.18, 0.31, 28),
  nameplate: new THREE.PlaneGeometry(1.05, 0.28),
};
const AVATAR_SPEED_PUBLISH_DELTA = 0.12;
const AVATAR_WALK_START_SPEED = 0.14;
const AVATAR_WALK_STOP_SPEED = 0.07;

export function RemotePlayer({ player }: RemotePlayerProps) {
  const transform = useMemo(
    () => getRemotePlayerTransform(player),
    [
      player.renderPosition.x,
      player.renderPosition.y,
      player.renderPosition.z,
      player.renderYaw,
    ],
  );
  const appearanceKey = useMemo(
    () => getRemoteAppearanceKey(player.appearance),
    [player.appearance],
  );
  const fallbackRef = useRef<ProceduralAvatarFallbackHandle>(null);
  const latestPositionRef = useRef(
    new THREE.Vector3(
      player.renderPosition.x,
      player.renderPosition.y,
      player.renderPosition.z,
    ),
  );
  const previousPositionRef = useRef(latestPositionRef.current.clone());
  const smoothedSpeedRef = useRef(0);
  const publishedSpeedRef = useRef(0);
  const [avatarSpeed, setAvatarSpeed] = useState(0);
  const motionPoseRef = useRef({
    armSwing: 0,
    legSwing: 0,
    bob: 0,
    lean: 0,
  });
  const palette = useMemo(
    () => getRemoteAvatarPalette(player.id),
    [player.id],
  );

  latestPositionRef.current.set(
    player.renderPosition.x,
    player.renderPosition.y,
    player.renderPosition.z,
  );

  useFrame(({ clock }, delta) => {
    const frameDelta = Math.max(delta, 1 / 120);
    const travelled = latestPositionRef.current.distanceTo(
      previousPositionRef.current,
    );
    previousPositionRef.current.copy(latestPositionRef.current);

    const sampledSpeed = Math.min(4, travelled / frameDelta);
    const smoothing = 1 - Math.exp(-frameDelta * 10);
    smoothedSpeedRef.current = THREE.MathUtils.lerp(
      smoothedSpeedRef.current,
      sampledSpeed,
      smoothing,
    );
    const previousPublishedSpeed = publishedSpeedRef.current;
    const nextSpeed = smoothedSpeedRef.current;
    const crossedWalkStart =
      previousPublishedSpeed < AVATAR_WALK_START_SPEED &&
      nextSpeed >= AVATAR_WALK_START_SPEED;
    const crossedWalkStop =
      previousPublishedSpeed >= AVATAR_WALK_STOP_SPEED &&
      nextSpeed < AVATAR_WALK_STOP_SPEED;
    if (
      crossedWalkStart ||
      crossedWalkStop ||
      Math.abs(nextSpeed - previousPublishedSpeed) >=
        AVATAR_SPEED_PUBLISH_DELTA
    ) {
      publishedSpeedRef.current = nextSpeed;
      setAvatarSpeed(nextSpeed);
    }

    const pose = updateRemoteAvatarMotion(
      motionPoseRef.current,
      clock.getElapsedTime(),
      smoothedSpeedRef.current,
    );
    fallbackRef.current?.applyMotion(pose);
  });

  const fallback = (
    <ProceduralAvatarFallback ref={fallbackRef} palette={palette} />
  );

  return (
    <group
      name={`remote-player-${player.id}`}
      position={transform.position}
      rotation={transform.rotation}
    >
      {AVATAR_MANIFEST.assetReady ? (
        <Suspense fallback={fallback}>
          <AvatarModelBoundary
            fallback={fallback}
            resetKey={`${player.id}:${appearanceKey}`}
          >
            <AvatarModel
              appearance={player.appearance}
              speed={avatarSpeed}
              emote="none"
              playerSeed={player.id}
              castShadow
            />
          </AvatarModelBoundary>
        </Suspense>
      ) : fallback}

      <mesh
        name="remote-player-ground-ring"
        geometry={SHARED_GEOMETRIES.groundRing}
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial
          color={palette.accent}
          transparent
          opacity={0.58}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <Billboard name="remote-player-nameplate" position={[0, 2.02, 0]}>
        <mesh geometry={SHARED_GEOMETRIES.nameplate} position={[0, 0, -0.015]}>
          <meshBasicMaterial
            color="#0f172a"
            transparent
            opacity={0.76}
            depthWrite={false}
          />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.16}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          outlineColor="#020617"
          outlineWidth={0.025}
        >
          {player.nickname}
        </Text>
      </Billboard>
    </group>
  );
}
