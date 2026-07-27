import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import type { RenderPerformanceProfile } from "../performanceProfile";

type VisitorMode = RenderPerformanceProfile["effectiveMode"];

export interface GalleryVisitorLayout {
  id: string;
  position: [number, number, number];
  rotationY: number;
  motionPhase: number;
  palette: "charcoal" | "stone";
}

const VISITORS: readonly GalleryVisitorLayout[] = [
  {
    id: "visitor-west",
    position: [-2.7, 0, -6],
    rotationY: Math.PI * 0.46,
    motionPhase: 0.7,
    palette: "charcoal",
  },
  {
    id: "visitor-east",
    position: [2.8, 0, -13],
    rotationY: -Math.PI * 0.42,
    motionPhase: 3.4,
    palette: "stone",
  },
];

export function getGalleryVisitorLayout(mode: VisitorMode): GalleryVisitorLayout[] {
  if (mode === "performance") return [];
  return VISITORS.slice(0, mode === "quality" ? 2 : 1).map((visitor) => ({
    ...visitor,
    position: [...visitor.position],
  }));
}

function VisitorSilhouette({
  visitor,
  allowMotion,
  castShadow,
}: {
  visitor: GalleryVisitorLayout;
  allowMotion: boolean;
  castShadow: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const coatColor = visitor.palette === "charcoal" ? "#34383b" : "#77736c";
  const trouserColor = visitor.palette === "charcoal" ? "#24272a" : "#4d5052";

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (!allowMotion) {
      groupRef.current.position.y = 0;
      groupRef.current.rotation.z = 0;
      return;
    }
    const phase = clock.elapsedTime * 0.55 + visitor.motionPhase;
    groupRef.current.position.y = Math.sin(phase) * 0.006;
    groupRef.current.rotation.z = Math.sin(phase * 0.7) * 0.008;
  });

  return (
    <group
      ref={groupRef}
      position={visitor.position}
      rotation={[0, visitor.rotationY, 0]}
      userData={{ decorative: true, galleryVisitorId: visitor.id }}
    >
      <mesh castShadow={castShadow} position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.105, 16, 12]} />
        <meshStandardMaterial color="#b8a28f" roughness={0.88} metalness={0} />
      </mesh>
      <mesh castShadow={castShadow} position={[0, 1.18, 0]}>
        <capsuleGeometry args={[0.18, 0.48, 5, 10]} />
        <meshStandardMaterial color={coatColor} roughness={0.92} metalness={0} />
      </mesh>
      {[-0.095, 0.095].map((x) => (
        <mesh key={`leg-${x}`} castShadow={castShadow} position={[x, 0.48, 0]}>
          <capsuleGeometry args={[0.065, 0.58, 4, 8]} />
          <meshStandardMaterial color={trouserColor} roughness={0.94} metalness={0} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`arm-${side}`}
          castShadow={castShadow}
          position={[side * 0.225, 1.18, 0]}
          rotation={[0, 0, side * 0.08]}
        >
          <capsuleGeometry args={[0.045, 0.48, 4, 8]} />
          <meshStandardMaterial color={coatColor} roughness={0.92} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

export function GalleryVisitors({
  mode,
  allowMotion,
}: {
  mode: VisitorMode;
  allowMotion: boolean;
}) {
  const visitors = getGalleryVisitorLayout(mode);
  return (
    <>
      {visitors.map((visitor) => (
        <VisitorSilhouette
          key={visitor.id}
          visitor={visitor}
          allowMotion={allowMotion}
          castShadow={mode === "quality"}
        />
      ))}
    </>
  );
}
