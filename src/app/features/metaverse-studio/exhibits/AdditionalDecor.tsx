import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

import { BeveledBox } from "../../../modules/metaverse3d/components/geometry/BeveledBox";
import { useRuntimeInteractionStore } from "../../../modules/metaverse3d/interaction/runtimeInteractionStore";
import type { ExhibitRendererProps } from "./exhibitRegistry";

function SelectionBounds({
  visible,
  size,
  position,
}: {
  visible: boolean;
  size: [number, number, number];
  position: [number, number, number];
}) {
  if (!visible) return null;
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color="#818cf8" />
    </mesh>
  );
}

function UpholsteryMaterial({ color }: { color: string }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.68}
      metalness={0.01}
    />
  );
}

export function ChairDecor({
  item,
  isSelected,
  quality,
}: ExhibitRendererProps) {
  const upholstery = item.content || "#8b6f5a";
  return (
    <group>
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
        dimensions={[0.72, 0.14, 0.68]}
        bevelRadius={0.045}
        position={[0, 0.49, 0]}
        castShadow={quality.castShadows}
        receiveShadow={quality.castShadows}
      >
        <UpholsteryMaterial color={upholstery} />
      </BeveledBox>
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
        dimensions={[0.72, 0.68, 0.13]}
        bevelRadius={0.05}
        position={[0, 0.86, -0.28]}
        rotation={[-0.08, 0, 0]}
        castShadow={quality.castShadows}
      >
        <UpholsteryMaterial color={upholstery} />
      </BeveledBox>
      {[-0.27, 0.27].map((x) =>
        [-0.24, 0.24].map((z) => (
          <mesh
            key={`${x}:${z}`}
            position={[x, 0.23, z]}
            castShadow={quality.castShadows}
          >
            <cylinderGeometry args={[0.035, 0.045, 0.46, quality.radialSegments]} />
            <meshStandardMaterial color="#5a4637" roughness={0.52} metalness={0.06} />
          </mesh>
        )),
      )}
      <SelectionBounds visible={isSelected} size={[0.82, 1.28, 0.82]} position={[0, 0.64, 0]} />
    </group>
  );
}

export function SofaDecor({
  item,
  isSelected,
  quality,
}: ExhibitRendererProps) {
  const upholstery = item.content || "#64748b";
  return (
    <group>
      {[-0.74, 0.74].flatMap((x) => [-0.25, 0.25].map((z) => (
        <mesh key={`${x}:${z}`} position={[x, 0.12, z]} castShadow={quality.castShadows}>
          <cylinderGeometry args={[0.045, 0.035, 0.24, 12]} />
          <meshStandardMaterial color="#36302b" roughness={0.48} metalness={0.15} />
        </mesh>
      )))}
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
        dimensions={[1.85, 0.3, 0.78]}
        bevelRadius={0.09}
        position={[0, 0.36, 0]}
        castShadow={quality.castShadows}
        receiveShadow={quality.castShadows}
      >
        <UpholsteryMaterial color={upholstery} />
      </BeveledBox>
      {[-0.47, 0.47].map((x) => (
        <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
          key={x}
          dimensions={[0.82, 0.14, 0.64]}
          bevelRadius={0.055}
          position={[x, 0.59, 0.06]}
          castShadow={quality.castShadows}
        >
          <UpholsteryMaterial color={new THREE.Color(upholstery).offsetHSL(0, -0.02, 0.06).getStyle()} />
        </BeveledBox>
      ))}
      {[-0.47, 0.47].map((x) => (
        <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
          key={`back:${x}`}
          dimensions={[0.86, 0.56, 0.18]}
          bevelRadius={0.065}
          position={[x, 0.91, -0.3]}
          rotation={[-0.07, 0, 0]}
          castShadow={quality.castShadows}
        >
          <UpholsteryMaterial color={upholstery} />
        </BeveledBox>
      ))}
      {[-0.88, 0.88].map((x) => (
        <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
          key={`arm:${x}`}
          dimensions={[0.18, 0.48, 0.76]}
          bevelRadius={0.065}
          position={[x, 0.62, 0]}
          castShadow={quality.castShadows}
        >
          <UpholsteryMaterial color={upholstery} />
        </BeveledBox>
      ))}
      <SelectionBounds visible={isSelected} size={[2.05, 1.35, 0.94]} position={[0, 0.67, 0]} />
    </group>
  );
}

