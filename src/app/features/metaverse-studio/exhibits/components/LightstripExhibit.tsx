import { Edges } from "@react-three/drei";

import type { ExhibitRendererProps } from "../exhibitRegistry";

export function LightstripExhibit({ item, isSelected }: ExhibitRendererProps) {
  const lightColor = item.content || "#ffe08a";
  const lightIntensity = item.lightIntensity ?? 0.5;

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.51]}>
        <planeGeometry args={[0.88, 0.3]} />
        <meshBasicMaterial color={lightColor} transparent opacity={0.3} />
      </mesh>
      <pointLight
        color={lightColor}
        intensity={lightIntensity}
        distance={2.6 + lightIntensity * 1.8}
        decay={2.6}
        position={[0, 0, 0.68]}
      />
      {isSelected && <Edges scale={1.02} color="#f59e0b" />}
    </group>
  );
}
