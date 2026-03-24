import { Billboard, Text } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SkeletonUtils } from "three-stdlib";
import type { RemotePlayerState } from "../../network/multiplayerStore";

type RemotePlayerProps = {
  player: RemotePlayerState;
};

const REMOTE_AVATAR_GLB = ((import.meta as any)?.env?.VITE_REMOTE_AVATAR_GLB as string | undefined)?.trim() || "";
const TARGET_AVATAR_HEIGHT = 1.75;

function normalizeAvatar(root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (Number.isFinite(size.y) && size.y > 0.001) {
    const scalar = TARGET_AVATAR_HEIGHT / size.y;
    root.scale.setScalar(scalar);
  } else {
    root.scale.setScalar(1);
  }

  root.traverse((obj) => {
    if ((obj as any).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          (m as THREE.Material).side = THREE.FrontSide;
        });
      } else if (mesh.material) {
        (mesh.material as THREE.Material).side = THREE.FrontSide;
      }
    }
  });
}

export function RemotePlayer({ player }: RemotePlayerProps) {
  const position = useMemo(
    () => [player.renderPosition.x, player.renderPosition.y - 1.3, player.renderPosition.z] as [number, number, number],
    [player.renderPosition.x, player.renderPosition.y, player.renderPosition.z],
  );

  const [avatarScene, setAvatarScene] = useState<THREE.Object3D | null>(null);
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!REMOTE_AVATAR_GLB) {
      setAvatarScene(null);
      return;
    }

    let cancelled = false;
    const loader = new GLTFLoader();

    loader.load(
      REMOTE_AVATAR_GLB,
      (gltf) => {
        if (cancelled) return;

        const cloned = SkeletonUtils.clone(gltf.scene);
        normalizeAvatar(cloned);
        setAvatarScene(cloned);

        if (!loggedRef.current) {
          loggedRef.current = true;
          console.info("[multiplayer] avatar loaded", { url: REMOTE_AVATAR_GLB });
        }
      },
      undefined,
      (error) => {
        if (cancelled) return;
        setAvatarScene(null);
        console.warn("[multiplayer] avatar load failed, fallback to capsule", {
          url: REMOTE_AVATAR_GLB,
          error,
        });
      },
    );

    return () => {
      cancelled = true;
      setAvatarScene(null);
    };
  }, []);

  return (
    <group position={position} rotation={[0, player.renderYaw, 0]}>
      {avatarScene ? (
        <primitive object={avatarScene} position={[0, -0.87, 0]} />
      ) : (
        <>
          <mesh castShadow>
            <capsuleGeometry args={[0.28, 0.85, 4, 8]} />
            <meshStandardMaterial color="#60a5fa" metalness={0.12} roughness={0.4} />
          </mesh>

          <mesh position={[0, 0.78, 0.22]} castShadow>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.1} roughness={0.45} />
          </mesh>
        </>
      )}

      <mesh position={[0, -0.57, 0.27]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.23, 24]} />
        <meshBasicMaterial color="#a7f3d0" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <Billboard position={[0, 1.32, 0]}>
        <Text fontSize={0.18} color="#e2e8f0" anchorX="center" anchorY="middle" outlineColor="#0f172a" outlineWidth={0.03}>
          {player.nickname}
        </Text>
      </Billboard>
    </group>
  );
}