export function FloorLampDecor({
  item,
  isSelected,
  quality,
}: ExhibitRendererProps) {
  const runtimeValue = useRuntimeInteractionStore(
    (state) => state.activeByItemId[item.id],
  );
  const isOn = runtimeValue ?? true;
  const lightColor = item.content || "#ffd58a";

  return (
    <group>
      <mesh position={[0, 0.06, 0]} castShadow={quality.castShadows}>
        <cylinderGeometry args={[0.25, 0.29, 0.12, quality.radialSegments]} />
        <meshStandardMaterial color="#25282d" roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow={quality.castShadows}>
        <cylinderGeometry args={[0.035, 0.045, 1.52, quality.radialSegments]} />
        <meshStandardMaterial color="#343941" roughness={0.24} metalness={0.78} />
      </mesh>
      <mesh position={[0, 1.63, 0]} castShadow={quality.castShadows}>
        <cylinderGeometry args={[0.19, 0.34, 0.48, quality.radialSegments, 1, true]} />
        <meshPhysicalMaterial
          color={isOn ? lightColor : "#b7aa94"}
          emissive={isOn ? lightColor : "#000000"}
          emissiveIntensity={isOn ? 0.45 : 0}
          roughness={0.58}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <sphereGeometry args={[0.09, quality.sphereSegments, quality.sphereSegments]} />
        <meshStandardMaterial
          color={isOn ? lightColor : "#d6d3d1"}
          emissive={isOn ? lightColor : "#000000"}
          emissiveIntensity={isOn ? 3 : 0}
          toneMapped={!isOn}
        />
      </mesh>
      {quality.decorativeLights && isOn && (
        <pointLight color={lightColor} intensity={2.1} distance={5.5} decay={2.2} position={[0, 1.5, 0]} />
      )}
      <SelectionBounds visible={isSelected} size={[0.78, 1.94, 0.78]} position={[0, 0.96, 0]} />
    </group>
  );
}

export function CabinetDecor({
  item,
  isSelected,
  quality,
}: ExhibitRendererProps) {
  const leftDoor = useRef<THREE.Group>(null);
  const rightDoor = useRef<THREE.Group>(null);
  const runtimeValue = useRuntimeInteractionStore(
    (state) => state.activeByItemId[item.id],
  );
  const isOpen = runtimeValue ?? false;
  const woodColor = item.content || "#806044";

  useFrame((_, delta) => {
    const target = isOpen ? Math.PI * 0.62 : 0;
    if (leftDoor.current) {
      leftDoor.current.rotation.y = THREE.MathUtils.damp(leftDoor.current.rotation.y, -target, 8, delta);
    }
    if (rightDoor.current) {
      rightDoor.current.rotation.y = THREE.MathUtils.damp(rightDoor.current.rotation.y, target, 8, delta);
    }
  });

  return (
    <group>
      {[
        { size: [1.05, 1.5, 0.045], at: [0, 0.79, -0.24] },
        ...[-0.5, 0.5].map((x) => ({ size: [0.05, 1.5, 0.52], at: [x, 0.79, 0] })),
        ...[0.065, 0.55, 1.02, 1.515].map((y) => ({ size: [1, 0.05, 0.52], at: [0, y, 0] })),
      ].map(({ size, at }, index) => (
        <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} key={index} dimensions={size as [number, number, number]} position={at as [number, number, number]} bevelRadius={0.008} castShadow={quality.castShadows} receiveShadow={quality.castShadows}>
          <meshStandardMaterial color={woodColor} roughness={0.48} />
        </BeveledBox>
      ))}
      {[-0.4, 0.4].flatMap((x) => [-0.18, 0.18].map((z) => (
        <mesh key={`leg:${x}:${z}`} position={[x, 0.04, z]} castShadow={quality.castShadows}>
          <cylinderGeometry args={[0.035, 0.05, 0.08, quality.radialSegments]} />
          <meshStandardMaterial color="#2f3034" roughness={0.3} metalness={0.72} />
        </mesh>
      )))}
      <group ref={leftDoor} position={[-0.5, 0.82, 0.275]}>
        <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} dimensions={[0.5, 1.32, 0.055]} bevelRadius={0.025} position={[0.25, 0, 0]} castShadow={quality.castShadows}>
          <meshStandardMaterial color={new THREE.Color(woodColor).offsetHSL(0, 0, 0.06)} roughness={0.44} metalness={0.03} />
        </BeveledBox>
        <mesh position={[0.43, 0, 0.045]}>
          <sphereGeometry args={[0.035, 12, 8]} />
          <meshStandardMaterial color="#d0b06f" roughness={0.22} metalness={0.76} />
        </mesh>
      </group>
      <group ref={rightDoor} position={[0.5, 0.82, 0.275]}>
        <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} dimensions={[0.5, 1.32, 0.055]} bevelRadius={0.025} position={[-0.25, 0, 0]} castShadow={quality.castShadows}>
          <meshStandardMaterial color={new THREE.Color(woodColor).offsetHSL(0, 0, 0.03)} roughness={0.44} metalness={0.03} />
        </BeveledBox>
        <mesh position={[-0.43, 0, 0.045]}>
          <sphereGeometry args={[0.035, 12, 8]} />
          <meshStandardMaterial color="#d0b06f" roughness={0.22} metalness={0.76} />
        </mesh>
      </group>
      <SelectionBounds visible={isSelected} size={[1.18, 1.7, 0.72]} position={[0, 0.84, 0]} />
    </group>
  );
}

