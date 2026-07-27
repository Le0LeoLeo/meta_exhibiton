import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { Group } from "three";
import * as THREE from "three";

const PROCEDURAL_AVATAR_BASE_Y = 0.73;

const SHARED_GEOMETRIES = {
  torso: new THREE.CapsuleGeometry(0.22, 0.38, 3, 10),
  hips: new THREE.CapsuleGeometry(0.17, 0.08, 2, 8),
  limb: new THREE.CapsuleGeometry(0.065, 0.3, 2, 8),
  leg: new THREE.CapsuleGeometry(0.075, 0.32, 2, 8),
  hand: new THREE.SphereGeometry(0.075, 10, 8),
  head: new THREE.SphereGeometry(0.18, 16, 12),
  ear: new THREE.SphereGeometry(0.045, 8, 6),
  eye: new THREE.SphereGeometry(0.018, 8, 6),
  nose: new THREE.SphereGeometry(0.027, 8, 6),
  neck: new THREE.CylinderGeometry(0.065, 0.075, 0.12, 10),
  shoe: new THREE.BoxGeometry(0.15, 0.1, 0.25),
  badge: new THREE.BoxGeometry(0.1, 0.14, 0.018),
  hair: new THREE.SphereGeometry(0.185, 16, 10),
  shirtInsert: new THREE.SphereGeometry(0.22, 12, 8),
};

export type ProceduralAvatarFallbackHandle = {
  applyMotion: (pose: Readonly<{
    armSwing: number;
    legSwing: number;
    bob: number;
    lean: number;
  }>) => void;
};

type ProceduralAvatarFallbackProps = {
  palette: {
    jacket: string;
    shirt: string;
    trousers: string;
    shoes: string;
    accent: string;
    hair: string;
    skin: string;
  };
};

export const ProceduralAvatarFallback = forwardRef<
  ProceduralAvatarFallbackHandle,
  ProceduralAvatarFallbackProps
>(function ProceduralAvatarFallback({ palette }, forwardedRef) {
  const motionRootRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  useImperativeHandle(forwardedRef, () => ({
    applyMotion(pose) {
      if (motionRootRef.current) {
        motionRootRef.current.position.y =
          PROCEDURAL_AVATAR_BASE_Y + pose.bob;
        motionRootRef.current.rotation.x = pose.lean;
      }
      if (leftArmRef.current) leftArmRef.current.rotation.x = pose.armSwing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -pose.armSwing;
      if (leftLegRef.current) leftLegRef.current.rotation.x = pose.legSwing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -pose.legSwing;
    },
  }), []);

  return (
    <group ref={motionRootRef} position={[0, PROCEDURAL_AVATAR_BASE_Y, 0]}>
      <group ref={leftLegRef} position={[-0.105, -0.2, 0]}>
        <mesh
          geometry={SHARED_GEOMETRIES.leg}
          position={[0, -0.22, 0]}
          castShadow
        >
          <meshStandardMaterial color={palette.trousers} roughness={0.8} />
        </mesh>
        <mesh
          geometry={SHARED_GEOMETRIES.shoe}
          position={[0, -0.48, -0.035]}
          castShadow
        >
          <meshStandardMaterial color={palette.shoes} roughness={0.72} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.105, -0.2, 0]}>
        <mesh
          geometry={SHARED_GEOMETRIES.leg}
          position={[0, -0.22, 0]}
          castShadow
        >
          <meshStandardMaterial color={palette.trousers} roughness={0.8} />
        </mesh>
        <mesh
          geometry={SHARED_GEOMETRIES.shoe}
          position={[0, -0.48, -0.035]}
          castShadow
        >
          <meshStandardMaterial color={palette.shoes} roughness={0.72} />
        </mesh>
      </group>

      <mesh
        geometry={SHARED_GEOMETRIES.hips}
        position={[0, -0.12, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.trousers} roughness={0.78} />
      </mesh>
      <mesh
        geometry={SHARED_GEOMETRIES.torso}
        position={[0, 0.24, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.jacket} roughness={0.68} />
      </mesh>
      <mesh
        geometry={SHARED_GEOMETRIES.shirtInsert}
        position={[0, 0.37, -0.205]}
        scale={[0.48, 0.3, 0.08]}
      >
        <meshStandardMaterial color={palette.shirt} roughness={0.78} />
      </mesh>

      <group ref={leftArmRef} position={[-0.235, 0.43, 0]}>
        <mesh
          geometry={SHARED_GEOMETRIES.limb}
          position={[0, -0.21, 0]}
          castShadow
        >
          <meshStandardMaterial color={palette.jacket} roughness={0.7} />
        </mesh>
        <mesh
          geometry={SHARED_GEOMETRIES.hand}
          position={[0, -0.43, 0]}
          castShadow
        >
          <meshStandardMaterial color={palette.skin} roughness={0.72} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.235, 0.43, 0]}>
        <mesh
          geometry={SHARED_GEOMETRIES.limb}
          position={[0, -0.21, 0]}
          castShadow
        >
          <meshStandardMaterial color={palette.jacket} roughness={0.7} />
        </mesh>
        <mesh
          geometry={SHARED_GEOMETRIES.hand}
          position={[0, -0.43, 0]}
          castShadow
        >
          <meshStandardMaterial color={palette.skin} roughness={0.72} />
        </mesh>
      </group>

      <mesh
        geometry={SHARED_GEOMETRIES.neck}
        position={[0, 0.66, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.skin} roughness={0.72} />
      </mesh>
      <mesh
        geometry={SHARED_GEOMETRIES.head}
        position={[0, 0.82, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.skin} roughness={0.7} />
      </mesh>
      <mesh
        geometry={SHARED_GEOMETRIES.hair}
        position={[0, 0.91, 0.015]}
        scale={[1.02, 0.56, 1.02]}
        castShadow
      >
        <meshStandardMaterial color={palette.hair} roughness={0.9} />
      </mesh>
      <mesh geometry={SHARED_GEOMETRIES.ear} position={[-0.176, 0.82, 0]}>
        <meshStandardMaterial color={palette.skin} roughness={0.74} />
      </mesh>
      <mesh geometry={SHARED_GEOMETRIES.ear} position={[0.176, 0.82, 0]}>
        <meshStandardMaterial color={palette.skin} roughness={0.74} />
      </mesh>
      <mesh geometry={SHARED_GEOMETRIES.eye} position={[-0.061, 0.84, -0.164]}>
        <meshStandardMaterial color="#111827" roughness={0.48} />
      </mesh>
      <mesh geometry={SHARED_GEOMETRIES.eye} position={[0.061, 0.84, -0.164]}>
        <meshStandardMaterial color="#111827" roughness={0.48} />
      </mesh>
      <mesh geometry={SHARED_GEOMETRIES.nose} position={[0, 0.79, -0.183]}>
        <meshStandardMaterial color={palette.skin} roughness={0.76} />
      </mesh>
      <mesh geometry={SHARED_GEOMETRIES.badge} position={[0, 0.25, -0.235]}>
        <meshStandardMaterial
          color={palette.accent}
          emissive={palette.accent}
          emissiveIntensity={0.14}
          roughness={0.62}
        />
      </mesh>
    </group>
  );
});
