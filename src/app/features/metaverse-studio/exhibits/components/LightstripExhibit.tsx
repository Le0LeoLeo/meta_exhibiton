import { Edges } from "@react-three/drei";
import * as THREE from "three";

import { BeveledBox } from "../../../../modules/metaverse3d/components/geometry/BeveledBox";
import { useRuntimeInteractionStore } from "../../../../modules/metaverse3d/interaction/runtimeInteractionStore";
import type { ExhibitRendererProps } from "../exhibitRegistry";

const SOFT_GLOW_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SOFT_GLOW_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    vec2 centered = vUv - 0.5;
    float horizontalFade = 1.0 - smoothstep(0.28, 0.5, abs(centered.x));
    float verticalFade = 1.0 - smoothstep(0.02, 0.5, abs(centered.y));
    float softBand = pow(horizontalFade, 1.35) * pow(verticalFade, 2.4);
    float centerLift = 0.72 + 0.28 * (1.0 - smoothstep(0.0, 0.16, abs(centered.y)));
    float alpha = softBand * centerLift * uOpacity;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function LightstripExhibit({ item, isSelected, quality }: ExhibitRendererProps) {
  const lightColor = item.content || "#ffe08a";
  const lightIntensity = item.lightIntensity ?? 0.5;
  const runtimeValue = useRuntimeInteractionStore(
    (state) => state.activeByItemId[item.id],
  );
  const isOn = runtimeValue ?? true;
  const softGlowOpacity = 0.3 + THREE.MathUtils.clamp(lightIntensity, 0, 1) * 0.32;

  return (
    <group>
      {isOn && quality.decorativeLights && (
        <mesh position={[0, 0, -0.36]} renderOrder={-1}>
          <planeGeometry args={[1.18, 3.4]} />
          <shaderMaterial
            uniforms={{
              uColor: { value: new THREE.Color(lightColor) },
              uOpacity: { value: softGlowOpacity },
            }}
            vertexShader={SOFT_GLOW_VERTEX_SHADER}
            fragmentShader={SOFT_GLOW_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}

      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
        dimensions={[1, 0.82, 0.72]}
        bevelRadius={0.12}
        position={[0, 0, -0.08]}
        castShadow={quality.castShadows}
        receiveShadow={quality.castShadows}
      >
        <meshPhysicalMaterial
          color="#202832"
          roughness={0.28}
          metalness={0.78}
          clearcoat={quality.decorativeLights ? 0.35 : 0}
          clearcoatRoughness={0.2}
        />
        {isSelected && <Edges scale={1.025} color="#f59e0b" />}
      </BeveledBox>

      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
        dimensions={[0.94, 0.58, 0.14]}
        bevelRadius={0.065}
        position={[0, 0, 0.31]}
      >
        <meshStandardMaterial
          color="#090d12"
          roughness={0.4}
          metalness={0.48}
        />
      </BeveledBox>

      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
        dimensions={[0.87, 0.38, 0.11]}
        bevelRadius={0.055}
        position={[0, 0, 0.405]}
      >
        <meshStandardMaterial
          color={isOn ? lightColor : "#495461"}
          emissive={isOn ? lightColor : "#000000"}
          emissiveIntensity={isOn ? 1.15 : 0}
          roughness={0.32}
          toneMapped={!isOn}
        />
      </BeveledBox>

      <mesh position={[0, 0, 0.466]}>
        <planeGeometry args={[0.72, 0.17]} />
        <meshBasicMaterial
          color={isOn ? lightColor : "#1f2933"}
          toneMapped={!isOn}
        />
      </mesh>

      {[-0.465, 0.465].map((x) => (
        <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
          key={x}
          dimensions={[0.035, 0.48, 0.1]}
          bevelRadius={0.016}
          position={[x, 0, 0.355]}
        >
          <meshStandardMaterial
            color="#56616d"
            roughness={0.22}
            metalness={0.86}
          />
        </BeveledBox>
      ))}

      {quality.decorativeLights && isOn && (
        <pointLight
          color={lightColor}
          intensity={lightIntensity * 0.06}
          distance={1.25 + lightIntensity * 0.5}
          decay={3}
          position={[0, -0.08, 0.62]}
        />
      )}
    </group>
  );
}