export function TurntableDecor({
  item,
  isSelected,
  quality,
}: ExhibitRendererProps) {
  const recordRef = useRef<THREE.Group>(null);
  const runtimeValue = useRuntimeInteractionStore(
    (state) => state.activeByItemId[item.id],
  );
  const isPlaying = runtimeValue ?? false;
  const caseColor = item.content || "#b58b5f";

  useFrame((_, delta) => {
    if (isPlaying && recordRef.current) recordRef.current.rotation.y += delta * 2.2;
  });

  return (
    <group>
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
        dimensions={[1.08, 0.18, 0.82]}
        bevelRadius={0.055}
        position={[0, 0.12, 0]}
        castShadow={quality.castShadows}
        receiveShadow={quality.castShadows}
      >
        <meshPhysicalMaterial color={caseColor} roughness={0.46} clearcoat={0.3} clearcoatRoughness={0.42} />
      </BeveledBox>
      <group ref={recordRef} position={[-0.1, 0.225, 0]}>
        <mesh>
          <cylinderGeometry args={[0.31, 0.31, 0.025, quality.radialSegments]} />
          <meshStandardMaterial color="#111217" roughness={0.34} metalness={0.18} />
        </mesh>
        <mesh position={[0, 0.017, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.03, quality.radialSegments]} />
          <meshStandardMaterial color="#dc5f55" roughness={0.6} />
        </mesh>
        {[0.13, 0.2, 0.27].map((radius) => (
          <mesh key={radius} position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius, radius + 0.003, quality.ringSegments]} />
            <meshStandardMaterial color="#393a40" roughness={0.42} />
          </mesh>
        ))}
      </group>
      <group position={[0.35, 0.29, -0.18]} rotation={[0, -0.35, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.16]}>
          <cylinderGeometry args={[0.018, 0.018, 0.38, 10]} />
          <meshStandardMaterial color="#c4c8ce" roughness={0.2} metalness={0.86} />
        </mesh>
        <mesh position={[-0.04, -0.04, 0.33]}>
          <boxGeometry args={[0.08, 0.055, 0.11]} />
          <meshStandardMaterial color="#2f3339" roughness={0.34} metalness={0.54} />
        </mesh>
      </group>
      <mesh position={[0.41, 0.23, 0.26]}>
        <sphereGeometry args={[0.035, 12, 8]} />
        <meshStandardMaterial
          color={isPlaying ? "#4ade80" : "#64748b"}
          emissive={isPlaying ? "#22c55e" : "#000000"}
          emissiveIntensity={isPlaying ? 1.8 : 0}
        />
      </mesh>
      <SelectionBounds visible={isSelected} size={[1.2, 0.46, 0.94]} position={[0, 0.23, 0]} />
    </group>
  );
}

export function FountainDecor({
  item,
  isSelected,
  quality,
}: ExhibitRendererProps) {
  const waterRef = useRef<THREE.Mesh>(null);
  const rippleRef = useRef<THREE.Mesh>(null);
  const runtimeValue = useRuntimeInteractionStore(
    (state) => state.activeByItemId[item.id],
  );
  const isRunning = runtimeValue ?? false;
  const waterColor = item.content || "#45b8d8";

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (waterRef.current) {
      waterRef.current.visible = isRunning;
      waterRef.current.scale.y = 0.92 + Math.sin(elapsed * 4.5) * 0.08;
    }
    if (rippleRef.current) {
      rippleRef.current.visible = isRunning;
      const pulse = 1 + ((elapsed * 0.55) % 0.3);
      rippleRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <mesh position={[0, 0.18, 0]} castShadow={quality.castShadows} receiveShadow={quality.castShadows}>
        <cylinderGeometry args={[0.68, 0.76, 0.36, quality.radialSegments]} />
        <meshStandardMaterial color="#a5a19a" roughness={0.82} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow={quality.castShadows}>
        <torusGeometry args={[0.63, 0.065, 8, quality.ringSegments]} />
        <meshStandardMaterial color="#c4bfb5" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.08, quality.radialSegments]} />
        <meshStandardMaterial color={waterColor} roughness={0.12} metalness={0.25} transparent opacity={0.86} />
      </mesh>
      <mesh position={[0, 0.63, 0]} castShadow={quality.castShadows}>
        <cylinderGeometry args={[0.11, 0.2, 0.54, quality.radialSegments]} />
        <meshStandardMaterial color="#8e8a83" roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh ref={waterRef} visible={isRunning} position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.025, 0.055, 0.5, Math.max(8, quality.radialSegments / 2)]} />
        <meshPhysicalMaterial color={waterColor} emissive={waterColor} emissiveIntensity={0.24} transparent opacity={0.68} roughness={0.04} />
      </mesh>
      <mesh ref={rippleRef} visible={isRunning} position={[0, 0.415, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.21, quality.ringSegments]} />
        <meshBasicMaterial color="#d7f7ff" transparent opacity={0.52} depthWrite={false} />
      </mesh>
      <SelectionBounds visible={isSelected} size={[1.62, 1.18, 1.62]} position={[0, 0.58, 0]} />
    </group>
  );
}
